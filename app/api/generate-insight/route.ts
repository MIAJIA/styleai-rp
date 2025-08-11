import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
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
Your task is to generate a personalized style profile based on:
1. The user's style goal
2. Their skin tone
3. Their body type
4. Their chosen style preferences
5. Observation from Screen 4 (their vibe/potential)
6. Gender from Screen 4

Goals for the output:
1. Provide a **Style DNA Summary** — a concise, inspiring one-sentence description of the user’s unique style identity and vibe.
2. Offer a **Style Guide & Guidelines** — clear, non-technical explanations of what works for them and why (fit, proportions, colors).
3. Suggest **Actionable Future Strategies** — practical tips for building and evolving their wardrobe, aligned with their goals and lifestyle.
4. Include **Practical Styling Tips** — outfit formulas, color pairings, or silhouette ideas they can immediately apply.
5. Ensure tone is **warm, aspirational, and confidence-boosting**, without technical jargon, and relevant for a Western audience.

**Output format (JSON):**
{
  "summary": "[1-sentence Style DNA summary]",
  "style_guide": "[Clear explanation of flattering styles, fits, and colors]",
  "future_strategies": "[Actionable wardrobe-building strategies]",
  "practical_tips": "[Immediately usable outfit tips and combinations]"
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
            return NextResponse.json({ 
                styleSummary: {
                    summary: styleSummary.summary,
                    style_guide: styleSummary.style_guide,
                    future_strategies: styleSummary.future_strategies,
                    practical_tips: styleSummary.practical_tips
                }
            });
    }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
    }
}
