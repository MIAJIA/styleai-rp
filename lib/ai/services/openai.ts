import OpenAI from "openai";
import { systemPrompt, IMAGE_GENERATION_MODEL, IMAGE_FORMAT_DESCRIPTION, STRICT_REALISM_PROMPT_BLOCK } from "@/lib/prompts";
import {
  type StyleSuggestionInput,
  styleSuggestionsSchema,
} from "../types";
import { calculateImageTokens, formatBytes } from "../utils";
import { type OnboardingData } from "@/lib/onboarding-storage";
import { z } from 'zod';
import zodToJsonSchema from "zod-to-json-schema";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔍 统一日志前缀
const OPENAI_LOG_PREFIX = '🤖 [OPENAI]';
const TOKEN_LOG_PREFIX = '🤖📊 [OPENAI_TOKEN]';
const IMAGE_LOG_PREFIX = '🤖🖼️ [OPENAI_IMAGE]';

interface GetStyleSuggestionOptions {
  count?: number;
}

export async function getStyleSuggestionFromAI(
  {
    humanImageUrl,
    garmentImageUrl,
    occasion,
    userProfile,
    stylePrompt, // 🔍 新增：接收 stylePrompt 参数
  }: StyleSuggestionInput,
  options: GetStyleSuggestionOptions = {}
): Promise<any[]> {
  const { count = 1 } = options;

  if (!humanImageUrl || !garmentImageUrl || !occasion) {
    throw new Error("Missing required inputs for style suggestion.");
  }

  console.log(`${TOKEN_LOG_PREFIX} ===== STARTING IMAGE PROCESSING ANALYSIS =====`);
  console.log(`${OPENAI_LOG_PREFIX} Using image generation model: ${IMAGE_GENERATION_MODEL}`);

  // 🔍 LOG: 确认 stylePrompt 接收
  console.log(`${OPENAI_LOG_PREFIX} 🎯 Received stylePrompt:`, stylePrompt ? 'YES' : 'NO');
  if (stylePrompt) {
    console.log(`${OPENAI_LOG_PREFIX} 📝 StylePrompt content (first 150 chars):`, stylePrompt.substring(0, 150));
  }

  // do not change userProfile, only update the log, do not need to log the fullbodyphoto in userProfile
  const userProfileForLog = { ...userProfile } as Partial<OnboardingData>;
  if (userProfileForLog?.fullBodyPhoto) {
    userProfileForLog.fullBodyPhoto = '***';
  }

  console.log(`${OPENAI_LOG_PREFIX} Received userProfile for suggestion:`, JSON.stringify(userProfileForLog, null, 2));
  console.log(`${IMAGE_LOG_PREFIX} 👤 Using Human Image URL: ${humanImageUrl}`);
  console.log(`${IMAGE_LOG_PREFIX} 👔 Using Garment Image URL: ${garmentImageUrl}`);

  try {
    // ⚠️ ⚠️⚠️TODO: Optimize user profile data for AI.
    // Instead of sending the entire raw JSON object, create a concise, human-readable
    // summary of the user's profile (e.g., body type, style preferences, skin tone).
    // This will significantly reduce token consumption and improve AI comprehension.
    // This optimization is pending a planned refactor of the OnboardingData structure.
    const userProfileSection = ""; // Temporarily disabled to reduce tokens

    // Build enhanced essential item details with context
    const essentialItemSection = `# Essential Item
The garment in the second attached image is the "Essential Item" that must be incorporated into the outfit suggestion.

**Item Context:**
- This is the key piece that the user wants to style around
- Consider the item's style, color, fabric, and formality level when building the complete outfit`;

    // 🔍 更新：Build occasion details with styling context and specific stylePrompt
    const occasionSection = stylePrompt
      ? `# Occasion & Scene Details
**Event/Setting:** ${occasion}

**Visual Scene Description:** ${stylePrompt}

**Styling Goal:** Choose complementary pieces that match the formality and mood of this occasion. Use the visual scene description above to inform the atmosphere, lighting, and overall aesthetic for the image_prompt generation.`
      : `# Occasion
**Event/Setting:** ${occasion}

**Styling Goal:** Choose complementary pieces that match the formality and mood of this occasion`;

    // 🔍 LOG: 确认 occasionSection 构建
    console.log(`${OPENAI_LOG_PREFIX} 🎨 OccasionSection built with stylePrompt:`, stylePrompt ? 'YES' : 'NO');
    if (stylePrompt) {
      console.log(`${OPENAI_LOG_PREFIX} 📄 OccasionSection content:`, occasionSection);
    }

    // Build enhanced style preference details based on user profile and occasion
    const getStylePreferences = () => {
      const basePreferences = `Create a stylish and flattering outfit that incorporates the essential item for the specified occasion.`;

      // Add user-specific styling guidance if profile exists
      if (userProfile) {
        const bodyTypeGuidance = userProfile.aiAnalysis?.bodyType
          ? `Focus on silhouettes that flatter a ${userProfile.aiAnalysis.bodyType} body type.`
          : '';

        const stylePersonalityGuidance = userProfile.stylePreferences?.length
          ? `Align with the user's style preferences: ${userProfile.stylePreferences.join(', ')}`
          : '';

        const customStyleGuidance = userProfile.customStyle && userProfile.customStyle.trim()
          ? `user's style notes: ${userProfile.customStyle.trim()}`
          : '';

        // Combine style guidance into one sentence
        const combinedStyleGuidance = [stylePersonalityGuidance, customStyleGuidance]
          .filter(Boolean)
          .join(' and ') + (stylePersonalityGuidance || customStyleGuidance ? '.' : '');

        return `${basePreferences} ${bodyTypeGuidance} ${combinedStyleGuidance} Emphasize creating a cohesive look that enhances the user's natural features and builds confidence.`;
      }

      return `${basePreferences} Focus on creating a cohesive look that enhances the user's features and suits the context.`;
    };

    const stylePreferenceSection = `# Style Preference
${getStylePreferences()}`;

    const userMessageText = `Please provide styling suggestions based on the following information. My photo is the first image, and the garment is the second.

**IMPORTANT: Please first analyze the person in the first image to determine their gender/presentation style, then design the outfit accordingly for masculine or feminine styling as appropriate.**

${userProfileSection}

${essentialItemSection}

${occasionSection}

${stylePreferenceSection}

**Styling Instructions:**
- Generate ${count} different and distinct styling suggestions. Each suggestion should explore a unique style direction (e.g., one classic, one trendy, one edgy).
- For each suggestion, analyze the person's gender presentation from the first image and design the complete outfit to match their masculine or feminine style preferences.
- Ensure all clothing items, accessories, and styling choices are appropriate for their gender presentation.
- Each outfit should feel natural and authentic to how they present themselves.`;

    // 🔍 LOG: Final token estimation including text
    const textTokenEstimate = Math.ceil(userMessageText.length / 4); // Rough estimate: 4 chars per token
    const systemPromptTokens = Math.ceil(systemPrompt.length / 4);
    const totalRequestTokens = textTokenEstimate + systemPromptTokens; // No image tokens to add here

    console.log(`${TOKEN_LOG_PREFIX} === FINAL REQUEST ANALYSIS ===`);
    console.log(`${TOKEN_LOG_PREFIX} 📝 User Message Tokens: ~${textTokenEstimate.toLocaleString()}`);
    console.log(`${TOKEN_LOG_PREFIX} 🔧 System Prompt Tokens: ~${systemPromptTokens.toLocaleString()}`);
    console.log(`${TOKEN_LOG_PREFIX} 🎯 TOTAL REQUEST TOKENS: ~${totalRequestTokens.toLocaleString()}`);

    // 🔍 NEW: 输出完整的 System Prompt 和 User Message
    console.log(`${OPENAI_LOG_PREFIX} ===== COMPLETE SYSTEM PROMPT =====`);
    console.log(`${OPENAI_LOG_PREFIX} 📝 SYSTEM PROMPT:`, systemPrompt);
    console.log(`${OPENAI_LOG_PREFIX} ===== COMPLETE USER MESSAGE =====`);
    console.log(`${OPENAI_LOG_PREFIX} 📝 USER MESSAGE:`, userMessageText);

    // --- NEW: Dynamically create the schema based on the count ---
    const multiSuggestionSchema = z.object({
      suggestions: z.array(styleSuggestionsSchema).min(1).max(5),
    });
    const multiSuggestionJsonSchema = zodToJsonSchema(multiSuggestionSchema);
    // --- END NEW ---

    // 🔍 NEW: 构建完整的请求体用于日志
    const requestBody = {
      model: "gpt-4o" as const,
      messages: [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: userMessageText,
            },
            {
              type: "image_url" as const,
              image_url: {
                url: humanImageUrl, // ✨ Use direct URL
                detail: "low" as const
              },
            },
            {
              type: "image_url" as const,
              image_url: {
                url: garmentImageUrl, // ✨ Use direct URL
                detail: "low" as const
              },
            },
          ],
        },
      ],
      max_tokens: 6000, // 🔍 FIX: 增加 token 限制，防止响应被截断
      tools: [
        {
          type: "function" as const,
          function: {
            name: "get_multiple_style_suggestions",
            description: `Get ${count} complete and distinct outfit suggestions in a structured JSON format. The image_prompt field is highly recommended for best results.`,
            parameters: multiSuggestionJsonSchema,
          },
        },
      ],
      tool_choice: {
        type: "function" as const,
        function: { name: "get_multiple_style_suggestions" },
      },
    };

    // 🔍 NEW: 输出完整的请求体（但隐藏图片URL以避免日志过长）
    const requestBodyForLog = {
      ...requestBody,
      messages: requestBody.messages.map(msg => {
        if (msg.role === 'user' && Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map(item => {
              if (item.type === 'image_url' && item.image_url) {
                return {
                  ...item,
                  image_url: {
                    ...item.image_url,
                    url: `${item.image_url.url.substring(0, 50)}...` // 只显示前50个字符
                  }
                };
              }
              return item;
            })
          };
        }
        return msg;
      })
    };

    console.log(`${OPENAI_LOG_PREFIX} ===== COMPLETE REQUEST BODY =====`);
    console.log(`${OPENAI_LOG_PREFIX} 📤 FULL REQUEST:`, JSON.stringify(requestBodyForLog, null, 2));
    console.log(`${TOKEN_LOG_PREFIX} ===== SENDING REQUEST TO OPENAI =====`);

    const response = await openai.chat.completions.create(requestBody);

    console.log(`${TOKEN_LOG_PREFIX} ===== OPENAI RESPONSE RECEIVED =====`);
    console.log(`${TOKEN_LOG_PREFIX} 📊 Response usage:`, response.usage);
    console.log(`${TOKEN_LOG_PREFIX} 📊 Finish reason:`, response.choices[0].finish_reason);

    // 🔍 FIX: 检查是否因为 token 限制被截断
    if (response.choices[0].finish_reason === 'length') {
      console.warn(`${TOKEN_LOG_PREFIX} ⚠️ RESPONSE TRUNCATED DUE TO TOKEN LIMIT!`);
      console.warn(`${TOKEN_LOG_PREFIX} ⚠️ This is likely why image_prompt is missing. Consider increasing max_tokens or reducing input length.`);
    }

    const message = response.choices[0].message;

    // 🔍 NEW: 输出完整的响应消息
    console.log(`${OPENAI_LOG_PREFIX} ===== COMPLETE RESPONSE MESSAGE =====`);
    console.log(`${OPENAI_LOG_PREFIX} 📥 FULL RESPONSE MESSAGE:`, JSON.stringify(message, null, 2));

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.error(`${OPENAI_LOG_PREFIX} ❌ OpenAI response did not include a tool call. Finish reason:`, response.choices[0].finish_reason);
      throw new Error(`AI did not return a structured suggestion. Finish reason: ${response.choices[0].finish_reason}`);
    }

    const toolCall = message.tool_calls[0];

    if (toolCall.function.name !== 'get_multiple_style_suggestions') {
      console.error(`${OPENAI_LOG_PREFIX} ❌ Unexpected tool call: ${toolCall.function.name}`);
      throw new Error(`AI returned an unexpected tool: ${toolCall.function.name}`);
    }

    // --- FIX: Use Zod to parse and validate the AI's output ---
    const unsafeResult = JSON.parse(toolCall.function.arguments);
    console.log(`${OPENAI_LOG_PREFIX} 🔍 RAW AI RESPONSE:`, JSON.stringify(unsafeResult, null, 2));

    let validatedResult;
    try {
      validatedResult = multiSuggestionSchema.parse(unsafeResult); // This will throw a detailed error if the schema is not met
      console.log(`${OPENAI_LOG_PREFIX} ✅ Zod validation successful`);

    } catch (zodError) {
      console.error(`${OPENAI_LOG_PREFIX} 💥 ZOD VALIDATION FAILED:`, zodError);
      throw zodError;
    }
    // --- END FIX ---

    console.log(`${OPENAI_LOG_PREFIX} ✅ OpenAI Suggestion:`, JSON.stringify(validatedResult, null, 2));
    console.log(`${TOKEN_LOG_PREFIX} ===== IMAGE PROCESSING ANALYSIS COMPLETE =====`);

    // The result from the tool is an object with a "suggestions" property, which is the array we want.
    return validatedResult.suggestions.slice(0, count);

  } catch (error) {
    console.error(`${OPENAI_LOG_PREFIX} 🚨 Error getting style suggestion from OpenAI:`, error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
}