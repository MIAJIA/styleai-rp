# 智能上下文管理系统设计方案

## 🎯 问题背景

当前多Agent系统存在上下文感知能力不足的问题，Agent只能基于用户的单次输入进行分析，无法理解对话的连续性和上下文关系。

### **典型问题场景**

```
用户: 帮我生成一张穿搭图 → 生成图片A
用户: 这个颜色不好看 → Agent不知道"这个"指什么
用户: 换个蓝色的试试 → Agent不知道要换什么
用户: 把鞋子换成运动鞋 → Agent完全迷失了上下文
```

### **核心需求**

- ✅ Agent能理解"这个"、"那个"、"它"等指代词
- ✅ 记住最近生成/上传的图片
- ✅ 理解连续对话中的主题切换
- ✅ 不增加客户端延迟和复杂度

---

## 🚫 方案演进：从过度工程化到最优解

### **初始方案：前端上下文传输（已否决）**

#### **设计思路**

```typescript
// ❌ 问题方案：前端维护并传输上下文
const [chatContext, setChatContext] = useState({
  lastUserMessage: null,     // 只有最后一条用户消息
  lastAgentResponse: null,   // 只有最后一条AI回复
  lastImageUrl: null,        // 只有最后一张图片
});

// 每次API调用都传输上下文
const response = await fetch('/api/chat/simple', {
  method: 'POST',
  body: JSON.stringify({ message, sessionId, imageUrl, context: chatContext })
});
```

#### **问题分析**

- ❌ **Context window太小** - 只有3条信息，不足以理解复杂对话
- ❌ **增加网络延迟** - 每次请求额外传输2-5KB数据，增加50-200ms延迟
- ❌ **客户端负担重** - 需要维护复杂的上下文状态
- ❌ **状态同步复杂** - 前后端状态容易不一致

### **改进方案：滑动窗口上下文（仍有问题）**

#### **设计思路**

```typescript
// ⚠️ 改进但仍有问题：扩大上下文窗口
interface ChatContext {
  recentMessages: Array<{
    role: 'user' | 'ai';
    content: string;
    imageUrl?: string;
    timestamp: Date;
  }>;
  currentSession: {
    lastGeneratedImage?: string;
    lastUploadedImage?: string;
    activeDiscussionTopic?: string;
    mentionedItems?: string[];
  };
  windowSize: number;  // 保留10条消息
}
```

#### **仍存在的问题**

- ❌ **网络传输负担** - 每次请求传输完整上下文（3-5KB）
- ❌ **序列化开销** - 客户端需要序列化复杂对象
- ❌ **延迟问题** - 增加50-200ms请求时间
- ❌ **实施复杂** - 需要复杂的前端状态管理

---

## ✅ 最终方案：后端内存上下文管理

### **设计原则**

- ✅ **零客户端延迟** - 不增加任何前端等待时间
- ✅ **API请求轻量** - 保持现有请求体积不变
- ✅ **实施简单** - 基于现有ChatAgent架构扩展
- ✅ **自动管理** - 后端自动维护上下文，前端无感知

### **架构设计**

#### **上下文数据结构**

```typescript
// 后端ChatAgent中的上下文结构
interface ConversationMessage {
  role: 'user' | 'ai';
  content: string;
  imageUrl?: string;
  agentInfo?: {
    type: string;
    name: string;
    emoji: string;
  };
  timestamp: Date;
  messageType: 'text' | 'image_upload' | 'image_generation' | 'text_with_image';
}

interface ChatContext {
  conversationHistory: ConversationMessage[];
  sessionInfo: {
    lastGeneratedImage?: string;        // 最后生成的图片
    lastUploadedImage?: string;         // 最后上传的图片
    activeDiscussionTopic?: string;     // 当前讨论主题
    mentionedClothingItems?: string[];  // 提到的服装单品
    lastActiveAgent?: string;           // 最后活跃的Agent
  };
  windowSize: number;                   // 保留消息数量
  lastUpdated: Date;
}
```

#### **智能上下文管理器**

```typescript
class SmartContextManager {
  private conversationHistory: ConversationMessage[] = [];
  private readonly MAX_HISTORY = 10;
  private sessionInfo: ChatContext['sessionInfo'] = {};

  // 添加消息到上下文
  addMessage(role: 'user' | 'ai', content: string, imageUrl?: string, agentInfo?: any) {
    const messageType = this.detectMessageType(role, content, imageUrl);

    const newMessage: ConversationMessage = {
      role,
      content,
      imageUrl,
      agentInfo,
      timestamp: new Date(),
      messageType
    };

    this.conversationHistory.push(newMessage);

    // 保持滑动窗口
    if (this.conversationHistory.length > this.MAX_HISTORY) {
      this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY);
    }

    // 更新会话信息
    this.updateSessionInfo(newMessage);
  }

  // 检测消息类型
  private detectMessageType(role: string, content: string, imageUrl?: string): ConversationMessage['messageType'] {
    if (role === 'user' && imageUrl) return 'image_upload';
    if (role === 'ai' && imageUrl) return 'image_generation';
    if (imageUrl) return 'text_with_image';
    return 'text';
  }

  // 更新会话信息
  private updateSessionInfo(message: ConversationMessage) {
    // 更新图片状态
    if (message.messageType === 'image_generation') {
      this.sessionInfo.lastGeneratedImage = message.imageUrl;
    } else if (message.messageType === 'image_upload') {
      this.sessionInfo.lastUploadedImage = message.imageUrl;
    }

    // 更新讨论主题
    this.sessionInfo.activeDiscussionTopic = this.inferDiscussionTopic(
      this.conversationHistory.slice(-3)
    );

    // 提取服装单品
    this.sessionInfo.mentionedClothingItems = this.extractClothingItems(
      this.conversationHistory.slice(-5).map(m => m.content).join(' ')
    );

    // 记录最后活跃的Agent
    if (message.role === 'ai' && message.agentInfo) {
      this.sessionInfo.lastActiveAgent = message.agentInfo.type;
    }
  }

  // 推断讨论主题
  private inferDiscussionTopic(recentMessages: ConversationMessage[]): string {
    const recentText = recentMessages.map(m => m.content).join(' ');

    const topicPatterns = {
      '颜色搭配': ['颜色', '色彩', '配色', '色调', '显白', '显黑', 'color', 'palette', 'matching', 'tone', 'hue'],
      '单品替换': ['换', '替换', '改成', '变成', '试试', 'change', 'replace', 'switch', 'swap', 'try'],
      '场合搭配': ['场合', '约会', '上班', '聚会', '婚礼', '面试', 'occasion', 'date', 'work', 'party', 'wedding', 'interview'],
      '风格分析': ['风格', '款式', '类型', '感觉', '气质', 'style', 'look', 'type', 'vibe', 'temperament'],
      '尺寸调整': ['大小', '尺寸', '合身', '宽松', '紧身', 'size', 'fit', 'loose', 'tight'],
      '材质讨论': ['材质', '面料', '质感', '舒适', '透气', 'material', 'fabric', 'texture', 'comfort', 'breathable']
    };

    for (const [topic, keywords] of Object.entries(topicPatterns)) {
      if (keywords.some(keyword => recentText.includes(keyword))) {
        return topic;
      }
    }

    return '综合咨询';
  }

  // 提取服装单品
  private extractClothingItems(text: string): string[] {
    const clothingKeywords = [
      // 上装
      '上衣', '衬衫', 'T恤', 'T恤衫', '毛衣', '针织衫', '外套', '夹克', '西装', '风衣',
      'top', 'shirt', 'blouse', 't-shirt', 'tee', 'sweater', 'pullover', 'knitwear', 'cardigan', 'jacket', 'outerwear', 'coat', 'blazer', 'suit', 'trench coat',
      // 下装
      '裤子', '牛仔裤', '短裤', '西装裤', '运动裤', '休闲裤', '阔腿裤',
      'pants', 'trousers', 'jeans', 'shorts', 'dress pants', 'sweatpants', 'joggers', 'casual pants', 'wide-leg pants',
      '裙子', 'A字裙', '连衣裙', '短裙', '长裙', '半身裙', '包臀裙',
      'skirt', 'dress', 'a-line skirt', 'miniskirt', 'long skirt', 'maxi skirt', 'bodycon skirt',
      // 鞋履
      '鞋子', '运动鞋', '高跟鞋', '平底鞋', '靴子', '凉鞋', '拖鞋', '皮鞋',
      'shoes', 'footwear', 'sneakers', 'trainers', 'high heels', 'flats', 'boots', 'sandals', 'slippers', 'leather shoes',
      // 配饰
      '帽子', '围巾', '包包', '手包', '背包', '项链', '耳环', '手链', '戒指', '腰带',
      'hat', 'cap', 'scarf', 'bag', 'handbag', 'purse', 'clutch', 'backpack', 'necklace', 'earrings', 'bracelet', 'ring', 'belt'
    ];

    return clothingKeywords.filter(item => text.includes(item));
  }

  // 生成上下文prompt
  generateContextPrompt(): string {
    if (this.conversationHistory.length === 0) return '';

    let prompt = '\n\n--- CONVERSATION CONTEXT ---';

    // 添加会话状态信息
    if (this.sessionInfo.lastGeneratedImage) {
      prompt += `\n🖼️ Last generated image: ${this.sessionInfo.lastGeneratedImage}`;
    }

    if (this.sessionInfo.lastUploadedImage) {
      prompt += `\n📤 Last uploaded image: ${this.sessionInfo.lastUploadedImage}`;
    }

    if (this.sessionInfo.activeDiscussionTopic) {
      prompt += `\n💬 Current discussion topic: ${this.sessionInfo.activeDiscussionTopic}`;
    }

    if (this.sessionInfo.mentionedClothingItems && this.sessionInfo.mentionedClothingItems.length > 0) {
      prompt += `\n👕 Recently mentioned clothing items: ${this.sessionInfo.mentionedClothingItems.join(', ')}`;
    }

    if (this.sessionInfo.lastActiveAgent) {
      prompt += `\n🤖 Last active agent: ${this.sessionInfo.lastActiveAgent}`;
    }

    // 添加最近对话历史
    prompt += '\n\n--- RECENT CONVERSATION ---';
    const recentMessages = this.conversationHistory.slice(-5);

    recentMessages.forEach((msg, index) => {
      const role = msg.role === 'user' ? '👤 User' : `🤖 ${msg.agentInfo?.name || 'AI'}`;
      prompt += `\n${role}: ${msg.content}`;

      if (msg.imageUrl) {
        const imageType = msg.messageType === 'image_generation' ? 'Generated' :
                         msg.messageType === 'image_upload' ? 'Uploaded' : 'Image';
        prompt += ` [${imageType} Image]`;
      }
    });

    // 添加重要提示
    prompt += '\n\n⚠️ CONTEXT AWARENESS INSTRUCTIONS:';
    prompt += '\n- When user says "this", "that", "it", they are likely referring to the last generated/uploaded image';
    prompt += '\n- When user says "换"(change), "替换"(replace), they want to modify the last generated image';
    prompt += '\n- Pay attention to the current discussion topic and mentioned clothing items';
    prompt += '\n- Maintain conversation continuity by referencing previous exchanges when relevant';

    return prompt;
  }

  // 检查是否需要包含上下文
  shouldIncludeContext(userMessage: string): boolean {
    const contextTriggerWords = [
      // 指代词
      '这个', '那个', '它', '这些', '那些',
      'this', 'that', 'it', 'these', 'those',
      // 时间相关
      '刚才', '之前', '上面', '前面', '刚刚',
      'just now', 'before', 'above', 'previously',
      // 动作相关
      '换', '改', '替换', '调整', '修改',
      'change', 'switch', 'replace', 'adjust', 'modify',
      // 比较相关
      '比较', '对比', '不如', '更好',
      'compare', 'than', 'better'
    ];

    return contextTriggerWords.some(word => userMessage.includes(word)) ||
           this.sessionInfo.lastGeneratedImage !== undefined ||
           this.conversationHistory.length > 1;
  }
}
```

---

## 🛠️ 具体实施方案

### **1. 扩展现有ChatAgent类**

```typescript
// 修改 lib/chat-agent.ts
export class ChatAgent {
  private contextManager: SmartContextManager;

  constructor() {
    this.contextManager = new SmartContextManager();
  }

  async chat(message: string, imageUrl?: string) {
    console.log('[ChatAgent] Processing message with context awareness');

    // 1. 添加用户消息到上下文
    this.contextManager.addMessage('user', message, imageUrl);

    // 2. 检查是否需要上下文
    const needsContext = this.contextManager.shouldIncludeContext(message);

    // 3. 选择合适的Agent
    const selectedAgent = this.selectAgent(message, !!imageUrl);
    console.log(`[ChatAgent] Selected agent: ${selectedAgent.type}`);

    // 4. 生成system prompt（包含上下文）
    let systemPrompt = selectedAgent.systemPrompt;

    if (needsContext) {
      const contextPrompt = this.contextManager.generateContextPrompt();
      systemPrompt += contextPrompt;
      console.log('[ChatAgent] Including conversation context in prompt');
    }

    // 5. 调用LLM
    const response = await this.callLLM({
      message,
      imageUrl,
      systemPrompt,
      selectedAgent
    });

    // 6. 添加AI回复到上下文
    this.contextManager.addMessage('ai', response.content, undefined, {
      type: selectedAgent.type,
      name: selectedAgent.name,
      emoji: selectedAgent.emoji
    });

    return {
      aiResponse: response.content,
      agentInfo: {
        type: selectedAgent.type,
        name: selectedAgent.name,
        emoji: selectedAgent.emoji
      }
    };
  }

  // Agent选择逻辑（现有代码）
  private selectAgent(userMessage: string, hasImage: boolean) {
    // ... 现有的Agent选择逻辑保持不变
  }

  // LLM调用逻辑（现有代码扩展）
  private async callLLM({ message, imageUrl, systemPrompt, selectedAgent }) {
    // ... 现有的OpenAI调用逻辑，使用扩展后的systemPrompt
  }
}
```

### **2. API端点无需修改**

```typescript
// app/api/chat/simple/route.ts 保持现有代码不变
export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, imageUrl } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const agent = getChatAgent(sessionId);

    // ChatAgent内部自动处理上下文，无需额外参数
    const { aiResponse, agentInfo } = await agent.chat(message, imageUrl);

    return NextResponse.json({
      response: aiResponse,
      agentInfo,
      success: true
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: '服务器内部错误', success: false },
      { status: 500 }
    );
  }
}
```

### **3. 前端完全无需修改**

```typescript
// app/chat/page.tsx 保持现有代码完全不变
const handleSendMessage = async (message: string, imageUrl?: string) => {
  // ... 现有代码完全不变 ...

  const response = await fetch('/api/chat/simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId,
      imageUrl
      // 无需发送context，后端自动处理！
    }),
  });

  // ... 其余逻辑完全不变 ...
};
```

### **4. 图片生成完成后的上下文更新**

```typescript
// 在图片生成完成后，通知ChatAgent更新上下文
// 修改图片生成完成的回调
const onGenerationComplete = (generatedImageUrl: string) => {
  // 通过API通知后端更新上下文
  fetch('/api/chat/context/image-generated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      imageUrl: generatedImageUrl,
      context: 'image_generation_completed'
    })
  });
};

// 新增API端点：app/api/chat/context/image-generated/route.ts
export async function POST(request: NextRequest) {
  try {
    const { sessionId, imageUrl, context } = await request.json();

    const agent = getChatAgent(sessionId);

    // 添加图片生成消息到上下文
    agent.contextManager.addMessage('ai', '图片生成完成', imageUrl, {
      type: 'system',
      name: 'System',
      emoji: '🎨'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '更新上下文失败' }, { status: 500 });
  }
}
```

---

## 📊 性能与成本分析

### **性能对比**

| 维度 | 前端上下文方案 | 后端上下文方案 | 改进幅度 |
|------|----------------|----------------|----------|
| **客户端延迟** | +50-200ms | **0ms** | ✅ 完全消除 |
| **网络传输** | +3-5KB | **+0KB** | ✅ 无额外负担 |
| **API请求体积** | 原大小+200% | **原大小不变** | ✅ 保持轻量 |
| **JSON序列化** | 大对象序列化 | **无额外序列化** | ✅ 零开销 |
| **前端复杂度** | 复杂状态管理 | **无需修改** | ✅ 零改动 |

### **内存使用分析**

```typescript
// 每个session的内存使用估算
interface MemoryUsage {
  conversationHistory: 10 * 500; // 10条消息 * 平均500字符 = 5KB
  sessionInfo: 1;                // 会话信息约1KB
  agentState: 1;                 // Agent状态约1KB
  total: 7;                      // 总计约7KB per session
}

// 1000个并发session的总内存使用
const totalMemoryFor1000Sessions = 7 * 1000; // 约7MB
```

**结论**：内存使用量极小，对服务器性能影响可忽略不计。

### **Token使用优化**

```typescript
// 智能上下文长度控制
class TokenOptimizer {
  private static readonly MAX_CONTEXT_TOKENS = 1000;

  static optimizeContextPrompt(fullPrompt: string): string {
    // 估算token数量（约4字符=1token）
    const estimatedTokens = fullPrompt.length / 4;

    if (estimatedTokens <= this.MAX_CONTEXT_TOKENS) {
      return fullPrompt;
    }

    // 智能截断：保留最重要的信息
    const lines = fullPrompt.split('\n');
    const importantSections = [
      '--- CONVERSATION CONTEXT ---',
      '🖼️ Last generated image:',
      '📤 Last uploaded image:',
      '💬 Current discussion topic:',
      '--- RECENT CONVERSATION ---'
    ];

    let optimizedPrompt = '';
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = line.length / 4;
      if (currentTokens + lineTokens > this.MAX_CONTEXT_TOKENS) {
        break;
      }

      // 优先保留重要信息
      if (importantSections.some(section => line.includes(section)) ||
          currentTokens < this.MAX_CONTEXT_TOKENS * 0.8) {
        optimizedPrompt += line + '\n';
        currentTokens += lineTokens;
      }
    }

    return optimizedPrompt;
  }
}
```

---

## 🚀 实施计划

### **阶段1：核心上下文管理（1天）**

**上午任务**：

- [ ] 实现`SmartContextManager`类
- [ ] 扩展`ChatAgent`类集成上下文管理
- [ ] 基础的上下文prompt生成

**下午任务**：

- [ ] 集成到现有API端点
- [ ] 基础功能测试
- [ ] 验证上下文连续性

### **阶段2：智能优化（半天）**

**任务列表**：

- [ ] 实现智能主题推断
- [ ] 服装单品关键词提取
- [ ] Token使用量优化
- [ ] 上下文触发条件优化

### **阶段3：图片生成集成（半天）**

**任务列表**：

- [ ] 图片生成完成时的上下文更新
- [ ] 图片状态跟踪优化
- [ ] 端到端测试

### **阶段4：性能调优（半天）**

**任务列表**：

- [ ] 内存使用监控
- [ ] 上下文窗口大小调优
- [ ] 错误处理完善
- [ ] 生产环境测试

---

## 🎯 成功指标

### **功能指标**

- [ ] **指代词理解率** > 90%（"这个"、"那个"等正确识别）
- [ ] **上下文连续性** > 85%（多轮对话保持话题一致）
- [ ] **图片关联准确率** > 95%（正确关联最近的图片）

### **性能指标**

- [ ] **客户端延迟增加** = 0ms（完全无额外延迟）
- [ ] **API响应时间** < 2秒（包含上下文处理）
- [ ] **内存使用** < 10KB per session
- [ ] **Token使用增加** < 500 tokens per request

### **用户体验指标**

- [ ] **对话自然度提升** > 70%（用户感知对话更自然）
- [ ] **重复解释减少** > 60%（用户无需重复解释上下文）
- [ ] **满意度提升** > 50%（整体对话体验改善）

---

## 🔧 监控与调试

### **上下文状态监控**

```typescript
// 开发环境下的上下文调试工具
class ContextDebugger {
  static logContextState(contextManager: SmartContextManager, sessionId: string) {
    if (process.env.NODE_ENV !== 'development') return;

    console.log(`[Context Debug] Session: ${sessionId}`);
    console.log(`[Context Debug] History length: ${contextManager.conversationHistory.length}`);
    console.log(`[Context Debug] Last generated image: ${contextManager.sessionInfo.lastGeneratedImage || 'none'}`);
    console.log(`[Context Debug] Active topic: ${contextManager.sessionInfo.activeDiscussionTopic || 'none'}`);
    console.log(`[Context Debug] Mentioned items: ${contextManager.sessionInfo.mentionedClothingItems?.join(', ') || 'none'}`);
  }

  static logContextPrompt(prompt: string, sessionId: string) {
    if (process.env.NODE_ENV !== 'development') return;

    console.log(`[Context Prompt] Session: ${sessionId}`);
    console.log(`[Context Prompt] Length: ${prompt.length} chars`);
    console.log(`[Context Prompt] Content:\n${prompt}`);
  }
}
```

### **性能监控**

```typescript
// 上下文处理性能监控
class ContextPerformanceMonitor {
  static async measureContextProcessing<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();

    console.log(`[Context Perf] ${operationName}: ${endTime - startTime}ms`);

    return result;
  }
}
```

---

## 💡 总结

### **方案优势**

- ✅ **零延迟** - 完全不增加客户端等待时间
- ✅ **零改动** - 前端代码无需任何修改
- ✅ **零负担** - API请求体积保持不变
- ✅ **智能化** - 自动理解对话上下文和图片关联
- ✅ **可扩展** - 易于添加新的上下文感知功能

### **技术亮点**

- 基于现有架构的无侵入式扩展
- 智能的上下文信息提取和管理
- 优化的token使用策略
- 完善的性能监控体系

### **实施风险**

- **极低** - 主要修改在后端ChatAgent类，影响面小
- **可回滚** - 如有问题可快速回退到原版本
- **渐进式** - 可以逐步启用上下文功能

**核心价值**：让Agent真正"记住"对话，提供更自然、更智能的交互体验，同时保持系统的简洁性和高性能！

---

## V2 升级：从关键词匹配到智能语义理解

### **问题陈述：关键词匹配的局限性**

当前 `SmartContextManager` 中的主题推断 (`inferDiscussionTopic`) 和服装提取 (`extractClothingItems`) 依赖于简单的关键词列表。

- **不准确**: 无法理解语义。例如，无法将"我想要些穿在脚上的"映射到"鞋子"。
- **语言限制**: 只支持中文，无法扩展到英语或其他语言。
- **维护困难**: 每次添加新概念都需要手动更新关键词列表。

### **设计理念：低成本、高效率的混合智能（Hybrid Intelligence）**

我们将在现有架构中引入一个轻量级的LLM调用，专门用于上下文的语义分析。但为了避免增加延迟和成本，我们不会在每次交互时都调用它。

### **技术选型与权衡：选择合适的模型**

| 模型类型 | 速度 | 成本 | 智能程度 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| **大型模型 (GPT-4o)** | 慢 (1-3s) | 高 | 非常高 | **过度工程化**。用于简单分类任务是浪费。 |
| **小型高速模型 (GPT-3.5-Turbo, Gemini Flash)** | **快 (<500ms)** | **极低** | **足够高** | **最佳选择**。完美平衡了成本、速度和任务需求。|

### **V2 架构：智能上下文分析流程**

```mermaid
graph TD
    A[用户消息进入] --> B{Pre-Check: 是否为简单、需上下文的消息?};
    B -- 是 (e.g., "换个颜色") --> C[调用小型LLM进行上下文分析];
    B -- 否 (e.g., "给我讲讲今年的流行趋势") --> D[跳过LLM分析];
    C --> E{生成上下文Prompt};
    D --> E;
    E --> F[主Agent生成回复];

    style C fill:#d4edda,stroke:#c3e6cb
    style B fill:#f8d7da,stroke:#f5c6cb
```

### **实施计划**

#### **Step 1: 升级 `SmartContextManager`**

我们将修改 `updateSessionInfo` 和 `generateContextPrompt` 方法，用一个统一的 `analyzeContextWithLLM` 方法来取代手动的关键词匹配。

```typescript
class SmartContextManager {
  // ... existing properties

  // 新增：用于上下文分析的小型、高速LLM实例
  private contextAnalysisLLM = new ChatOpenAI({ modelName: 'gpt-3.5-turbo', temperature: 0 });

  // 核心逻辑：智能更新会话信息
  async updateSessionInfo(newMessage: ConversationMessage) {
    // Pre-Check: 仅在消息简短或包含触发词时调用LLM
    if (this.isComplexContextNeeded(newMessage.content)) {
      const analysis = await this.analyzeContextWithLLM();
      if (analysis) {
        this.sessionInfo = { ...this.sessionInfo, ...analysis };
      }
    }

    // 依然可以保留一些基础的更新逻辑
    if (newMessage.messageType === 'image_generation') this.sessionInfo.lastGeneratedImage = newMessage.imageUrl;
    if (newMessage.messageType === 'image_upload') this.sessionInfo.lastUploadedImage = newMessage.imageUrl;
    if (newMessage.role === 'ai' && newMessage.agentInfo) this.sessionInfo.lastActiveAgent = newMessage.agentInfo.type;
  }

  // Pre-Check 逻辑
  private isComplexContextNeeded(userMessage: string): boolean {
    const triggerWords = ['这个', '它', '换', '改', '怎么样', 'what about', 'change this'];
    // 消息简短，或包含明确的上下文触发词
    return userMessage.length < 30 || triggerWords.some(word => userMessage.toLowerCase().includes(word));
  }

  // 使用LLM进行上下文分析（取代 inferDiscussionTopic 和 extractClothingItems）
  private async analyzeContextWithLLM(): Promise<Partial<ChatContext['sessionInfo']> | null> {
    const prompt = `
      Analyze the recent conversation provided below to understand the user's intent and the current context.

      CONVERSATION HISTORY:
      ${this.conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

      YOUR TASK:
      Based on the LAST user message in the context of the entire conversation history, extract the following information.
      Respond ONLY with a valid JSON object with the following keys.
      - "activeDiscussionTopic": A short, clear topic name (e.g., "Color Analysis", "Item Replacement", "Style Feedback", "General Question").
      - "mentionedClothingItems": An array of specific clothing items mentioned by the user (e.g., ["shoes", "dress", "jacket"]).

      EXAMPLE:
      History:
      user: I just got this dress. (image attached)
      ai: It looks great on you!
      user: can you change it to blue?
      Your JSON output:
      {
        "activeDiscussionTopic": "Item Replacement",
        "mentionedClothingItems": ["dress"]
      }

      History:
      ai: Here is your generated outfit.
      user: I don't like the shoes.
      Your JSON output:
      {
        "activeDiscussionTopic": "Style Feedback",
        "mentionedClothingItems": ["shoes"]
      }
    `;

    try {
      const response = await this.contextAnalysisLLM.invoke(prompt);
      const result = JSON.parse(response.content as string);
      console.log('[ContextLLM] Analysis successful:', result);
      return result;
    } catch (error) {
      console.error('[ContextLLM] Failed to analyze context:', error);
      return null;
    }
  }

  // generateContextPrompt 方法将直接使用 this.sessionInfo 中的信息，无需大改
}
```

#### **Step 2: 调整 `ChatAgent`**

`ChatAgent` 的 `chat` 方法需要调整为异步更新上下文。

```typescript
// lib/chat-agent.ts
export class ChatAgent {
  // ...

  async chat(message: string, imageUrl?: string) {
    // ...
    // 1. 添加用户消息，但不立即更新分析
    this.contextManager.addMessage('user', message, imageUrl);

    // 2. 异步更新会话分析
    await this.contextManager.updateSessionInfo({ role: 'user', content: message });

    // ... 后续逻辑（生成prompt，调用主LLM）不变 ...
  }
}
```

### **优势总结**

1. **高精度与多语言**: 借助LLM的语义理解能力，准确捕捉用户意图，并天然支持多语言。
2. **低成本与低延迟**: 通过"Pre-Check"和选用小型高速模型，仅在必要时执行快速的上下文分析，将对性能和成本的影响降到最低。
3. **易于维护**: 无需维护庞大的关键词列表，逻辑更清晰、更健壮。

这个V2方案解决了V1的根本问题，同时依然严格遵循了"避免过度工程化"的核心原则。
