import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const face_style_map = {
  vitality_girl_face: {
    feature_keywords: ["Pure", "Approachable"],
    style_suggestion: ["Innocent & Sultry", "Girl-Next-Door"],
  },
  elegant_senior_face: {
    feature_keywords: ["Warm", "Dignified"],
    style_suggestion: ["Intellectual", "Sophisticated", "Young Professional"],
  },
  fresh_classical_face: {
    feature_keywords: ["Chinese Style", "Clean"],
    style_suggestion: ["Modern Chinese", "Classical"],
  },
  high_fashion_face: {
    feature_keywords: ["Cool & Chic", "Individualistic"],
    style_suggestion: ["Model-like", "Mature & Cool"],
  },
  pure_campus_belle_face: {
    feature_keywords: ["Unforgettable First Love", "Natural"],
    style_suggestion: ["Bright & Dignified", "Sweet"],
  },
  gentle_hk_pageant_face: {
    feature_keywords: ["Intellectual", "Soft"],
    style_suggestion: ["Hong Kong Style", "Elegant & Powerful"],
  },
  vengeful_heiress_face: {
    feature_keywords: ["Cold & Glamorous", "Introverted"],
    style_suggestion: ["Cold & Noble", "Minimalist"],
  },
  cool_wife_face: {
    feature_keywords: ["Cool", "Striking Beauty"],
    style_suggestion: ["High-End", "Cool & Mature"],
  },
  sweet_mixed_face: {
    feature_keywords: ["Barbie-like", "Vivid"],
    style_suggestion: ["K-Pop Idol", "Sweet Barbie"],
  },
  elegant_rich_wife_face: {
    feature_keywords: ["Peony-like", "Grand"],
    style_suggestion: ["Gorgeous", "Noble & Womanly"],
  },
  sweet_and_cool_face: {
    feature_keywords: ["Edgy", "Mixed-race Look"],
    style_suggestion: ["Jaded-Chic", "Femme Fatale"],
  },
  ceo_mature_sister_face: {
    feature_keywords: ["Cold & Glamorous", "Strong Aura"],
    style_suggestion: ["Powerful Woman", "Mature & Cool"],
  },
};

// Define the expected structure for the AI's response - SIMPLIFIED to avoid content filters
const aiAnalysisSchema = {
  type: "object",
  properties: {
    bodyType: {
      type: "string",
      description: "Classify body shape, e.g., 'Hourglass', 'Rectangle', 'Pear'",
    },
    faceShape: {
      type: "string",
      description: "Classify face shape, e.g., 'Oval', 'Square', 'Heart'",
    },
    styleInitialSense: {
      type: "string",
      description: "A one-sentence summary of the overall style impression.",
    },
    boneStructure: {
      type: "string",
      description: "Classify bone structure, e.g., 'Delicate', 'Strong'",
    },
    bodyAdvantages: {
      type: "array",
      items: { type: "string" },
      description:
        "List of body features that can be highlighted with clothing, e.g., ['Defined waist', 'Long legs']",
    },
    face_style: {
      type: "object",
      description: "Analysis of the user's face style based on the predefined map.",
      properties: {
        type_name: {
          type: "string",
          description: "The name of the face style type from the provided map, e.g., 'vitality_girl_face'.",
        },
        feature_keywords: {
          type: "array",
          items: { type: "string" },
          description: "The feature keywords for the matched face style, e.g., ['Pure', 'Approachable'].",
        },
        style_recommendation: {
          type: "array",
          items: { type: "string" },
          description:
            "The style recommendations for the matched face type, e.g., ['Innocent & Sultry', 'Girl-Next-Door'].",
        },
      },
      required: ["type_name", "feature_keywords", "style_recommendation"],
    },
  },
  required: [
    "bodyType",
    "faceShape",
    "styleInitialSense",
    "boneStructure",
    "bodyAdvantages",
    "face_style",
  ],
};

export async function POST(request: Request) {
  try {
    const { fullBodyPhoto, headPhoto } = await request.json();

    if (!fullBodyPhoto || !headPhoto) {
      return NextResponse.json({ error: "Missing required photo data" }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a fashion styling assistant. Your role is to describe fashion characteristics seen in a photograph. Focus only on clothing styles, body outlines, and visual archetypes. Avoid commenting on or recognizing the subject's identity, facial features, race, age, or gender. Output a structured JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `As a fashion stylist, analyze the provided fashion photo.

Instructions:
1. Based on the fashion shown, classify the overall aesthetic and styling direction.
2. If relevant, infer general body silhouette types or fashion-enhancing features.
3. Do not describe or reference any personal identity, facial structure, or individual-specific traits.
4. Use only the reference style categories listed below.

Reference style categories:
\`\`\`json
${JSON.stringify(face_style_map, null, 2)}
\`\`\`

JSON Output Schema:
\`\`\`json
${JSON.stringify(aiAnalysisSchema, null, 2)}
\`\`\`
`,
            },
            {
              type: "image_url",
              image_url: {
                url: fullBodyPhoto,
                detail: "low",
              },
            },
            {
              type: "image_url",
              image_url: {
                url: headPhoto,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
    });

    // Log the entire API response for debugging
    console.log("OpenAI API Response:", JSON.stringify(response, null, 2));

    if (
      !response.choices ||
      response.choices.length === 0 ||
      !response.choices[0].message.content
    ) {
      console.error("Invalid response structure from OpenAI:", response);
      throw new Error("Failed to get a valid analysis from the AI.");
    }

    const aiAnalysis = JSON.parse(response.choices[0].message.content);

    return NextResponse.json({ aiAnalysis });
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return NextResponse.json({ error: "Failed to analyze photos" }, { status: 500 });
  }
}
