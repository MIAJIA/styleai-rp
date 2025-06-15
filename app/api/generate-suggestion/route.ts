import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to convert a file to a base64 data URL
async function fileToDataURL(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

const systemPrompt = `You are an expert fashion stylist. Your task is to analyze a person's photo, a piece of clothing, and a specified occasion to provide detailed, actionable styling advice.

You will be given:
1.  A photo of a person (full body if possible).
2.  A photo of a single garment.
3.  The name of an occasion (e.g., "日常通勤" for daily commute, "约会之夜" for date night).

You MUST respond with a valid JSON object. The JSON object should have the following keys:

-   \`scene_fit\`: (String) How well the garment fits the specified occasion and if any adjustments are needed.
-   \`style_alignment\`: (String) The style category of the garment and suggestions for complementary items (e.g., pants, shoes) to create a cohesive look.
-   \`personal_match\`: (String) How the garment complements the person's body type and appearance, with suggestions for how to wear it (e.g., tuck it in, roll up sleeves).
-   \`visual_focus\`: (String) Identify the main visual element of the outfit and advise on how to balance it with other pieces.
-   \`material_silhouette\`: (String) Recommendations on materials and silhouettes for accompanying pieces to enhance the overall look.
-   \`color_combination\`: (String) Color palette suggestions for the rest of the outfit, including primary, secondary, and accent colors.
-   \`reuse_versatility\`: (String) Suggestions for how to style the garment for at least two other different occasions.
-   \`image_prompt\`: (String) **This is the most important field.** Create a detailed, descriptive, and inspiring image generation prompt in English for a model like DALL-E or Midjourney. This prompt should describe the person from the photo wearing the provided garment in a setting that perfectly matches the occasion. It should be a full-body fashion shot description, focusing on the overall mood, lighting, style, and composition. Be specific and creative. For example: "A full-body fashion shot of a stylish young woman standing on a charming, sun-drenched cobblestone street in Paris. She is wearing a chic, [describe garment color and type], paired with tailored trousers and classic loafers. The lighting is warm and golden, casting soft shadows. The overall mood is sophisticated, effortless, and romantic. Photorealistic, editorial style."

All text values in the JSON object should be in Chinese, **except for the \`image_prompt\`**, which must be in English.`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const humanImageFile = formData.get("human_image") as File | null;
    const garmentImageFile = formData.get("garment_image") as File | null;
    const occasion = formData.get("occasion") as string | null;

    if (!humanImageFile || !garmentImageFile || !occasion) {
      return NextResponse.json(
        { error: "Missing required fields: human_image, garment_image, or occasion" },
        { status: 400 },
      );
    }

    // Convert images to base64 data URLs
    const humanImageURL = await fileToDataURL(humanImageFile);
    const garmentImageURL = await fileToDataURL(garmentImageFile);

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
              text: `Here is the person, the garment, and the occasion. Please provide your styling advice. Occasion: "${occasion}"`,
            },
            {
              type: "image_url",
              image_url: {
                url: humanImageURL,
              },
            },
            {
              type: "image_url",
              image_url: {
                url: garmentImageURL,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      // @ts-ignore
      response_format: { type: "json_object" },
    });
    // log the whole prompt including the user's text input and system prompt
    console.log("!!! prompt:", systemPrompt);
    console.log("!!! user input:", occasion);

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    // Parse the JSON string and return it
    const suggestion = JSON.parse(content);
    return NextResponse.json(suggestion);
  } catch (error) {
    console.error("Error in /api/generate-suggestion:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 },
    );
  }
}
