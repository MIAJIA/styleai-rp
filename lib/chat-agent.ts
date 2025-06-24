import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
  MessageContentComplex,
} from '@langchain/core/messages';

// 1. 定义Agent配置的数据结构
interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
  keywords: string[];
}

// 1. 定义图片分析工具的完整 Schema
const analyzeImageTool = {
  type: "function",
  function: {
    name: "analyze_outfit_image",
    description: "分析用户上传的穿搭照片，提取服装信息和风格特征用于专业建议。仅在用户上传了图片时使用此工具。",
    parameters: {
      type: "object",
      properties: {
        clothing_items: {
          type: "array",
          description: "识别到的具体服装单品（例如：白色T恤、蓝色牛仔裤、运动鞋）。",
          items: { type: "string" }
        },
        colors: {
          type: "array",
          description: "图片中的主要颜色（例如：米白色、天蓝色、深灰色）。",
          items: { type: "string" }
        },
        style_category: {
          type: "string",
          description: "对整体风格的分类（例如：休闲、商务、复古、街头）。",
        },
        fit_assessment: {
          type: "string",
          description: "对合身度的评估（例如：合身、宽松、修身）。"
        },
        occasion_suitability: {
          type: "array",
          description: "这套穿搭适合的场合（例如：日常通勤、周末逛街、朋友聚会）。",
          items: { type: "string" }
        },
      },
      required: ["clothing_items", "colors", "style_category", "occasion_suitability"]
    }
  }
};

// 2. 创建Agent配置常量
const AGENTS: Record<string, AgentConfig> = {
  style: {
    id: 'style',
    name: '小雅',
    emoji: '👗',
    systemPrompt: '你是专业的穿搭顾问小雅，擅长整体造型建议和风格分析。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后基于分析结果和你的专业知识给出建议。',
    keywords: ['穿搭', '搭配', '造型', '风格', '衣服', '服装', '时尚'],
  },
  color: {
    id: 'color',
    name: '彩虹',
    emoji: '🎨',
    systemPrompt: '你是色彩专家彩虹，专注于色彩搭配和色彩理论。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后重点从色彩搭配、肤色适配等角度给出专业建议。',
    keywords: ['颜色', '色彩', '配色', '肤色', '色调', '色系'],
  },
  occasion: {
    id: 'occasion',
    name: '场合',
    emoji: '📅',
    systemPrompt: '你是场合专家场合，精通不同场合的着装要求。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后重点评估这套穿搭的场合适配性。',
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

export class ChatAgent {
  private llm: ChatOpenAI;
  private memory: BaseMessage[] = []; // 1. Add back memory property

  constructor() {
    this.llm = new ChatOpenAI({ modelName: 'gpt-4o', temperature: 0.7 });
  }

  public async chat(
    message: string,
    imageUrl?: string, // 2. Remove history parameter
  ): Promise<{ agentInfo: AgentConfig; aiResponse: string }> {
    console.log(`[ChatAgent] Received chat request. Message: "${message}", Image URL: ${!!imageUrl}`);

    const selectedAgent = this.selectAgent(message);
    console.log(`[ChatAgent] Selected agent: ${selectedAgent.name}`);
    const systemMessage = new SystemMessage(selectedAgent.systemPrompt);

    const pastMessages = this.memory; // 3. Use internal memory

    // Correctly build the multi-modal message content
    const userMessageContent: MessageContentComplex[] = [{ type: "text", text: message }];
    if (imageUrl) {
      userMessageContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    }
    const userMessage = new HumanMessage({ content: userMessageContent });


    const messages: BaseMessage[] = [systemMessage, ...pastMessages, userMessage];

    // 4. 如果有图片，动态添加 tool call 相关参数
    const llmOptions: any = {};
    if (imageUrl) {
      llmOptions.tools = [analyzeImageTool];
      llmOptions.tool_choice = { type: "function", function: { name: "analyze_outfit_image" } };
      console.log('[ChatAgent] Image detected. Adding image analysis tool to LLM call.');
    }

    // 5. 第一次调用 LLM
    const firstResponse = await this.llm.invoke(messages, llmOptions);
    console.log('[ChatAgent] First LLM call complete.');

    // Check and handle tool_calls
    if (firstResponse.tool_calls && firstResponse.tool_calls.length > 0) {
      console.log("[ChatAgent] Tool call detected:", JSON.stringify(firstResponse.tool_calls, null, 2));
      const toolCall = firstResponse.tool_calls[0];

      // 3. Add a guard clause for the tool call ID
      if (!toolCall.id) {
        console.warn("Tool call received without an ID, returning direct response.");
        return {
          agentInfo: selectedAgent,
          aiResponse: firstResponse.content.toString(),
        };
      }

      const toolCallId = toolCall.id;
      const toolFunctionName = toolCall.name;
      const toolArgs = toolCall.args;

      // 在真实场景中，这里会调用一个真实的图片分析服务
      // 在MVP阶段，我们让LLM自己生成分析结果，然后将其作为Tool的输出
      // 这个 "output" 就是我们之前定义的schema格式的JSON
      const toolOutput = JSON.stringify(toolArgs);
      console.log(`[ChatAgent] Simulated tool output for "${toolFunctionName}":`, toolOutput);

      const toolMessage = new ToolMessage({
        tool_call_id: toolCallId,
        name: toolFunctionName,
        content: toolOutput,
      });

      // 7. 将 tool_call 的结果和原始请求一起再次发送给LLM
      const messagesForSecondCall: BaseMessage[] = [
        systemMessage,
        ...pastMessages,
        userMessage,
        firstResponse, // 包含 tool_call 请求的 AI 消息
        toolMessage,   // 包含 tool_call 结果的消息
      ];

      console.log('[ChatAgent] Making second LLM call with tool results...');
      const finalResponse = await this.llm.invoke(messagesForSecondCall);
      console.log('[ChatAgent] Second LLM call complete.');

      // 4. Update memory after tool call
      this.memory.push(userMessage);
      this.memory.push(finalResponse);

      return {
        agentInfo: selectedAgent,
        aiResponse: finalResponse.content.toString(),
      };
    }

    // 5. Update memory for simple response
    this.memory.push(userMessage);
    this.memory.push(firstResponse);

    console.log(`[ChatAgent] Responding with simple text. Length: ${firstResponse.content.toString().length}`);
    return {
      agentInfo: selectedAgent,
      aiResponse: firstResponse.content.toString(),
    };
  }

  private selectAgent(message: string): AgentConfig {
    return selectAgent(message);
  }
}