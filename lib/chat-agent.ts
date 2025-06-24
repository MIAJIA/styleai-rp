import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
  MessageContentComplex,
} from '@langchain/core/messages';
import { SmartContextManager } from './memory';

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
  private contextManager: SmartContextManager;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
    });
    this.contextManager = new SmartContextManager();
  }

  // 新增方法：添加生成的图片到上下文
  public addGeneratedImageToContext(imageUrl: string) {
    console.log('[ChatAgent] Adding generated image to context:', imageUrl);

    // 添加AI生成的图片消息到上下文
    this.contextManager.addMessage('ai', '🎉 您的穿搭生成已完成！', imageUrl, {
      type: 'style',
      name: '小雅',
      emoji: '👗'
    });

    console.log('[ChatAgent] Generated image added to context successfully');
  }

  public async chat(
    message: string,
    imageUrl?: string,
  ): Promise<{ agentInfo: AgentConfig; aiResponse: string }> {
    console.log(`[ChatAgent] Processing message with context awareness`);

    this.contextManager.addMessage('user', message, imageUrl);

    const needsContext = this.contextManager.shouldIncludeContext(message);
    console.log(`[ChatAgent] Needs context: ${needsContext}`);

    const selectedAgent = this.selectAgent(message, !!imageUrl);
    console.log(`[ChatAgent] Selected agent: ${selectedAgent.name}`);

    let systemPrompt = selectedAgent.systemPrompt;
    if (needsContext) {
      const contextPrompt = this.contextManager.generateContextPrompt();
      systemPrompt += contextPrompt;
      console.log('[ChatAgent] Including conversation context in prompt');
    }
    console.log(`[ChatAgent] Final system prompt: ${systemPrompt}`);
    const systemMessage = new SystemMessage(systemPrompt);

    const userMessageContent: MessageContentComplex[] = [{ type: "text", text: message }];

    // 检查是否有图片 - 当前消息或上下文中的图片
    const hasCurrentImage = !!imageUrl;
    const hasContextImage = this.contextManager.hasRecentImage();
    const shouldUseImageTool = hasCurrentImage || hasContextImage;

    if (hasCurrentImage) {
      userMessageContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } else if (hasContextImage && needsContext) {
      // 如果当前消息没有图片但上下文有图片，添加上下文中的图片
      const contextImageUrl = this.contextManager.getLastUploadedImage();
      if (contextImageUrl) {
        userMessageContent.push({
          type: "image_url",
          image_url: { url: contextImageUrl },
        });
        console.log('[ChatAgent] Adding context image to current message for analysis');
      }
    }

    const userMessage = new HumanMessage({ content: userMessageContent });
    const messages: BaseMessage[] = [systemMessage, userMessage];

    const llmOptions: any = {};
    if (shouldUseImageTool) {
      llmOptions.tools = [analyzeImageTool];
      llmOptions.tool_choice = { type: "function", function: { name: "analyze_outfit_image" } };
      console.log('[ChatAgent] Image detected (current or context). Adding image analysis tool to LLM call.');
    }

    const firstResponse = await this.llm.invoke(messages, llmOptions);
    console.log('[ChatAgent] First LLM call complete.');

    if (firstResponse.tool_calls && firstResponse.tool_calls.length > 0) {
      console.log("[ChatAgent] Tool call detected:", JSON.stringify(firstResponse.tool_calls, null, 2));
      const toolCall = firstResponse.tool_calls[0];

      if (!toolCall.id) {
        console.warn("Tool call received without an ID, returning direct response.");
        this.contextManager.addMessage('ai', firstResponse.content.toString(), undefined, {
          type: selectedAgent.id,
          name: selectedAgent.name,
          emoji: selectedAgent.emoji
        });
        return {
          agentInfo: selectedAgent,
          aiResponse: firstResponse.content.toString(),
        };
      }

      const toolCallId = toolCall.id;
      const toolFunctionName = toolCall.name;
      const toolArgs = toolCall.args;
      const toolOutput = JSON.stringify(toolArgs);
      console.log(`[ChatAgent] Simulated tool output for "${toolFunctionName}":`, toolOutput);

      const toolMessage = new ToolMessage({
        tool_call_id: toolCallId,
        name: toolFunctionName,
        content: toolOutput,
      });

      const messagesForSecondCall: BaseMessage[] = [
        systemMessage,
        userMessage,
        firstResponse,
        toolMessage,
      ];

      console.log('[ChatAgent] Making second LLM call with tool results...');
      const finalResponse = await this.llm.invoke(messagesForSecondCall);
      console.log('[ChatAgent] Second LLM call complete.');

      this.contextManager.addMessage('ai', finalResponse.content.toString(), undefined, {
        type: selectedAgent.id,
        name: selectedAgent.name,
        emoji: selectedAgent.emoji
      });

      return {
        agentInfo: selectedAgent,
        aiResponse: finalResponse.content.toString(),
      };
    }

    this.contextManager.addMessage('ai', firstResponse.content.toString(), undefined, {
      type: selectedAgent.id,
      name: selectedAgent.name,
      emoji: selectedAgent.emoji
    });

    console.log(`[ChatAgent] Responding with simple text. Length: ${firstResponse.content.toString().length}`);
    return {
      agentInfo: selectedAgent,
      aiResponse: firstResponse.content.toString(),
    };
  }

  private selectAgent(message: string, hasImage?: boolean): AgentConfig {
    // Note: The original logic in the file did not use hasImage, so I'm keeping it that way.
    // The design doc says "现有的Agent选择逻辑保持不变"
    return selectAgent(message);
  }
}