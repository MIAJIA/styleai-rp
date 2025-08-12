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

// 🔧 HELPER: Generate fallback image prompt when AI doesn't provide one
function generateFallbackImagePrompt(outfitSuggestion: any): string {
  const { outfit_title, items } = outfitSuggestion;

  // Build a basic outfit description from the items
  const outfitParts: string[] = [];

  if (items.tops && items.tops.length > 0) {
    const topNames = items.tops.map((top: any) => top.item_name).join(' and ');
    outfitParts.push(topNames);
  }

  if (items.bottoms) {
    outfitParts.push(items.bottoms.item_name);
  }

  if (items.shoes) {
    outfitParts.push(items.shoes.item_name);
  }

  if (items.bag) {
    outfitParts.push(items.bag.item_name);
  }


  const outfitDescription = outfitParts.join(', ');

  return `A stylish person wearing ${outfitDescription}. The outfit is titled "${outfit_title}". Full-body fashion photography in a natural, well-lit setting with a clean background. The image captures the complete look with attention to detail and styling.`;
}

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
    customPrompt, // 🔍 新增：接收 customPrompt 参数
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

  // 🔍 LOG: 确认 customPrompt 接收
  console.log(`${OPENAI_LOG_PREFIX} 🎯 Received customPrompt:`, customPrompt ? 'YES' : 'NO');
  if (customPrompt) {
    console.log(`${OPENAI_LOG_PREFIX} 📝 CustomPrompt content (first 150 chars):`, customPrompt.substring(0, 150));
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
    const userProfileSection = `# User Profile
Analyze the user's ethnicity, skin tone, body type, body size, and face shape in the first attached image.
Make sure the outfit recommendations are suitable for the user, helping them to highlight their strengths and downplay their weaknesses.
`; // Updated to use actual analysis instead of being temporarily disabled

    // Build enhanced essential item details with context
    const essentialItemSection = `# KEY PIECE
Analyze the Key Piece's style, color, material, silhouette and formality level in the second attached image.
Build the outfit around this "KEY PIECE" and make sure the KEY PIECE must be incorporated into the outfit suggestion.
`;

    const occasionSection = stylePrompt
      ? `# Occasion & Scene Details
Build the outfit for ${occasion}. The styling guidelines are ${stylePrompt}.
Make sure the outfit is suitable for the occasion and meet the styling guidelines.`
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

    // 🔍 NEW: Build user requirement section if customPrompt exists
    const userRequirementSection = customPrompt && customPrompt.trim()
      ? `
**User's Requirement:** User's requirement is ${customPrompt.trim()}. Besides the key piece, consider the user's requirement when putting together the outfit.`
      : '';

    const userMessageText = `Please provide styling suggestions based on the following information. User's photo is the first image, and the Key Piece user wants to style is the second.

**IMPORTANT: Please first analyze the user in the first image to understand the user's features, then build the outfit around the Key Piece in the second image according to the user's features and the occasion.**

${userProfileSection}

${essentialItemSection}

${occasionSection}

${stylePreferenceSection}${userRequirementSection}

**Styling Instructions:**
- Generate ${count} different and distinct styling suggestions. Each suggestion should feature a distinct style and color strategy that suits the user and complements the key piece for the occasion.
`;
    const systemPromptV5 = systemPrompt.replace("#{userprofile_bodytype}",userProfile?.bodyType)
    .replace("#{userprofile_bodysize}",userProfile?.bodyStructure)
    .replace("#{userprofile_skintone}",userProfile?.skinTone)
    .replace("#{userprofile_faceshape}",userProfile?.faceShape)
    .replace("#{style_preference_details}",String(userProfile?.selectedStyles))
    // 🔍 LOG: Final token estimation including text
    const textTokenEstimate = Math.ceil(userMessageText.length / 4); // Rough estimate: 4 chars per token
    const systemPromptTokens = Math.ceil(systemPromptV5.length / 4);
    const totalRequestTokens = textTokenEstimate + systemPromptTokens; // No image tokens to add here

    console.log(`${TOKEN_LOG_PREFIX} === FINAL REQUEST ANALYSIS ===`);
    console.log(`${TOKEN_LOG_PREFIX} 📝 User Message Tokens: ~${textTokenEstimate.toLocaleString()}`);
    console.log(`${TOKEN_LOG_PREFIX} 🔧 System Prompt Tokens: ~${systemPromptTokens.toLocaleString()}`);
    console.log(`${TOKEN_LOG_PREFIX} 🎯 TOTAL REQUEST TOKENS: ~${totalRequestTokens.toLocaleString()}`);

    // 🔍 NEW: 输出完整的 System Prompt 和 User Message
    console.log(`${OPENAI_LOG_PREFIX} ===== COMPLETE SYSTEM PROMPT =====`);
    console.log(`${OPENAI_LOG_PREFIX} 📝 SYSTEM PROMPT:`, systemPromptV5);
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
          content: systemPromptV5,
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

    // 🔧 RESTRUCTURE: Move image_prompt from outfit_suggestion to top level if needed
    if (unsafeResult.suggestions) {
      unsafeResult.suggestions = unsafeResult.suggestions.map((suggestion: any) => {
        // If image_prompt is inside outfit_suggestion, move it to top level
        if (!suggestion.image_prompt && suggestion.outfit_suggestion?.image_prompt) {
          const imagePrompt = suggestion.outfit_suggestion.image_prompt;
          delete suggestion.outfit_suggestion.image_prompt; // Remove from nested location
          return {
            ...suggestion,
            image_prompt: imagePrompt // Add to top level
          };
        }
        return suggestion;
      });
    }

    console.log(`${OPENAI_LOG_PREFIX} 🔧 RESTRUCTURED DATA:`, JSON.stringify(unsafeResult, null, 2));

    // 🔧 DEBUG: Check individual suggestions before validation
    if (unsafeResult.suggestions) {
      unsafeResult.suggestions.forEach((suggestion: any, index: number) => {
        console.log(`${OPENAI_LOG_PREFIX} [PRE-VALIDATION] Suggestion ${index}:`, {
          hasOutfitSuggestion: !!suggestion.outfit_suggestion,
          hasImagePrompt: !!suggestion.image_prompt,
          hasImagePromptInOutfitSuggestion: !!suggestion.outfit_suggestion?.image_prompt,
          imagePromptType: typeof suggestion.image_prompt,
          imagePromptInOutfitSuggestionType: typeof suggestion.outfit_suggestion?.image_prompt,
          imagePromptPreview: suggestion.image_prompt ? suggestion.image_prompt.substring(0, 100) + '...' :
            suggestion.outfit_suggestion?.image_prompt ? suggestion.outfit_suggestion.image_prompt.substring(0, 100) + '...' : 'MISSING'
        });
      });
    }

    let validatedResult;
    try {
      validatedResult = multiSuggestionSchema.parse(unsafeResult); // This will throw a detailed error if the schema is not met
      console.log(`${OPENAI_LOG_PREFIX} ✅ Zod validation successful`);

      // 🔧 DEBUG: Check individual suggestions after validation
      if (validatedResult.suggestions) {
        validatedResult.suggestions.forEach((suggestion: any, index: number) => {
          console.log(`${OPENAI_LOG_PREFIX} [POST-VALIDATION] Suggestion ${index}:`, {
            hasOutfitSuggestion: !!suggestion.outfit_suggestion,
            hasImagePrompt: !!suggestion.image_prompt,
            imagePromptType: typeof suggestion.image_prompt,
            imagePromptPreview: suggestion.image_prompt ? suggestion.image_prompt.substring(0, 100) + '...' : 'MISSING'
          });
        });
      }

    } catch (zodError) {
      console.error(`${OPENAI_LOG_PREFIX} 💥 ZOD VALIDATION FAILED:`, zodError);
      throw zodError;
    }

    // 🔧 POST-VALIDATION FIX: Ensure data integrity and clean up image_prompt
    const cleanedSuggestions = validatedResult.suggestions.map((suggestion: any, index: number) => {
      const { outfit_suggestion, image_prompt } = suggestion;

      // Check if image_prompt is missing or malformed
      if (!image_prompt || typeof image_prompt !== 'string') {
        console.warn(`‼️‼️‼️${OPENAI_LOG_PREFIX} [DATA_FIX] Suggestion ${index} missing or invalid image_prompt, generating fallback`);

        // Generate a fallback image_prompt from outfit details
        const fallbackPrompt = generateFallbackImagePrompt(outfit_suggestion);
        return {
          ...suggestion,
          image_prompt: fallbackPrompt
        };
      }

      // Check if image_prompt contains explanation content (which should be separate)
      const explanation = outfit_suggestion?.explanation || '';
      if (explanation && image_prompt.includes(explanation)) {
        console.warn(`${OPENAI_LOG_PREFIX} [DATA_FIX] Suggestion ${index} image_prompt contains explanation, cleaning up`);

        // Remove the explanation part from image_prompt and clean up punctuation
        let cleanedImagePrompt = image_prompt.replace(explanation, '').trim();
        // Clean up multiple dots and spaces
        cleanedImagePrompt = cleanedImagePrompt.replace(/\.+/g, '.').replace(/\s+/g, ' ').trim();
        // Remove leading/trailing dots and clean up dot-space-dot patterns
        cleanedImagePrompt = cleanedImagePrompt.replace(/^\.+/, '').replace(/\.+$/, '').trim();
        cleanedImagePrompt = cleanedImagePrompt.replace(/\s*\.\s*\.\s*/g, '. ').trim();

        return {
          ...suggestion,
          image_prompt: cleanedImagePrompt
        };
      }

      return suggestion;
    });

    console.log(`${OPENAI_LOG_PREFIX} [AI DEBUG] Cleaned OpenAI Suggestion:`, JSON.stringify({ suggestions: cleanedSuggestions }, null, 2));
    console.log(`${TOKEN_LOG_PREFIX} ===== IMAGE PROCESSING ANALYSIS COMPLETE =====`);

    // The result from the tool is an object with a "suggestions" property, which is the array we want.
    return cleanedSuggestions.slice(0, count);

  } catch (error) {
    console.error(`${OPENAI_LOG_PREFIX} 🚨 Error getting style suggestion from OpenAI:`, error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
}