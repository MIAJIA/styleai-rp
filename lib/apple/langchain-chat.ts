// LangChain imports for message handling and context management
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { getChatHistory, ChatMessage, ImageInfo, compressImage } from "./chat";
import { urlToFile, fileToBase64 } from "../utils";
import { put } from "@vercel/blob";
import { generateChatCompletionWithGemini, GeminiChatMessage } from "./gemini";

/**
 * LangChain-based chat handler for Gemini with enhanced context and image support
 */
/**
 * LangChain-based chat handler using LangChain message formats
 * but calling Gemini API directly for compatibility
 */
export class LangChainGeminiChat {
  constructor() {
    // Using direct API calls with LangChain message formats
  }

  /**
   * Convert KV-stored chat history to LangChain messages
   * @param sessionId - Session identifier
   * @param historyWindow - Number of historical messages to include (sliding window)
   */
  private async loadHistoryAsMessages(
    sessionId: string,
    historyWindow: number = 10
  ): Promise<BaseMessage[]> {
    const chatHistory = await getChatHistory(sessionId, historyWindow);
    const messages: BaseMessage[] = [];

    for (const msg of chatHistory) {
      const content: any[] = [];

      // Add text content
      if (msg.content && msg.content.trim()) {
        content.push({ type: "text", text: msg.content });
      }

      // Add images from history (only uploaded images for context)
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          // Only include user-uploaded images, not AI-generated ones
          if (img.type === "uploaded") {
            try {
              let imageBase64: string;

              if (img.isCompressed && img.context) {
                // Use compressed image if available
                imageBase64 = img.context;
              } else {
                // Compress and cache the image
                const base64 = await urlToFile(
                  img.url,
                  img.name || "image.jpg",
                  img.mimeType || "image/jpeg"
                ).then(fileToBase64);
                imageBase64 = await compressImage(base64);
              }

              content.push({
                type: "image_url",
                image_url: {
                  url: `data:${img.mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              } as any);
            } catch (error) {
              console.error(
                `[LangChain Chat] Failed to load image ${img.name}:`,
                error
              );
            }
          }
        }
      }

      // Only add message if it has valid content
      if (content.length > 0) {
        if (msg.role === "user") {
          messages.push(new HumanMessage({ content }));
        } else if (msg.role === "assistant") {
          messages.push(new AIMessage({ content }));
        }
      }
    }

    return messages;
  }

  /**
   * Convert image URLs to LangChain image parts
   */
  private async convertImagesToParts(
    imageUrls: string[]
  ): Promise<any[]> {
    const imageParts: any[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imgUrl = imageUrls[i];
      if (!imgUrl || imgUrl.length === 0) {
        continue;
      }

      const imageName = `Image ${i + 1}`;
      try {
        const mimeType = "image/jpeg";
        console.log(
          `[LangChain Chat] Converting ${imageName} (${i + 1}/${imageUrls.length})...`
        );

        const imageBase64 = await urlToFile(
          imgUrl,
          imageName,
          mimeType
        ).then(fileToBase64);

        // Compress image for context
        const compressedImage = await compressImage(imageBase64);

        imageParts.push({
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${compressedImage}`,
          },
        });

        console.log(
          `[LangChain Chat] ✅ ${imageName} converted and compressed`
        );
      } catch (error) {
        console.error(`[LangChain Chat] ❌ Failed to process ${imageName}:`, error);
      }
    }

    return imageParts;
  }

  /**
   * Convert LangChain messages to Gemini format
   */
  private convertToGeminiFormat(messages: BaseMessage[]): GeminiChatMessage[] {
    const geminiMessages: GeminiChatMessage[] = [];

    for (const msg of messages) {
      const parts: any[] = [];

      if (msg instanceof SystemMessage) {
        // System message as first user message
        parts.push({ text: msg.content as string });
        geminiMessages.push({ role: "user", parts });
      } else if (msg instanceof HumanMessage || msg instanceof AIMessage) {
        const content = msg.content;

        if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === "text") {
              parts.push({ text: part.text });
            } else if (part.type === "image_url" && part.image_url?.url) {
              // Extract base64 from data URL
              const dataUrl = part.image_url.url;
              const [mimeType, base64Data] = dataUrl.includes(",")
                ? [dataUrl.split(";")[0].split(":")[1], dataUrl.split(",")[1]]
                : ["image/jpeg", dataUrl];

              parts.push({
                inline_data: {
                  mime_type: mimeType || "image/jpeg",
                  data: base64Data,
                },
              });
            }
          }
        } else if (typeof content === "string") {
          parts.push({ text: content });
        }

        if (parts.length > 0) {
          geminiMessages.push({
            role: msg instanceof HumanMessage ? "user" : "model",
            parts,
          });
        }
      }
    }

    return geminiMessages;
  }

  /**
   * Extract and save generated images from URLs
   */
  private async extractGeneratedImagesFromUrls(
    imageUrls: string[],
    userId: string
  ): Promise<ImageInfo[]> {
    const generatedImages: ImageInfo[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        // Images are already saved by generateChatCompletionWithGemini
        // Just need to compress for context storage
        const imageBase64 = await urlToFile(
          url,
          `Generated Image ${i + 1}`,
          "image/jpeg"
        ).then(fileToBase64);

        const compressedImage = await compressImage(imageBase64);
        generatedImages.push({
          isCompressed: true,
          context: compressedImage,
          url: url,
          type: "generated",
          name: `Generated Image ${i + 1}`,
        });

        console.log(
          `[LangChain Chat] 💾 Processed generated image ${i + 1}: ${url}`
        );
      } catch (error) {
        console.error(
          `[LangChain Chat] ❌ Failed to process generated image ${i + 1}:`,
          error
        );
        // Still add the URL even if compression fails
        generatedImages.push({
          url: url,
          type: "generated",
          name: `Generated Image ${i + 1}`,
        });
      }
    }

    return generatedImages;
  }

  /**
   * Main chat method with LangChain
   */
  async chat(params: {
    sessionId: string;
    userId: string;
    message: string;
    imageUrls?: string[];
    systemPrompt: string;
    historyWindow?: number; // Number of historical messages to include (sliding window)
  }): Promise<{
    text: string;
    images?: string[];
    metadata?: any;
  }> {
    const { sessionId, userId, message, imageUrls = [], systemPrompt, historyWindow = 10 } = params;

    console.log(`[LangChain Chat] Processing chat request for session: ${sessionId}`);
    console.log(`[LangChain Chat] Message: ${message}`);
    console.log(`[LangChain Chat] Images: ${imageUrls.length}`);
    console.log(`[LangChain Chat] History window: ${historyWindow} messages`);

    // Load historical messages from KV with sliding window
    const historicalMessages = await this.loadHistoryAsMessages(sessionId, historyWindow);
    console.log(
      `[LangChain Chat] Loaded ${historicalMessages.length} historical messages (window: ${historyWindow})`
    );

    // Build current user message with images
    const userContent: any[] = [];

    // Add images first
    if (imageUrls.length > 0) {
      const imageParts = await this.convertImagesToParts(imageUrls);
      userContent.push(...imageParts);
    }

    // Add text message
    userContent.push({ type: "text", text: message });

    const userMessage = new HumanMessage({ content: userContent });

    // Build message chain: system prompt + history + current message
    const messages: BaseMessage[] = [
      new SystemMessage({ content: systemPrompt }),
      ...historicalMessages,
      userMessage,
    ];

    console.log(
      `[LangChain Chat] Sending ${messages.length} messages to Gemini (including system prompt)`
    );

    // Convert LangChain messages to Gemini format
    const geminiMessages: GeminiChatMessage[] = this.convertToGeminiFormat(messages);

    // Invoke Gemini API with LangChain-formatted messages
    const response = await generateChatCompletionWithGemini(userId, {
      messages: geminiMessages,
      maxOutputTokens: 2000,
      temperature: 0.7,
    });

    console.log(
      `[LangChain Chat] Received response from Gemini`
    );

    // Extract and save generated images
    const generatedImages = await this.extractGeneratedImagesFromUrls(
      response.images || [],
      userId
    );
    const generatedImageUrls = generatedImages.map((img) => img.url);

    // If no text response, provide default
    let responseText = response.text || "";
    if (!responseText.trim()) {
      if (generatedImageUrls.length > 0) {
        responseText =
          "I've generated some visual content for you. Here are the results:";
      } else {
        responseText =
          "I'm having trouble generating a response right now. Please try again.";
      }
    }

    return {
      text: responseText.trim(),
      images: generatedImageUrls.length > 0 ? generatedImageUrls : undefined,
      metadata: response.metadata || {
        finishReason: "UNKNOWN",
        tokenCount: 0,
      },
    };
  }

  /**
   * Clear any cached data for a session (if needed)
   */
  clearSessionCache(sessionId: string): void {
    // Memory is managed through KV storage, no in-memory cache needed
  }
}
