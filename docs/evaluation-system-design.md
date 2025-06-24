# Agent评价系统设计方案

## 🎯 设计目标

为阶段2的多Agent系统实现简化版评价体系，用于验证Agent选择准确性和回答质量，指导后续优化方向。

### **核心原则**
- ✅ **极简用户体验** - 只要👍👎，无复杂表单
- ✅ **自动化数据收集** - 减少用户负担，自动记录技术指标
- ✅ **数据驱动决策** - 基于真实使用数据优化Agent系统
- ✅ **快速迭代** - 简单实施，快速验证价值

---

## 📊 评价系统架构

### **1. 用户主观评价（极简版）**

#### **数据结构**

```typescript
// 简化的评价数据结构
interface MessageEvaluation {
  messageId: string;
  agentType: string;
  userMessage: string;
  agentResponse: string;
  
  // 只保留最简单的评价
  isHelpful: boolean; // 👍=true, 👎=false
  
  timestamp: Date;
  sessionId: string;
}
```

#### **UI组件实现**

```typescript
// 极简评价按钮组件
const SimpleEvaluationUI = ({ message, onEvaluate }) => {
  const [voted, setVoted] = useState<boolean | null>(null);
  
  const handleVote = (isHelpful: boolean) => {
    setVoted(isHelpful);
    onEvaluate(message.id, { isHelpful });
  };
  
  return (
    <div className="mt-2 flex items-center gap-2">
      <button 
        onClick={() => handleVote(true)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
          voted === true 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 hover:bg-green-50 text-gray-600'
        }`}
      >
        👍 有用
      </button>
      
      <button 
        onClick={() => handleVote(false)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
          voted === false 
            ? 'bg-red-100 text-red-700' 
            : 'bg-gray-100 hover:bg-red-50 text-gray-600'
        }`}
      >
        👎 无用
      </button>
      
      {voted !== null && (
        <span className="text-xs text-gray-400 ml-2">感谢反馈！</span>
      )}
    </div>
  );
};
```

### **2. 自动化指标收集**

#### **技术指标数据结构**

```typescript
// 自动收集的技术指标
interface AutoMetrics {
  messageId: string;
  agentType: string;
  
  // Agent选择相关
  agentSelectionTime: number;
  selectedKeywords?: string[]; // 触发Agent选择的关键词
  
  // 响应质量相关
  responseTime: number;
  responseLength: number;
  tokenUsed: number;
  
  // 用户行为指标
  userReadTime?: number; // 通过页面停留时间估算
  followUpQuestions: number;
  sessionContinued: boolean;
  
  timestamp: Date;
}
```

#### **自动指标收集器**

```typescript
class AutoMetricsCollector {
  private startTime: number = 0;
  
  startAgentSelection() {
    this.startTime = Date.now();
  }
  
  recordAgentSelection(agentType: string, userMessage: string) {
    return {
      agentType,
      agentSelectionTime: Date.now() - this.startTime,
      messageId: generateId(),
      userMessage,
      timestamp: new Date()
    };
  }
  
  // 记录用户行为
  recordUserBehavior(messageId: string, behavior: {
    readTime?: number;
    followUpQuestions?: number;
    sessionContinued?: boolean;
  }) {
    // 存储用户行为数据用于后续分析
  }
}
```

---

## 🚀 API实现

### **评价数据收集API**

```typescript
// POST /api/evaluation/simple
export async function POST(request: Request) {
  const { messageId, agentType, isHelpful, sessionId, userMessage } = await request.json();
  
  const evaluation: MessageEvaluation = {
    messageId,
    agentType,
    userMessage,
    agentResponse: '', // 可以后续通过messageId查询
    isHelpful,
    timestamp: new Date(),
    sessionId
  };
  
  // 存储单条评价
  await kv.set(`eval:${messageId}`, JSON.stringify(evaluation));
  
  // 更新简化的实时统计
  await updateSimpleStats(agentType, isHelpful);
  
  return NextResponse.json({ success: true });
}
```

### **实时统计更新**

```typescript
// 简化的统计更新
const updateSimpleStats = async (agentType: string, isHelpful: boolean) => {
  const today = new Date().toISOString().split('T')[0];
  const statsKey = `stats:${today}`;
  
  const stats = await kv.get(statsKey) || {
    total: 0,
    helpful: 0,
    agents: {}
  };
  
  // 更新整体统计
  stats.total += 1;
  if (isHelpful) stats.helpful += 1;
  
  // 更新Agent统计
  if (!stats.agents[agentType]) {
    stats.agents[agentType] = { total: 0, helpful: 0 };
  }
  stats.agents[agentType].total += 1;
  if (isHelpful) stats.agents[agentType].helpful += 1;
  
  await kv.set(statsKey, JSON.stringify(stats));
};
```

### **统计数据查询API**

```typescript
// GET /api/evaluation/stats
export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
  
  const [todayStats, yesterdayStats] = await Promise.all([
    kv.get(`stats:${today}`),
    kv.get(`stats:${yesterday}`)
  ]);
  
  const processStats = (stats: any) => {
    if (!stats) return { total: 0, helpfulRate: 0, agents: {} };
    
    return {
      total: stats.total,
      helpfulRate: stats.total > 0 ? (stats.helpful / stats.total) : 0,
      agents: Object.entries(stats.agents || {}).map(([agent, data]: [string, any]) => ({
        agent,
        total: data.total,
        helpfulRate: data.total > 0 ? (data.helpful / data.total) : 0
      }))
    };
  };
  
  return NextResponse.json({
    today: processStats(todayStats),
    yesterday: processStats(yesterdayStats)
  });
}
```

---

## 📈 数据分析与展示

### **简化的统计Dashboard**

```typescript
// 简单的统计显示页面（开发用）
const SimpleStatsPage = () => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetch('/api/evaluation/stats')
      .then(res => res.json())
      .then(setStats);
  }, []);
  
  if (!stats) return <div>Loading...</div>;
  
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Agent评价统计</h1>
      
      {/* 整体统计 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-600">今日</h3>
          <p className="text-2xl font-bold">{stats.today.total}</p>
          <p className="text-sm text-gray-500">
            👍 {(stats.today.helpfulRate * 100).toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-600">昨日</h3>
          <p className="text-2xl font-bold">{stats.yesterday.total}</p>
          <p className="text-sm text-gray-500">
            👍 {(stats.yesterday.helpfulRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>
      
      {/* Agent表现对比 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-3">Agent表现（今日）</h3>
        {stats.today.agents.map((agent: any) => (
          <div key={agent.agent} className="flex justify-between items-center py-2 border-b">
            <span className="capitalize">{agent.agent}</span>
            <div className="text-right">
              <span className="font-medium">{agent.total}次</span>
              <span className="text-sm text-gray-500 ml-2">
                👍 {(agent.helpfulRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **核心指标计算**

```typescript
// Agent选择准确性分析
const analyzeAgentPerformance = async (days: number = 7) => {
  const results = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    
    const stats = await kv.get(`stats:${date}`);
    if (stats) {
      results.push({
        date,
        ...stats
      });
    }
  }
  
  // 计算趋势和关键指标
  const analysis = {
    totalEvaluations: results.reduce((sum, day) => sum + day.total, 0),
    averageHelpfulRate: results.reduce((sum, day) => sum + (day.helpful / day.total), 0) / results.length,
    agentPerformance: {},
    trend: results.length > 1 ? 
      (results[0].helpful / results[0].total) - (results[results.length-1].helpful / results[results.length-1].total) : 0
  };
  
  return analysis;
};
```

---

## 🔧 前端集成

### **修改ChatBubble组件**

```typescript
// 在现有ChatBubble中添加简化评价
const ChatBubble = ({ message, onEvaluate }) => {
  // ... 现有代码保持不变 ...
  
  return (
    <div className="flex items-start mb-4">
      {/* Agent头像 */}
      <img
        src={message.agentAvatar || '/avatars/default.png'}
        alt={message.agentName || 'AI'}
        className="w-8 h-8 rounded-full mr-2"
      />

      <div className="flex flex-col">
        {/* Agent名称 */}
        {message.agentInfo && (
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <span>{message.agentInfo.emoji}</span>
            <span>{message.agentInfo.name}</span>
          </div>
        )}

        {/* 消息内容 */}
        <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
          <div className="text-sm">{message.content}</div>
        </div>

        {/* 时间戳 */}
        <div className="text-xs text-gray-400 mt-1">
          {message.timestamp.toLocaleTimeString()}
        </div>

        {/* 评价按钮 - 只在Agent消息下方显示 */}
        {message.role === 'agent' && !message.evaluated && (
          <SimpleEvaluationUI 
            message={message} 
            onEvaluate={(messageId, evaluation) => {
              onEvaluate(messageId, evaluation);
              // 标记为已评价，避免重复显示
              message.evaluated = true;
            }}
          />
        )}
      </div>
    </div>
  );
};
```

### **修改Chat页面处理函数**

```typescript
// 在现有chat/page.tsx中添加简化评价处理
const handleMessageEvaluation = async (messageId: string, evaluation: { isHelpful: boolean }) => {
  try {
    // 找到对应的消息
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    await fetch('/api/evaluation/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        agentType: message.agentType || 'style', // 从消息中获取agent类型
        isHelpful: evaluation.isHelpful,
        sessionId,
        userMessage: getPreviousUserMessage(messageId) // 获取用户的问题
      })
    });
    
    // 可选：简单的反馈提示
    if (evaluation.isHelpful) {
      console.log('👍 User found this helpful');
    } else {
      console.log('👎 User found this not helpful');
    }
    
  } catch (error) {
    console.error('Failed to submit evaluation:', error);
  }
};

// 获取用户消息的辅助函数
const getPreviousUserMessage = (messageId: string) => {
  const messageIndex = messages.findIndex(m => m.id === messageId);
  for (let i = messageIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content || '';
    }
  }
  return '';
};
```

### **在Agent响应中包含类型信息**

```typescript
// 修改现有的handleSendMessage，添加agent类型信息
const handleSendMessage = async (message: string, attachments?: any[]) => {
  // ... 现有代码 ...
  
  // 在调用chat API时记录选择的agent
  const selectedAgent = selectAgent(currentInput); // 你的Agent选择逻辑
  
  // 添加Agent消息时包含类型信息
  addMessage({
    type: 'text',
    role: 'agent',
    content: response,
    agentType: selectedAgent, // 新增：记录agent类型
    agentInfo: SIMPLE_AGENTS[selectedAgent], // 新增：agent信息用于显示
    timestamp: new Date()
  });
};
```

---

## 📊 性能监控与预警

### **自动化性能监控**

```typescript
// 简单的性能监控
const checkPerformanceAlerts = async () => {
  const todayStats = await kv.get(`stats:${new Date().toISOString().split('T')[0]}`);
  
  if (!todayStats || todayStats.total < 10) return; // 样本太少
  
  const helpfulRate = todayStats.helpful / todayStats.total;
  
  // 如果今日好评率低于60%，发出提醒
  if (helpfulRate < 0.6) {
    console.warn(`🚨 Performance Alert: Helpful rate dropped to ${(helpfulRate * 100).toFixed(1)}%`);
    
    // 分析哪个Agent表现最差
    const worstAgent = Object.entries(todayStats.agents)
      .map(([agent, stats]: [string, any]) => ({
        agent,
        helpfulRate: stats.helpful / stats.total,
        total: stats.total
      }))
      .filter(a => a.total >= 3) // 至少3个样本
      .sort((a, b) => a.helpfulRate - b.helpfulRate)[0];
    
    if (worstAgent) {
      console.warn(`📉 Worst performing agent: ${worstAgent.agent} (${(worstAgent.helpfulRate * 100).toFixed(1)}%)`);
    }
  }
};
```

### **数据驱动的改进建议**

```typescript
// 基于数据自动生成改进建议
const generateImprovementSuggestions = async () => {
  const analysis = await analyzeAgentPerformance(7);
  const suggestions = [];
  
  // 整体准确率低
  if (analysis.averageHelpfulRate < 0.75) {
    suggestions.push({
      type: 'agent_selection',
      priority: 'high',
      suggestion: '需要优化Agent选择算法，当前准确率过低',
      action: '分析用户给👎最多的cases，调整关键词匹配逻辑'
    });
  }
  
  // 特定Agent表现差
  Object.entries(analysis.agentPerformance).forEach(([agent, stats]) => {
    if (stats.helpfulRate < 0.6 && stats.total >= 10) {
      suggestions.push({
        type: 'agent_performance',
        priority: 'medium',
        suggestion: `${agent} Agent表现需要改进`,
        action: `检查${agent}的system prompt和专业知识范围`
      });
    }
  });
  
  return suggestions;
};
```

---

## 🎯 关键评估指标

### **核心成功指标**

1. **Agent选择准确率** = 👍评价数 / 总评价数
   - 目标：> 75%（阶段2）
   - 优秀：> 85%（阶段4）

2. **Agent个体表现**
   - 每个Agent的好评率
   - 识别表现最差的Agent

3. **用户参与度**
   - 评价参与率（有多少回复被评价）
   - 连续对话率（用户是否继续对话）

4. **响应质量趋势**
   - 日好评率变化
   - 周平均好评率

### **数据驱动决策标准**

```typescript
// 阶段3决策标准
const evaluatePhase2Success = (stats: any) => {
  const criteria = {
    overallHelpfulRate: stats.averageHelpfulRate > 0.75,
    sufficientSamples: stats.totalEvaluations > 50,
    userEngagement: stats.evaluationRate > 0.3, // 30%的回复被评价
    agentDiversity: Object.keys(stats.agentPerformance).length >= 2 // 至少使用了2个不同Agent
  };
  
  const passedCriteria = Object.values(criteria).filter(Boolean).length;
  
  if (passedCriteria >= 3) {
    return 'proceed_to_phase4'; // 进入阶段4
  } else if (passedCriteria >= 2) {
    return 'optimize_current'; // 优化当前版本
  } else {
    return 'simplify_to_single_agent'; // 简化为单Agent
  }
};
```

---

## 🚀 实施步骤

### **Step 1: 基础实现（半天）**
- [ ] 创建`SimpleEvaluationUI`组件
- [ ] 实现`/api/evaluation/simple` API
- [ ] 实现`/api/evaluation/stats` API
- [ ] 修改`ChatBubble`组件集成评价按钮

### **Step 2: 数据收集集成（半天）**
- [ ] 修改`handleSendMessage`包含agent类型信息
- [ ] 实现评价处理函数`handleMessageEvaluation`
- [ ] 测试完整的评价数据收集流程

### **Step 3: 统计与监控（半天）**
- [ ] 创建简单的统计查看页面
- [ ] 实现基础的性能监控
- [ ] 测试数据分析功能

### **Step 4: 优化与监控（持续）**
- [ ] 每天查看统计数据
- [ ] 根据好评率数据调整Agent选择逻辑
- [ ] 持续优化system prompt和关键词匹配

---

## 🔍 监控检查清单

### **每日检查**
- [ ] 查看总体好评率是否 > 75%
- [ ] 识别表现最差的Agent
- [ ] 检查是否有用户反馈模式

### **每周分析**
- [ ] 分析好评率趋势
- [ ] 对比不同Agent的表现
- [ ] 制定下周的优化计划

### **阶段2结束评估**
- [ ] 总样本数是否 > 50个评价
- [ ] 整体好评率是否达标
- [ ] 用户参与度是否足够
- [ ] 决定是否进入阶段4

---

## 💡 最佳实践

### **用户体验原则**
- 评价按钮要明显但不突兀
- 点击后立即显示感谢信息
- 不要重复要求评价同一条消息

### **数据质量保证**
- 确保每条Agent回复都记录了正确的agentType
- 评价数据要包含足够的上下文信息
- 定期检查数据一致性

### **性能优化**
- 评价API调用要快速响应
- 统计数据更新要异步处理
- 避免影响正常聊天体验

---

**核心目标：用最简单的👍👎收集最有价值的反馈，快速验证和改进Agent系统！**