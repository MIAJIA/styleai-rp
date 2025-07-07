import OpenAI from "openai";
import { systemPrompt, IMAGE_GENERATION_MODEL } from "@/lib/prompts";
import { type StyleSuggestionInput, styleSuggestionsJsonSchema } from "../types";
import { calculateImageTokens, formatBytes } from "../utils";
import { type OnboardingData } from "@/lib/onboarding-storage";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔍 LOG ANALYZER: Special identifier for easy searching
const TOKEN_LOG_PREFIX = '🎯📊 TOKEN_ANALYSIS';
const IMAGE_LOG_PREFIX = '🖼️📏 IMAGE_METRICS';


export async function getStyleSuggestionFromAI({
  humanImageUrl,
  garmentImageUrl,
  occasion,
  userProfile,
}: StyleSuggestionInput): Promise<any> {
  if (!humanImageUrl || !garmentImageUrl || !occasion) {
    throw new Error("Missing required inputs for style suggestion.");
  }

  console.log(`${TOKEN_LOG_PREFIX} ===== STARTING IMAGE PROCESSING ANALYSIS =====`);
  console.log(`[AI DEBUG] Using image generation model: ${IMAGE_GENERATION_MODEL}`);

  // do not change userProfile, only update the log, do not need to log the fullbodyphoto in userProfile
  const userProfileForLog = { ...userProfile } as Partial<OnboardingData>;
  if (userProfileForLog?.fullBodyPhoto) {
    userProfileForLog.fullBodyPhoto = '***';
  }

  console.log("[AI DEBUG] Received userProfile for suggestion:", JSON.stringify(userProfileForLog, null, 2));

  try {
    // 🔍 STEP 1: Download and analyze original images
    console.log(`${IMAGE_LOG_PREFIX} Downloading images for analysis...`);
    const [humanImageResponse, garmentImageResponse] = await Promise.all([
      fetch(humanImageUrl),
      fetch(garmentImageUrl)
    ]);

    if (!humanImageResponse.ok || !garmentImageResponse.ok) {
      throw new Error('Failed to download one of the images for AI suggestion.');
    }

    const [humanImageBlob, garmentImageBlob] = await Promise.all([
      humanImageResponse.blob(),
      garmentImageResponse.blob()
    ]);

    // 🔍 LOG: Original image sizes
    const humanImageOriginalSize = humanImageBlob.size;
    const garmentImageOriginalSize = garmentImageBlob.size;

    console.log(`${IMAGE_LOG_PREFIX} === ORIGINAL IMAGE SIZES ===`);
    console.log(`${IMAGE_LOG_PREFIX} 👤 Human Image: ${formatBytes(humanImageOriginalSize)} (${humanImageOriginalSize} bytes)`);
    console.log(`${IMAGE_LOG_PREFIX} 👔 Garment Image: ${formatBytes(garmentImageOriginalSize)} (${garmentImageOriginalSize} bytes)`);
    console.log(`${IMAGE_LOG_PREFIX} 📊 Total Original Size: ${formatBytes(humanImageOriginalSize + garmentImageOriginalSize)}`);

    // 🔍 STEP 2: Convert to Base64 and analyze
    console.log(`${TOKEN_LOG_PREFIX} Converting images to Base64...`);

    const [humanImageBuffer, garmentImageBuffer] = await Promise.all([
      humanImageBlob.arrayBuffer(),
      garmentImageBlob.arrayBuffer()
    ]);

    const humanImageBase64 = `data:${humanImageBlob.type};base64,${Buffer.from(humanImageBuffer).toString('base64')}`;
    const garmentImageBase64 = `data:${garmentImageBlob.type};base64,${Buffer.from(garmentImageBuffer).toString('base64')}`;

    // 🔍 LOG: Base64 sizes and token calculations
    const humanBase64Size = humanImageBase64.length;
    const garmentBase64Size = garmentImageBase64.length;
    const humanTokens = calculateImageTokens(humanImageBase64);
    const garmentTokens = calculateImageTokens(garmentImageBase64);
    const totalTokens = humanTokens + garmentTokens;

    console.log(`${IMAGE_LOG_PREFIX} === BASE64 CONVERSION RESULTS ===`);
    console.log(`${IMAGE_LOG_PREFIX} 👤 Human Image Base64: ${formatBytes(humanBase64Size)} (${humanBase64Size} chars)`);
    console.log(`${IMAGE_LOG_PREFIX} 👔 Garment Image Base64: ${formatBytes(garmentBase64Size)} (${garmentBase64Size} chars)`);
    console.log(`${IMAGE_LOG_PREFIX} 📊 Total Base64 Size: ${formatBytes(humanBase64Size + garmentBase64Size)}`);

    console.log(`${TOKEN_LOG_PREFIX} === TOKEN USAGE ESTIMATION ===`);
    console.log(`${TOKEN_LOG_PREFIX} 👤 Human Image Tokens: ~${humanTokens.toLocaleString()} tokens`);
    console.log(`${TOKEN_LOG_PREFIX} 👔 Garment Image Tokens: ~${garmentTokens.toLocaleString()} tokens`);
    console.log(`${TOKEN_LOG_PREFIX} 🎯 TOTAL IMAGE TOKENS: ~${totalTokens.toLocaleString()} tokens`);

    // 🔍 LOG: Compression ratio analysis
    const humanCompressionRatio = ((humanImageOriginalSize - humanBase64Size) / humanImageOriginalSize * 100);
    const garmentCompressionRatio = ((garmentImageOriginalSize - garmentBase64Size) / garmentImageOriginalSize * 100);

    console.log(`${IMAGE_LOG_PREFIX} === COMPRESSION ANALYSIS ===`);
    console.log(`${IMAGE_LOG_PREFIX} 👤 Human Image Compression: ${humanCompressionRatio.toFixed(1)}% ${humanCompressionRatio > 0 ? 'reduction' : 'expansion'}`);
    console.log(`${IMAGE_LOG_PREFIX} 👔 Garment Image Compression: ${garmentCompressionRatio.toFixed(1)}% ${garmentCompressionRatio > 0 ? 'reduction' : 'expansion'}`);

    // 🔍 WARNING: Check for potential token limit issues
    if (totalTokens > 50000) {
      console.warn(`${TOKEN_LOG_PREFIX} ⚠️  WARNING: High token usage detected (${totalTokens.toLocaleString()}). This may cause API issues!`);
    }
    if (totalTokens > 100000) {
      console.error(`${TOKEN_LOG_PREFIX} 🚨 CRITICAL: Very high token usage (${totalTokens.toLocaleString()}). High risk of hitting API limits!`);
    }

    // Build the user prompt following the structured format defined in systemPrompt.
    const userProfileSection = userProfile
      ? `# User Profile\n\`\`\`json\n${JSON.stringify(userProfile, null, 2)}\n\`\`\``
      : "# User Profile\nNo user profile provided.";

    // Build enhanced essential item details with context
    const essentialItemSection = `# Essential Item
The garment in the second attached image is the "Essential Item" that must be incorporated into the outfit suggestion.

**Item Context:**
- This is the key piece that the user wants to style around
- Consider the item's style, color, fabric, and formality level when building the complete outfit`;

    // Build occasion details with styling context
    const occasionSection = `# Occasion
**Event/Setting:** ${occasion}

**Styling Goal:** Choose complementary pieces that match the formality and mood of this occasion`;

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
- Analyze the person's gender presentation from the first image
- Design the complete outfit to match their masculine or feminine style preferences
- Ensure all clothing items, accessories, and styling choices are appropriate for their gender presentation
- The outfit should feel natural and authentic to how they present themselves`;

    // 🔍 LOG: Final token estimation including text
    const textTokenEstimate = Math.ceil(userMessageText.length / 4); // Rough estimate: 4 chars per token
    const systemPromptTokens = Math.ceil(systemPrompt.length / 4);
    const totalRequestTokens = totalTokens + textTokenEstimate + systemPromptTokens;

    console.log(`${TOKEN_LOG_PREFIX} === FINAL REQUEST ANALYSIS ===`);
    console.log(`${TOKEN_LOG_PREFIX} 📝 User Message Tokens: ~${textTokenEstimate.toLocaleString()}`);
    console.log(`${TOKEN_LOG_PREFIX} 🔧 System Prompt Tokens: ~${systemPromptTokens.toLocaleString()}`);
    console.log(`${TOKEN_LOG_PREFIX} 🎯 TOTAL REQUEST TOKENS: ~${totalRequestTokens.toLocaleString()}`);
    console.log(`${TOKEN_LOG_PREFIX} 📊 OpenAI GPT-4o Limit: 128,000 tokens`);
    console.log(`${TOKEN_LOG_PREFIX} 📈 Usage Percentage: ${(totalRequestTokens / 128000 * 100).toFixed(1)}%`);

    if (totalRequestTokens > 128000) {
      console.error(`${TOKEN_LOG_PREFIX} 🚨🚨 CRITICAL ERROR: Request exceeds OpenAI limit! (${totalRequestTokens.toLocaleString()} > 128,000)`);
    } else if (totalRequestTokens > 100000) {
      console.warn(`${TOKEN_LOG_PREFIX} ⚠️⚠️ WARNING: Approaching OpenAI limit! (${totalRequestTokens.toLocaleString()}/128,000)`);
    }

    console.log(`${TOKEN_LOG_PREFIX} ===== SENDING REQUEST TO OPENAI =====`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userMessageText,
            },
            {
              type: "image_url",
              image_url: {
                url: humanImageBase64,
                detail: "low" // 🔧 Use low detail to reduce tokens
              },
            },
            {
              type: "image_url",
              image_url: {
                url: garmentImageBase64,
                detail: "low" // 🔧 Use low detail to reduce tokens
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      tools: [
        {
          type: "function",
          function: {
            name: "get_style_suggestions",
            description: "Get one complete outfit suggestions in a structured JSON format.",
            parameters: styleSuggestionsJsonSchema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "get_style_suggestions" },
      },
    });

    console.log(`${TOKEN_LOG_PREFIX} ===== OPENAI RESPONSE RECEIVED =====`);
    console.log(`${TOKEN_LOG_PREFIX} 📊 Response usage:`, response.usage);

    const message = response.choices[0].message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.error(`${TOKEN_LOG_PREFIX} [AI DEBUG] OpenAI response did not include a tool call. Finish reason:`, response.choices[0].finish_reason);
      throw new Error(`AI did not return a structured suggestion. Finish reason: ${response.choices[0].finish_reason}`);
    }

    const toolCall = message.tool_calls[0];

    if (toolCall.function.name !== 'get_style_suggestions') {
      console.error(`${TOKEN_LOG_PREFIX} [AI DEBUG] Unexpected tool call: ${toolCall.function.name}`);
      throw new Error(`AI returned an unexpected tool: ${toolCall.function.name}`);
    }

    const suggestion = JSON.parse(toolCall.function.arguments);
    console.log(`${TOKEN_LOG_PREFIX} [AI DEBUG] OpenAI Suggestion:`, JSON.stringify(suggestion, null, 2));
    console.log(`${TOKEN_LOG_PREFIX} ===== IMAGE PROCESSING ANALYSIS COMPLETE =====`);

    return suggestion;

  } catch (error) {
    console.error(`${TOKEN_LOG_PREFIX} 🚨 Error getting style suggestion from OpenAI:`, error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
}