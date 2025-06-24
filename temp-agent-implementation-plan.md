# 3个Agent配置实施计划（临时文档）

> ⚠️ **注意**：这是临时计划文档，实施完成后将删除

## 📋 实现3个Agent配置的完整计划

### 🎯 **目标确认**

实现3个核心Agent（小雅、彩虹、场合）的配置和基础关键词选择逻辑，集成到现有的聊天API中。

---

## 📊 **现状分析**

### **需要了解的现有架构**

- [ ] **当前聊天API结构** - 了解 `app/api/chat/simple/route.ts` 的实现
- [ ] **消息流处理** - 了解现有的消息处理逻辑
- [ ] **前端消息显示** - 了解 ChatBubble 组件的结构
- [ ] **数据结构** - 了解现有的 ChatMessage 类型定义

### **需要确认的技术细节**

- [ ] **OpenAI API调用方式** - 确认当前使用的模型和参数
- [ ] **消息类型扩展** - 确认如何添加Agent信息到消息中
- [ ] **错误处理机制** - 了解现有的错误处理方式
- [ ] **性能考虑** - 确认是否需要缓存或优化

---

## 🔧 **实施步骤规划**

### **步骤1：代码结构分析（30分钟）**

**任务清单**：

- [x] 查看 `app/api/chat/simple/route.ts` 的完整实现
- [x] 了解现有的消息处理流程 (`lib/chat-agent.ts`)
- [x] 查看前端 ChatBubble 组件的结构 (`app/chat/page.tsx`)
- [x] 确认 ChatMessage 类型定义的位置 (`app/chat/page.tsx`)

**产出**：

- ✅ **现有代码结构的清晰理解**:
  - 后端: `route.ts` -> `SimpleChatAgent` -> `ConversationChain`.
  - 前端: `ChatPage` -> `messages` state -> `ChatBubble` render.
  - 数据流: `handleFreeChat` -> API -> `SimpleChatAgent` -> `ChatOpenAI`.
- ✅ **需要修改的文件列表**:
  - `app/api/chat/simple/route.ts`
  - `lib/chat-agent.ts`
  - `app/chat/page.tsx`
- ✅ **潜在的技术风险点**:
  - `ConversationChain` 不易动态修改 `systemPrompt`。
  - **应对策略**: 放弃 `ConversationChain`，手动管理对话历史。

**完成标记**：[x] 步骤1完成

---

### **步骤2：Agent配置设计（30分钟）**

**任务清单**：

- [ ] 设计 Agent 配置的数据结构
- [ ] 确定 Agent 配置的存放位置
- [ ] 设计关键词匹配的算法
- [ ] 规划 Agent 选择的 fallback 机制

**产出**：

- [ ] Agent配置的TypeScript接口定义
- [ ] 关键词匹配算法的伪代码
- [ ] 错误处理和fallback策略

**完成标记**：[ ] 步骤2完成

---

### **步骤3：API修改计划（45分钟）**

**任务清单**：

- [ ] 设计如何在现有API中集成Agent选择
- [ ] 确定消息结构的扩展方式
- [ ] 规划Agent信息的传递方式
- [ ] 设计测试用例

**产出**：

- [ ] API修改的详细方案
- [ ] 新的消息结构定义
- [ ] 测试用例列表

**完成标记**：[ ] 步骤3完成

---

### **步骤4：前端集成计划（30分钟）**

**任务清单**：

- [ ] 设计Agent标识的UI显示方式
- [ ] 确定ChatBubble组件的修改方案
- [ ] 规划Agent信息的样式设计
- [ ] 考虑响应式设计

**产出**：

- [ ] UI设计方案
- [ ] 组件修改计划
- [ ] CSS样式规划

**完成标记**：[ ] 步骤4完成

---

### **步骤5：实现顺序规划（15分钟）**

**任务清单**：

- [ ] 确定实现的先后顺序
- [ ] 规划测试和验证的节点
- [ ] 设计回滚方案
- [ ] 估算每个步骤的时间

**产出**：

- [ ] 详细的实现时间表
- [ ] 测试验证计划
- [ ] 风险控制方案

**完成标记**：[ ] 步骤5完成

---

## 🎯 **具体实现内容预览**

### **Agent配置结构**

```typescript
interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
  keywords: string[];
  fallbackPriority: number;
}

const AGENTS: Record<string, AgentConfig> = {
  style: {
    id: 'style',
    name: '小雅',
    emoji: '👗',
    systemPrompt: '你是专业的穿搭顾问，提供整体造型建议。请以温暖友好的语气，从整体搭配角度给出专业建议。',
    keywords: ['穿搭', '搭配', '造型', '风格', '衣服', '服装', '时尚'],
    fallbackPriority: 1
  },
  color: {
    id: 'color',
    name: '彩虹',
    emoji: '🎨',
    systemPrompt: '你是色彩专家，专注于色彩搭配建议。请以富有创意的语气，从色彩理论和搭配角度给出专业建议。',
    keywords: ['颜色', '色彩', '配色', '肤色', '色调', '色系'],
    fallbackPriority: 2
  },
  occasion: {
    id: 'occasion',
    name: '场合',
    emoji: '📅',
    systemPrompt: '你是场合专家，根据不同场合提供着装建议。请以优雅得体的语气，从场合适宜性角度给出专业建议。',
    keywords: ['约会', '上班', '工作', '聚会', '场合', '婚礼', '面试', '职场', '正式', '休闲'],
    fallbackPriority: 3
  }
};
```

### **关键词选择算法**

```typescript
const selectAgent = (userMessage: string): string => {
  const message = userMessage.toLowerCase();
  let bestAgent = 'style'; // 默认
  let maxScore = 0;

  for (const [agentId, config] of Object.entries(AGENTS)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (message.includes(keyword)) {
        score += 1;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestAgent = agentId;
    }
  }

  return bestAgent;
};
```

### **消息结构扩展**

```typescript
interface ChatMessage {
  // ... 现有字段
  agentInfo?: {
    id: string;
    name: string;
    emoji: string;
  };
}
```

---

## 📋 **准备工作检查清单**

### **开发环境准备**

- [ ] 确认开发环境正常运行
- [ ] 确认可以本地测试API
- [ ] 确认前端热重载工作正常
- [ ] 备份当前稳定版本的代码

### **工具和资源准备**

- [ ] 准备好代码编辑器和调试工具
- [ ] 准备测试用的问题样本
- [ ] 准备Agent头像图片（如果需要）
- [ ] 确认OpenAI API密钥可用

### **时间和精力准备**

- [ ] 预留2-3小时的连续开发时间
- [ ] 准备好测试和调试的耐心
- [ ] 考虑可能的技术难点和解决方案

---

## 🚨 **潜在风险和应对策略**

### **技术风险**

1. **现有API结构复杂** → 先小范围测试，确保不破坏现有功能
2. **关键词匹配不准确** → 准备详细的测试用例，逐步优化
3. **前端显示问题** → 先实现基础版本，再优化样式

### **时间风险**

1. **实现时间超预期** → 分阶段实现，确保核心功能优先
2. **调试时间过长** → 准备回滚方案，避免影响主要功能

### **用户体验风险**

1. **Agent切换不明显** → 设计清晰的视觉指示
2. **回答质量下降** → 仔细调试systemPrompt，确保质量

---

## 🎯 **成功标准**

### **功能标准**

- [ ] 3个Agent配置正确加载
- [ ] 关键词选择逻辑基本准确（>70%）
- [ ] Agent信息正确显示在聊天界面
- [ ] 不影响现有聊天功能

### **技术标准**

- [ ] 代码结构清晰，易于维护
- [ ] 错误处理完善，不会崩溃
- [ ] 性能影响最小化
- [ ] 测试用例通过

### **用户体验标准**

- [ ] Agent切换用户可感知
- [ ] 界面显示美观合理
- [ ] 响应时间无明显增加
- [ ] 整体体验流畅

---

## 🚀 **实施时间表**

### **第一天**

- [ ] **上午**：完成步骤1-2（代码分析 + Agent设计）
- [ ] **下午**：完成步骤3（API修改计划）

### **第二天**

- [ ] **上午**：完成步骤4-5（前端计划 + 实现规划）
- [ ] **下午**：开始实际代码实现

---

## 📝 **测试用例准备**

### **关键词匹配测试**

```typescript
const testCases = [
  { input: "这个红色适合我吗？", expected: "color" },
  { input: "约会该穿什么？", expected: "occasion" },
  { input: "帮我搭配一套衣服", expected: "style" },
  { input: "上班穿什么颜色的衬衫？", expected: "occasion" }, // 多关键词
  { input: "今天天气很好", expected: "style" }, // fallback
];
```

### **Agent回答质量测试**

- [ ] 每个Agent的systemPrompt是否产生不同风格的回答
- [ ] 回答是否符合Agent的专业领域
- [ ] 回答质量是否达到预期标准

---

## 🔄 **回滚计划**

### **如果实现失败**

1. **保留现有功能** - 确保原有聊天功能不受影响
2. **快速回滚** - 准备好回滚到稳定版本的方案
3. **问题记录** - 记录遇到的问题，为下次实现做准备

### **回滚触发条件**

- [ ] 实现时间超过预期2倍
- [ ] 出现无法解决的技术问题
- [ ] 严重影响现有功能的稳定性

---

## ✅ **完成检查清单**

### **实现完成后**

- [ ] 所有测试用例通过
- [ ] 在本地环境充分测试
- [ ] 代码review和优化
- [ ] 提交代码并部署测试

### **验证完成后**

- [ ] 收集初步用户反馈
- [ ] 分析Agent选择的准确率
- [ ] 记录改进建议
- [ ] **删除此临时文档**

---

## 📞 **需要帮助时**

如果在实施过程中遇到问题，可以随时：

1. 查看现有的设计文档 `docs/chat-next-phase-design.md`
2. 回顾简化设计原则
3. 寻求技术支持和建议

---

**最后更新时间**：{{ 当前时间 }}
**预计完成时间**：2天内
**负责人**：开发者
**状态**：计划阶段
