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

// 1. Define Agent configuration data structure
interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
  keywords: string[];
}

// 1. Define complete Schema for image analysis tool
const analyzeImageTool = {
  type: "function",
  function: {
    name: "analyze_outfit_image",
    // Original Chinese: "分析用户上传的穿搭照片，提取服装信息和风格特征用于专业建议。仅在用户上传了图片时使用此工具。"
    description: "Analyze user-uploaded outfit photos to extract clothing information and style features for professional advice. Only use this tool when the user has uploaded an image.",
    parameters: {
      type: "object",
      properties: {
        clothing_items: {
          type: "array",
          // Original Chinese: "识别到的具体服装单品（例如：白色T恤、蓝色牛仔裤、运动鞋）。"
          description: "Specific clothing items identified (e.g., white T-shirt, blue jeans, sneakers).",
          items: { type: "string" }
        },
        colors: {
          type: "array",
          // Original Chinese: "图片中的主要颜色（例如：米白色、天蓝色、深灰色）。"
          description: "Main colors in the image (e.g., off-white, sky blue, dark gray).",
          items: { type: "string" }
        },
        style_category: {
          type: "string",
          // Original Chinese: "对整体风格的分类（例如：休闲、商务、复古、街头）。"
          description: "Classification of overall style (e.g., casual, business, vintage, streetwear).",
        },
        fit_assessment: {
          type: "string",
          // Original Chinese: "对合身度的评估（例如：合身、宽松、修身）。"
          description: "Assessment of fit (e.g., fitted, loose, slim-fit)."
        },
        occasion_suitability: {
          type: "array",
          // Original Chinese: "这套穿搭适合的场合（例如：日常通勤、周末逛街、朋友聚会）。"
          description: "Occasions suitable for this outfit (e.g., daily commute, weekend shopping, friends gathering).",
          items: { type: "string" }
        },
      },
      required: ["clothing_items", "colors", "style_category", "occasion_suitability"]
    }
  }
};

// 2. Create Agent configuration constants
const AGENTS: Record<string, AgentConfig> = {
  style: {
    id: 'style',
    name: 'Xiao Ya', // Keep original Chinese name or use 'Style Assistant'
    emoji: '👗',
    // Original Chinese: '你是专业的穿搭顾问小雅，擅长整体造型建议和风格分析。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后基于分析结果和你的专业知识给出建议。'
    systemPrompt: 'You are Xiao Ya, a professional styling consultant who specializes in overall styling advice and style analysis. When users upload images, please use the `analyze_outfit_image` tool to assist your analysis, then provide recommendations based on the analysis results and your professional knowledge.',
    // Original Chinese keywords: ['穿搭', '搭配', '造型', '风格', '衣服', '服装', '时尚']
    keywords: ['穿搭', '搭配', '造型', '风格', '衣服', '服装', '时尚', 'outfit', 'styling', 'style', 'fashion', 'clothing', 'clothes', 'look'],
  },
  color: {
    id: 'color',
    name: 'Rainbow', // Keep original Chinese name or use 'Color Expert'
    emoji: '🎨',
    // Original Chinese: '你是色彩专家彩虹，专注于色彩搭配和色彩理论。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后重点从色彩搭配、肤色适配等角度给出专业建议。'
    systemPrompt: 'You are Rainbow, a color expert who focuses on color coordination and color theory. When users upload images, please use the `analyze_outfit_image` tool to assist your analysis, then provide professional advice focusing on color matching and skin tone compatibility.',
    // Original Chinese keywords: ['颜色', '色彩', '配色', '肤色', '色调', '色系']
    keywords: ['颜色', '色彩', '配色', '肤色', '色调', '色系', 'color', 'colors', 'palette', 'tone', 'hue', 'shade', 'skin tone'],
  },
  occasion: {
    id: 'occasion',
    name: 'Occasion Expert', // Keep original Chinese name or use 'Occasion Expert'
    emoji: '📅',
    // Original Chinese: '你是场合专家场合，精通不同场合的着装要求。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后重点评估这套穿搭的场合适配性。'
    systemPrompt: 'You are an Occasion Expert, specializing in dress code requirements for different occasions. When users upload images, please use the `analyze_outfit_image` tool to assist your analysis, then focus on evaluating the occasion suitability of the outfit.',
    // Original Chinese keywords: ['约会', '上班', '工作', '聚会', '场合', '婚礼', '面试', '职场', '正式', '休闲']
    keywords: ['约会', '上班', '工作', '聚会', '场合', '婚礼', '面试', '职场', '正式', '休闲', 'date', 'work', 'office', 'party', 'occasion', 'wedding', 'interview', 'workplace', 'formal', 'casual'],
  },
};

// 3. Create Agent selection function
const selectAgent = (userMessage: string): AgentConfig => {
  const message = userMessage.toLowerCase();
  let bestAgentId = 'style'; // Default
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

  // New method: Add generated image to context
  public addGeneratedImageToContext(imageUrl: string) {
    console.log('[ChatAgent] Adding generated image to context:', imageUrl);

    // Add AI-generated image message to context
    // Original Chinese: '🎉 您的穿搭生成已完成！'
    this.contextManager.addMessage('ai', '🎉 Your styling generation is complete!', imageUrl, {
      type: 'style',
      name: 'Xiao Ya',
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

    // Check if there's an image - current message or context image
    const hasCurrentImage = !!imageUrl;
    const hasContextImage = this.contextManager.hasRecentImage();
    const shouldUseImageTool = hasCurrentImage || hasContextImage;

    if (hasCurrentImage) {
      userMessageContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } else if (hasContextImage && needsContext) {
      // If current message has no image but context has image, add context image
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