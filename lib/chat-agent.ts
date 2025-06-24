import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

// 1. 定义Agent配置的数据结构
interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
  keywords: string[];
}

// 2. 创建Agent配置常量
const AGENTS: Record<string, AgentConfig> = {
  style: {
    id: 'style',
    name: '小雅',
    emoji: '👗',
    systemPrompt: '你是专业的穿搭顾问，提供整体造型建议。请以温暖友好的语气，从整体搭配角度给出专业建议。',
    keywords: ['穿搭', '搭配', '造型', '风格', '衣服', '服装', '时尚'],
  },
  color: {
    id: 'color',
    name: '彩虹',
    emoji: '🎨',
    systemPrompt: '你是色彩专家，专注于色彩搭配建议。请以富有创意的语气，从色彩理论和搭配角度给出专业建议。',
    keywords: ['颜色', '色彩', '配色', '肤色', '色调', '色系'],
  },
  occasion: {
    id: 'occasion',
    name: '场合',
    emoji: '📅',
    systemPrompt: '你是场合专家，根据不同场合提供着装建议。请以优雅得体的语气，从场合适宜性角度给出专业建议。',
    keywords: ['约会', '上班', '工作', '聚会', '场合', '婚礼', '面试', '职场', '正式', '休闲'],
  },
};

// 3. 创建Agent选择函数
const selectAgent = (userMessage: string): AgentConfig => {
  const message = userMessage.toLowerCase();
  let bestAgentId = 'style'; // 默认
  let maxScore = 0;

  for (const [agentId, config] of Object.entries(AGENTS)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (message.includes(keyword)) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestAgentId = agentId;
    }
  }
  return AGENTS[bestAgentId];
};

export class SimpleChatAgent {
  private llm: ChatOpenAI;
  private memory: BaseMessage[] = [];

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.7,
    });
  }

  async chat(message: string): Promise<{ response: string; agentInfo: { id: string; name: string; emoji: string; } }> {
    // 4. 在chat方法中集成Agent选择
    const selectedAgent = selectAgent(message);

    // 5. 手动构建messages数组，注入systemPrompt
    const systemPrompt = new SystemMessage(selectedAgent.systemPrompt);

    // 创建一个临时的对话历史，包含新的系统提示
    const messages: BaseMessage[] = [
      systemPrompt,
      ...this.memory,
      new HumanMessage(message),
    ];

    const response = await this.llm.invoke(messages);

    // 6. 手动管理对话历史
    this.memory.push(new HumanMessage(message));
    this.memory.push(response);

    // 7. 返回响应和Agent信息
    return {
      response: response.content as string,
      agentInfo: {
        id: selectedAgent.id,
        name: selectedAgent.name,
        emoji: selectedAgent.emoji,
      }
    };
  }
}