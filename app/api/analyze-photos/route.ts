import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const face_style_map = {
  "元气少女脸": {
    feature_keywords: ["清纯", "亲和"],
    style_suggestion: ["纯欲", "邻家少女风"],
  },
  "优雅学姐脸": {
    feature_keywords: ["温暖", "端庄"],
    style_suggestion: ["知性", "质感", "轻熟女"],
  },
  "清新古典脸": {
    feature_keywords: ["中式", "干净"],
    style_suggestion: ["新中式", "古典风"],
  },
  "高级时尚脸": {
    feature_keywords: ["飒冷", "个性"],
    style_suggestion: ["模特感", "御姐风"],
  },
  "清纯校花脸": {
    feature_keywords: ["白月光", "自然"],
    style_suggestion: ["明艳端庄", "甜美"],
  },
  "温婉港姐脸": {
    feature_keywords: ["知性", "圆润"],
    style_suggestion: ["港风", "大女人风"],
  },
  "复仇千金脸": {
    feature_keywords: ["冷艳", "宅女感"],
    style_suggestion: ["冷贵风", "性冷淡风"],
  },
  "飒爽姐妻脸": {
    feature_keywords: ["酷", "第一眼美女"],
    style_suggestion: ["高级", "酷感御姐风"],
  },
  "甜美混血脸": {
    feature_keywords: ["芭比感", "明艳"],
    style_suggestion: ["韩系女团风", "芭比甜妹"],
  },
  "优雅阔太脸": {
    feature_keywords: ["富贵花", "大气"],
    style_suggestion: ["华丽", "贵气女人风"],
  },
  "调性甜酷脸": {
    feature_keywords: ["攻击性高", "混血感"],
    style_suggestion: ["厌世风", "恶女风"],
  },
  "总裁御姐脸": {
    feature_keywords: ["冷艳", "强气场"],
    style_suggestion: ["大女人风", "御姐风"],
  },
}

// Define the expected structure for the AI's response - SIMPLIFIED to avoid content filters
const aiAnalysisSchema = {
  type: "object",
  properties: {
    bodyType: { type: "string", description: "Classify body shape, e.g., 'Hourglass', 'Rectangle', 'Pear'" },
    faceShape: { type: "string", description: "Classify face shape, e.g., 'Oval', 'Square', 'Heart'" },
    styleInitialSense: { type: "string", description: "A one-sentence summary of the overall style impression." },
    boneStructure: { type: "string", description: "Classify bone structure, e.g., 'Delicate', 'Strong'" },
    bodyAdvantages: {
      type: "array",
      items: { type: "string" },
      description: "List of body features that can be highlighted with clothing, e.g., ['Defined waist', 'Long legs']",
    },
    face_style: {
      type: "object",
      description: "Analysis of the user's face style based on the predefined map.",
      properties: {
        type_name: {
          type: "string",
          description: "The name of the face style type from the provided map, e.g., '元气少女脸'.",
        },
        feature_keywords: {
          type: "array",
          items: { type: "string" },
          description: "The feature keywords for the matched face style, e.g., ['清纯', '亲和'].",
        },
        style_recommendation: {
          type: "array",
          items: { type: "string" },
          description: "The style recommendations for the matched face type, e.g., ['纯欲', '邻家少女风'].",
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
}

export async function POST(request: Request) {
  try {
    const { fullBodyPhoto, headPhoto } = await request.json()

    if (!fullBodyPhoto || !headPhoto) {
      return NextResponse.json({ error: "Missing required photo data" }, { status: 400 })
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
    })

    // Log the entire API response for debugging
    console.log("OpenAI API Response:", JSON.stringify(response, null, 2));

    if (!response.choices || response.choices.length === 0 || !response.choices[0].message.content) {
      console.error("Invalid response structure from OpenAI:", response);
      throw new Error("Failed to get a valid analysis from the AI.");
    }

    const aiAnalysis = JSON.parse(response.choices[0].message.content)

    return NextResponse.json({ aiAnalysis })
  } catch (error) {
    console.error("Error calling OpenAI API:", error)
    return NextResponse.json({ error: "Failed to analyze photos" }, { status: 500 })
  }
}