import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    baseURL: "http://192.168.1.3:5000/v1",
      apiKey: process.env.OPENAI_API_KEY,
  });

const systemPromptStep4 = `
You are an AI personal stylist.  
Your task is to generate an initial style insight based only on:
1. The user's stated style goal
2. Their self-assessment of styling confidence
3. A single full-body photo (no explicit skin tone or body type analysis yet)

Goals for the output:
- Make the user feel understood and recognized based on their goal and photo.
- Do NOT give explicit color, body type, or silhouette advice yet — focus on mood, perceived style potential, or vibe.
- Keep tone warm, encouraging, and inspiring, as if speaking directly to them.
- Provide a short, emotionally engaging statement, plus a factual observation of their current vibe/potential.
- Detect and return gender, detailed hair color, and hair length based on the photo.

**Output format (JSON):**
{
  "statement": "[Short emotional recognition statement]", 
  "Observation": "[Observation of current vibe / potential]",  
  "gender": "[Predicted gender based on photo]",  
  "detail_hair_color": "[Detailed hair color, e.g., 'dark brown', 'light blonde']",  
  "hair_length": "[Hair length, e.g., 'short', 'medium', 'long']"
}
`

const systemPromptStep7 = `
You are an AI personal stylist.  
Your task is to generate a concise style DNA summary based on:
1. The user's style goal
2. Their skin tone
3. Their body type
4. Their chosen style preferences
5. Observation from Screen 4 (their vibe/potential)
6. Gender from Screen 4

Goals for the output:
- Combine all inputs into one concise, inspiring style DNA summary.
- Keep it warm, aspirational, and confidence-boosting.
- Limit to ONE sentence only, no extra details.
- Do not include technical fashion jargon.

**Output format (JSON):**
{
  "summary": "[1-sentence style DNA summary]"
}
`

export async function POST(request: Request) {
    const body = await request.json();
    const { step, goal, confidence_level, photo_url, skin_tone, body_type, style_preferences,Observation, gender } = body;
    let response;
    try {
    switch (step) {
        case 4:
            response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: systemPromptStep4 }, { role: "user", content: `Goal: ${goal}, Confidence: ${confidence_level}, Photo: ${photo_url}` }],
            });
            const aiAnalysis = JSON.parse(response.choices[0].message.content || "{}");
            return NextResponse.json({ aiAnalysis });
        case 7:
            response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: systemPromptStep7 }, { role: "user", content: `Goal: ${goal}, Skin Tone: ${skin_tone}, Body Type: ${body_type}, Style Preferences: ${style_preferences}, Observation: ${Observation}, Gender: ${gender}` }],
            });
            const styleSummary = JSON.parse(response.choices[0].message.content || "{}");
            return NextResponse.json({ styleSummary });
    }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
    }
}
