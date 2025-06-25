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

// 2. Define search tool Schema for fashion items and trends
const searchTool = {
  type: "function",
  function: {
    name: "search_fashion_items",
    // Original Chinese: "在内部商品库或时尚数据库中搜索相关的服装、配饰或潮流信息。当用户想寻找特定物品、类似款式或查询最新潮流时使用。"
    description: "Search for clothing, accessories, or fashion trend information in our internal product database. Use when users want to find specific items, similar styles, or query latest trends.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          // Original Chinese: "用户的搜索查询文本，例如：'80年代复古风格的牛仔夹克' 或 '夏季沙滩派对穿搭'。"
          description: "User's search query text, e.g., '80s vintage style denim jacket' or 'summer beach party outfit'.",
        },
        imageUrl: {
          type: "string",
          // Original Chinese: "（可选）用户提供的图片URL，用于以图搜图，寻找相似款式的商品。"
          description: "(Optional) User-provided image URL for visual similarity search to find similar style products.",
        }
      },
      required: ["query"],
    }
  }
};

// 2. Create Agent configuration constants
const AGENTS: Record<string, AgentConfig> = {
  style: {
    id: 'style',
    name: 'Clara', // Updated from 'Xiao Ya' to 'Clara'
    emoji: '👗',
    // Original Chinese: '你是专业的穿搭顾问小雅，擅长整体造型建议和风格分析。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后基于分析结果和你的专业知识给出建议。'
    systemPrompt: `👗 Clara – Personal Style Consultant

You are Clara, a warm, elegant, and highly skilled fashion stylist trained in international aesthetics and body-aware styling. You help users define and refine their personal style based on their body type, facial features, lifestyle, and vibe.

Tone & Personality: Friendly and graceful, like a stylish best friend who knows what works but never talks down.

Interaction Style: This is a chat, not a report. Start with the most relevant styling takeaways in a clear and approachable tone. If the user is interested, you can dive into deeper analysis or explain your logic further.

Key Behaviors:
• Prioritize quick, useful style suggestions users can act on.
• Offer visual language (e.g., "try a high-waisted A-line skirt to highlight your waist").
• Invite the user to ask for more details if they're curious.

Tool Usage:
• When users upload images, use the \`analyze_outfit_image\` tool to assist your analysis, then provide recommendations based on the analysis results and your professional knowledge.
• When users want to find specific items, similar styles, or ask for shopping recommendations (e.g., "help me find...", "where can I get...", "show me some..."), use the \`search_fashion_items\` tool to search our product database, then provide personalized recommendations based on the results.

➤ Always prioritize actionable takeaways in a friendly tone. This is a conversation—not a report. Keep it focused and approachable, and expand only if the user asks.`,
    // Original Chinese keywords: ['穿搭', '搭配', '造型', '风格', '衣服', '服装', '时尚']
    keywords: ['穿搭', '搭配', '造型', '风格', '衣服', '服装', '时尚', 'outfit', 'styling', 'style', 'fashion', 'clothing', 'clothes', 'look'],
  },
  color: {
    id: 'color',
    name: 'Iris', // Updated from 'Rainbow' to 'Iris'
    emoji: '🎨',
    // Original Chinese: '你是色彩专家彩虹，专注于色彩搭配和色彩理论。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后重点从色彩搭配、肤色适配等角度给出专业建议。'
    systemPrompt: `🎨 Iris – Color & Palette Expert

You are Iris, a bright, intuitive color expert who helps users discover what shades bring out their natural radiance. You specialize in undertone analysis, seasonal palettes, and joyful color combinations.

Tone & Personality: Expressive, uplifting, and a bit artistic—like a creative friend who always sees beauty where others don't.

Interaction Style: Keep it conversational and focused. Start with the top 1–2 color insights that will help the user most. Only go into color theory or extended palette logic if they ask.

Key Behaviors:
• Don't overwhelm—lead with a clear, empowering takeaway.
• Use vivid, sensory language to make colors feel tangible and exciting.
• Let curiosity drive the deeper dive.

Tool Usage:
• When users upload images, use the \`analyze_outfit_image\` tool to assist your analysis, then provide professional advice focusing on color matching and skin tone compatibility.
• When users ask for color-specific items or want to find products in certain shades (e.g., "find me a coral blouse", "show me burgundy accessories"), use the \`search_fashion_items\` tool to find matching products, then provide color advice based on the results.

➤ Always prioritize actionable takeaways in a friendly tone. This is a conversation—not a report. Keep it focused and approachable, and expand only if the user asks.`,
    // Original Chinese keywords: ['颜色', '色彩', '配色', '肤色', '色调', '色系']
    keywords: ['颜色', '色彩', '配色', '肤色', '色调', '色系', 'color', 'colors', 'palette', 'tone', 'hue', 'shade', 'skin tone'],
  },
  occasion: {
    id: 'occasion',
    name: 'Julian', // Updated from 'Occasion Expert' to 'Julian'
    emoji: '🗓️',
    // Original Chinese: '你是场合专家场合，精通不同场合的着装要求。当用户上传图片时，请使用`analyze_outfit_image`工具来辅助你进行分析，然后重点评估这套穿搭的场合适配性。'
    systemPrompt: `🗓️ Julian – Occasion & Etiquette Stylist

You are Julian, a culturally fluent, polished, and witty style strategist who helps users dress appropriately—and stylishly—for any occasion. You understand social nuance, dress codes, weather, and modern context.

Tone & Personality: Tactful but charming, like a lifestyle-savvy friend who helps you "get the vibe right" without overthinking.

Interaction Style: Don't deliver a full essay. In chat, start with your sharpest outfit recommendation or key insight. Offer to explain further or adapt if the user needs more context.

Key Behaviors:
• Focus on relevance: What should they wear, and why?
• Clarify formality and styling with minimal jargon.
• Let the user steer deeper exploration if they want.

Tool Usage:
• When users upload images, use the \`analyze_outfit_image\` tool to assist your analysis, then focus on evaluating the occasion suitability of the outfit.
• When users ask for occasion-specific recommendations (e.g., "what should I wear to...", "help me find something for..."), use the \`search_fashion_items\` tool to find appropriate items, then provide occasion-specific styling advice based on the results.

➤ Always prioritize actionable takeaways in a friendly tone. This is a conversation—not a report. Keep it focused and approachable, and expand only if the user asks.`,
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
      name: 'Clara',
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
      llmOptions.tools = [analyzeImageTool, searchTool]; // Provide both tools when image is available
      console.log('[ChatAgent] Image detected (current or context). Adding image analysis and search tools to LLM call.');
    } else {
      llmOptions.tools = [searchTool]; // Only search tool when no image
      console.log('[ChatAgent] No image detected. Adding search tool to LLM call.');
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
      let toolOutput = "";

      // Handle different tool calls
      if (toolFunctionName === "analyze_outfit_image") {
        console.log(`[ChatAgent] Executing image analysis for outfit analysis`);
        toolOutput = JSON.stringify(toolArgs);
      }
      else if (toolFunctionName === "search_fashion_items") {
        console.log(`[ChatAgent] Executing MOCK search for:`, toolArgs);
        // Mock search results based on query content
        const query = toolArgs.query?.toLowerCase() || '';
        const imageUrl = toolArgs.imageUrl;

        let mockSearchResults;

        // Generate different mock results based on query content
        if (query.includes('jacket') || query.includes('夹克') || query.includes('外套')) {
          mockSearchResults = {
            items: [
              {
                id: 'jacket001',
                name: 'Vintage Denim Jacket',
                price: '$89',
                score: 0.95,
                imageUrl: '/images/mock-denim-jacket.jpg',
                description: 'Classic 80s-inspired denim jacket with perfect fading'
              },
              {
                id: 'jacket002',
                name: 'Oversized Blazer',
                price: '$129',
                score: 0.88,
                imageUrl: '/images/mock-blazer.jpg',
                description: 'Contemporary oversized blazer in neutral tones'
              },
            ],
            summary: "Found 2 highly matching jackets that fit your style preferences.",
            searchType: imageUrl ? "visual_similarity" : "text_search"
          };
        } else if (query.includes('dress') || query.includes('裙子') || query.includes('连衣裙')) {
          mockSearchResults = {
            items: [
              {
                id: 'dress001',
                name: 'Midi Wrap Dress',
                price: '$75',
                score: 0.92,
                imageUrl: '/images/mock-wrap-dress.jpg',
                description: 'Flattering wrap style in flowing fabric'
              },
              {
                id: 'dress002',
                name: 'A-Line Summer Dress',
                price: '$65',
                score: 0.89,
                imageUrl: '/images/mock-summer-dress.jpg',
                description: 'Light and breezy for warm weather occasions'
              },
            ],
            summary: "Found 2 beautiful dresses perfect for your occasions.",
            searchType: imageUrl ? "visual_similarity" : "text_search"
          };
        } else if (query.includes('color') || query.includes('颜色') || query.includes('coral') || query.includes('burgundy')) {
          mockSearchResults = {
            items: [
              {
                id: 'color001',
                name: 'Coral Silk Blouse',
                price: '$95',
                score: 0.94,
                imageUrl: '/images/mock-coral-blouse.jpg',
                description: 'Vibrant coral that complements warm undertones'
              },
              {
                id: 'color002',
                name: 'Burgundy Cashmere Sweater',
                price: '$145',
                score: 0.91,
                imageUrl: '/images/mock-burgundy-sweater.jpg',
                description: 'Rich burgundy perfect for autumn styling'
              },
            ],
            summary: "Found 2 items in your requested color palette.",
            searchType: "color_focused"
          };
        } else {
          // Default/general search results
          mockSearchResults = {
            items: [
              {
                id: 'trend001',
                name: 'Trending Knit Top',
                price: '$55',
                score: 0.87,
                imageUrl: '/images/mock-knit-top.jpg',
                description: 'On-trend textured knit in versatile styling'
              },
              {
                id: 'trend002',
                name: 'Statement Accessories Set',
                price: '$35',
                score: 0.84,
                imageUrl: '/images/mock-accessories.jpg',
                description: 'Curated accessories to elevate any outfit'
              },
            ],
            summary: "Found 2 trending items that match your search.",
            searchType: "general_search"
          };
        }

        toolOutput = JSON.stringify(mockSearchResults);
        console.log(`[ChatAgent] Mock search completed. Returned ${mockSearchResults.items.length} items.`);
      } else {
        console.warn(`[ChatAgent] Unknown tool function: ${toolFunctionName}`);
        toolOutput = JSON.stringify({ error: "Unknown tool function" });
      }

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