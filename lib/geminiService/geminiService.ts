import { GoogleGenAI } from "@google/genai";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * Helper to clean base64 string (remove data:image/png;base64, prefix)
 */
const cleanBase64 = (b64: string) => b64.split(',')[1] || b64;

/**
 * 1. Generate Collage
 * Takes multiple item images and creates a flatlay.
 */
export const generateCollage = async (imagesBase64: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const parts = imagesBase64.map(b64 => ({
      inlineData: {
        mimeType: 'image/png',
        data: cleanBase64(b64)
      }
    }));

    parts.push({
      // @ts-ignore - Text part matches SDK expectation
      text: "Create a high-fashion flatlay collage of these clothing items arranged neatly on a pure white background. Ensure all items are visible and styled attractively together as a coordinate outfit. Do not crop items."
    });

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4", 
          imageSize: "1K"
        }
      }
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Collage generation failed", error);
    throw error;
  }
};

/**
 * 2. Generate Virtual Try-On
 * Takes the collage/outfit image + model desc + scene desc.
 */
export const generateVirtualTryOn = async (
  collageBase64: string, 
  modelPrompt: string, 
  scenePrompt: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64(collageBase64)
            }
          },
          {
            text: `Generate a photorealistic full-body fashion photograph of ${modelPrompt} wearing the outfit shown in the reference image. The setting is ${scenePrompt}. The lighting should be cinematic and high-end fashion editorial style. Ensure the clothing looks exactly like the reference.`
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No try-on image generated");
  } catch (error) {
    console.error("Try-on generation failed", error);
    throw error;
  }
};