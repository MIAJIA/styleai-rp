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

// Add interface for Google Shopping API response
interface GoogleShoppingResult {
  position?: number;
  title: string;
  link?: string;
  product_id?: string;
  product_link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  delivery?: string;
  description?: string;
  second_hand_condition?: string;
}

interface GoogleShoppingResponse {
  shopping_results?: GoogleShoppingResult[];
  inline_shopping_results?: GoogleShoppingResult[];
  search_metadata?: {
    id: string;
    status: string;
    google_shopping_light_url: string;
    total_time_taken: number;
  };
  search_parameters?: {
    engine: string;
    q: string;
    location?: string;
    hl?: string;
    gl?: string;
  };
}

// Function to search Google Shopping Light API
async function searchGoogleShoppingLight(query: string, imageUrl?: string): Promise<{
  items: Array<{
    id: string;
    name: string;
    price: string;
    score: number;
    imageUrl: string;
    description?: string;
    link?: string;
    source?: string;
  }>;
  summary: string;
  searchType: string;
}> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.warn('[SearchAPI] SERPAPI_KEY not found, using mock data');
    return getMockSearchResults(query);
  }

  try {
    const searchQuery = query.trim();

    if (!searchQuery) {
      console.warn('[SearchAPI] Empty search query provided');
      return {
        items: [],
        summary: "Please provide a search query to find products.",
        searchType: "error"
      };
    }

    console.log(`[SearchAPI] Calling Google Shopping Light API for query: "${searchQuery}"`);

    // Construct the API URL with fixed US location settings
    const params = new URLSearchParams({
      engine: 'google_shopping_light',
      q: searchQuery,
      api_key: apiKey,
      hl: 'en',        // Language: English
      gl: 'us',        // Country: United States
      num: '5'        // Number of results
    });

    const apiUrl = `https://serpapi.com/search?${params.toString()}`;
    console.log(`[SearchAPI] API URL: ${apiUrl.replace(apiKey, 'HIDDEN_API_KEY')}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[SearchAPI] HTTP Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }

    const data: GoogleShoppingResponse = await response.json();

    // Comprehensive logging of API response structure
    console.log('=== GOOGLE SHOPPING API RESPONSE ANALYSIS ===');
    console.log(`[SearchAPI] Full response keys:`, Object.keys(data));

    if (data.search_metadata) {
      console.log(`[SearchAPI] Search Metadata:`, {
        id: data.search_metadata.id,
        status: data.search_metadata.status,
        total_time_taken: data.search_metadata.total_time_taken,
        url: data.search_metadata.google_shopping_light_url
      });
    }

    if (data.search_parameters) {
      console.log(`[SearchAPI] Search Parameters:`, data.search_parameters);
    }

    // Log shopping_results structure
    if (data.shopping_results) {
      console.log(`[SearchAPI] shopping_results found: ${data.shopping_results.length} items`);
      if (data.shopping_results.length > 0) {
        console.log(`[SearchAPI] First shopping_results item structure:`, {
          keys: Object.keys(data.shopping_results[0]),
          sample: {
            position: data.shopping_results[0].position,
            title: data.shopping_results[0].title?.substring(0, 50) + '...',
            price: data.shopping_results[0].price,
            source: data.shopping_results[0].source,
            thumbnail: data.shopping_results[0].thumbnail ? 'present' : 'missing',
            link: data.shopping_results[0].link ? 'present' : 'missing'
          }
        });
      }
    } else {
      console.log(`[SearchAPI] shopping_results: NOT FOUND`);
    }

    // Log inline_shopping_results structure
    if (data.inline_shopping_results) {
      console.log(`[SearchAPI] inline_shopping_results found: ${data.inline_shopping_results.length} items`);
      if (data.inline_shopping_results.length > 0) {
        console.log(`[SearchAPI] First inline_shopping_results item structure:`, {
          keys: Object.keys(data.inline_shopping_results[0]),
          sample: {
            position: data.inline_shopping_results[0].position,
            title: data.inline_shopping_results[0].title?.substring(0, 50) + '...',
            price: data.inline_shopping_results[0].price,
            source: data.inline_shopping_results[0].source,
            thumbnail: data.inline_shopping_results[0].thumbnail ? 'present' : 'missing',
            link: data.inline_shopping_results[0].link ? 'present' : 'missing'
          }
        });
      }
    } else {
      console.log(`[SearchAPI] inline_shopping_results: NOT FOUND`);
    }

    // Log any other interesting fields
    const otherFields = Object.keys(data).filter(key =>
      !['search_metadata', 'search_parameters', 'shopping_results', 'inline_shopping_results'].includes(key)
    );
    if (otherFields.length > 0) {
      console.log(`[SearchAPI] Other response fields:`, otherFields);
      otherFields.forEach(field => {
        console.log(`[SearchAPI] ${field}:`, typeof data[field as keyof GoogleShoppingResponse],
          Array.isArray(data[field as keyof GoogleShoppingResponse]) ?
            `(array with ${(data[field as keyof GoogleShoppingResponse] as any[])?.length} items)` : '');
      });
    }

    console.log('=== END API RESPONSE ANALYSIS ===');

    // Process the response
    const allResults: GoogleShoppingResult[] = [
      ...(data.shopping_results || []),
      ...(data.inline_shopping_results || [])
    ];

    console.log(`[SearchAPI] Total combined results: ${allResults.length}`);

    if (!allResults || allResults.length === 0) {
      console.warn('[SearchAPI] No results found in API response');
      return {
        items: [],
        summary: `No products found for "${query}". Try a different search term.`,
        searchType: "no_results"
      };
    }

    // Transform API results to our format
    const items = allResults.slice(0, 10).map((result, index) => {
      console.log(`[SearchAPI] Processing result ${index + 1}:`, {
        title: result.title?.substring(0, 30) + '...',
        price: result.price,
        rating: result.rating,
        thumbnail: result.thumbnail ? 'present' : 'missing',
        link: result.link ? 'present' : 'missing',
        product_link: result.product_link ? 'present' : 'missing',
        source: result.source
      });

      return {
        id: result.product_id || `shopping-${index}`,
        name: result.title,
        price: result.price || 'Price not available',
        score: result.rating || 4.0,
        imageUrl: result.thumbnail || '/placeholder-product.jpg',
        description: result.description || `${result.title} from ${result.source || 'unknown source'}`,
        link: result.link || result.product_link,
        source: result.source
      };
    });

    const summary = `Found ${items.length} products for "${query}" from Google Shopping US. Results include various US retailers with current pricing.`;

    console.log(`[SearchAPI] Successfully processed ${items.length} results from US market`);
    console.log(`[SearchAPI] Final items structure:`, items.map(item => ({
      id: item.id,
      name: item.name.substring(0, 30) + '...',
      price: item.price,
      hasImage: item.imageUrl !== '/placeholder-product.jpg',
      hasLink: !!item.link && item.link !== '#'
    })));

    console.log('[SearchAPI] SERPAPI result:', JSON.stringify(data, null, 2));

    return {
      items,
      summary,
      searchType: "google_shopping_us"
    };

  } catch (error) {
    console.error('[SearchAPI] Error calling Google Shopping Light API:', error);
    console.error('[SearchAPI] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });

    // Fallback to mock data on API error
    console.log('[SearchAPI] Falling back to mock data due to API error');
    return getMockSearchResults(query);
  }
}

// Mock search results as fallback
function getMockSearchResults(query: string) {
  const mockItems = [
    {
      id: "mock-1",
      name: `${query} - Premium Style`,
      price: "$89.99",
      score: 4.5,
      imageUrl: "/placeholder-product.jpg",
      description: `High-quality ${query} with premium materials`,
      link: "#",
      source: "Mock Store"
    },
    {
      id: "mock-2",
      name: `${query} - Classic Design`,
      price: "$59.99",
      score: 4.2,
      imageUrl: "/placeholder-product.jpg",
      description: `Classic ${query} with timeless appeal`,
      link: "#",
      source: "Mock Store"
    },
    {
      id: "mock-3",
      name: `${query} - Modern Collection`,
      price: "$129.99",
      score: 4.8,
      imageUrl: "/placeholder-product.jpg",
      description: `Modern ${query} from our latest collection`,
      link: "#",
      source: "Mock Store"
    }
  ];

  return {
    items: mockItems,
    summary: `Mock results for "${query}". Configure SERPAPI_KEY to use real Google Shopping data.`,
    searchType: "mock"
  };
}

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

  // Method: Add generated image to context (single image)
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

  // Method: Add multiple generated images to context
  public addGeneratedImagesToContext(imageUrls: string[]) {
    console.log(`[ChatAgent] Adding ${imageUrls.length} generated images to context:`, imageUrls);

    imageUrls.forEach((imageUrl, index) => {
      const message = index === 0
        ? '🎉 Your styling generation is complete! Here are your options:'
        : `Option ${index + 1}:`;

      this.contextManager.addMessage('ai', message, imageUrl, {
        type: 'style',
        name: 'Clara',
        emoji: '👗'
      });
    });

    console.log(`[ChatAgent] ${imageUrls.length} generated images added to context successfully`);
  }

  public async chat(
    message: string,
    imageUrl?: string,
  ): Promise<{ agentInfo: AgentConfig; aiResponse: string; searchResults?: any }> {
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

    let searchResults: any = null;

    if (firstResponse.tool_calls && firstResponse.tool_calls.length > 0) {
      console.log("[ChatAgent] Tool call detected:", JSON.stringify(firstResponse.tool_calls, null, 2));

      const toolMessages: ToolMessage[] = [];

      // Process all tool calls
      for (const toolCall of firstResponse.tool_calls) {
        if (!toolCall.id) {
          console.warn("Tool call received without an ID, skipping.");
          continue;
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
          console.log(`[ChatAgent] Executing Google Shopping Light API search for:`, toolArgs);

          try {
            const query = toolArgs.query || '';
            const imageUrl = toolArgs.imageUrl;

            if (!query.trim()) {
              console.warn('[ChatAgent] Empty search query provided');
              toolOutput = JSON.stringify({
                items: [],
                summary: "Please provide a search query to find products.",
                searchType: "error"
              });
            } else {
              // Call the real Google Shopping Light API
              const searchResultsData = await searchGoogleShoppingLight(query, imageUrl);
              searchResults = searchResultsData; // Store for return
              toolOutput = JSON.stringify(searchResultsData);
              console.log(`[ChatAgent] Google Shopping API search completed. Found ${searchResultsData.items.length} items.`);
            }

          } catch (error) {
            console.error('[ChatAgent] Google Shopping API search failed:', error);

            // Provide fallback response
            const fallbackResults = {
              items: [
                {
                  id: 'error_fallback',
                  name: `Search for "${toolArgs.query}" temporarily unavailable`,
                  price: 'N/A',
                  score: 0.0,
                  imageUrl: '/images/error-placeholder.jpg',
                  description: 'Please try again later or refine your search query',
                  link: '#',
                  source: 'System'
                }
              ],
              summary: `Unable to search for "${toolArgs.query}" at the moment. Please try again later.`,
              searchType: "error_fallback"
            };

            searchResults = fallbackResults; // Store fallback for return
            toolOutput = JSON.stringify(fallbackResults);
          }
        } else {
          console.warn(`[ChatAgent] Unknown tool function: ${toolFunctionName}`);
          toolOutput = JSON.stringify({ error: "Unknown tool function" });
        }

        const toolMessage = new ToolMessage({
          tool_call_id: toolCallId,
          name: toolFunctionName,
          content: toolOutput,
        });

        toolMessages.push(toolMessage);
      }

      // If we have no valid tool messages, return direct response
      if (toolMessages.length === 0) {
        console.warn("No valid tool messages created, returning direct response.");
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

      const messagesForSecondCall: BaseMessage[] = [
        systemMessage,
        userMessage,
        firstResponse,
        ...toolMessages, // Include all tool messages
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
        searchResults: searchResults,
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
