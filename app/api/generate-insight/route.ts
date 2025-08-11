import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Robust JSON parsing helper to tolerate code fences/backticks and extra text
function parseJsonSafe(text: string): any {
  if (!text) return {};
  let cleaned = text.trim();
  // Remove Markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* ignore */ }
    }
    return {};
  }
}

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
`;

const systemPromptStep7 = `
You are an AI personal stylist.
Your task is to generate a personalized Style DNA Summary and Style Guidebased on:
1) user's style goal,
2) skin tone,
3) body type,
4) chosen style preferences,
5) observation (vibe) from screen 4,
6) gender from screen 4.

Personalization rules (MANDATORY):
- Explicitly reference the provided attributes by name inside the guidance: mention the exact body type (e.g., "pear-shaped") and skin tone, and tie at least one tip to the user's selected style_preferences.
- Do not give generic filler. Give concrete, useful guidance the user can act on immediately.
- Keep the output concise and scannable.

Goals for the output:
1) Provide a Style DNA Summary — one inspiring sentence tailored to the user's vibe and goal.
2) Offer a Style Guide & Guidelines — 2–3 very short bullet points (MAX 50 English words TOTAL) focused on: flattering fits/silhouettes for the body type, color families for the skin tone, and 1 signature piece aligned with style_preferences.

Tone: warm, aspirational, confidence-boosting. No disclaimers, no overlong explanations.

Output format (JSON):
{
  "summary": "[one tailored sentence]",
  "style_guide": "[use line breaks to separate 2–3 bullets, total ≤ 50 words]"
}
`;

export async function POST(request: Request) {
    const body = await request.json();
    const { step, goal, confidence_level, photo_url, skin_tone, body_type, style_preferences,Observation, gender } = body;
    let response;
    try {
    switch (step) {
        case 4:
            response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [{ role: "system", content: systemPromptStep4 }, { role: "user", content: `Goal: ${goal}, Confidence: ${confidence_level}, Photo: ${photo_url}` }],
            });
            const aiAnalysis = parseJsonSafe(response.choices[0].message.content || "{}");
            return NextResponse.json({ aiAnalysis });
        case 7:
            response = await openai.chat.completions.create({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: [{ role: "system", content: systemPromptStep7 }, { role: "user", content: `Goal: ${goal}, Skin Tone: ${skin_tone}, Body Type: ${body_type}, Style Preferences: ${style_preferences}, Observation: ${Observation}, Gender: ${gender}` }],
            });
            const styleSummary = parseJsonSafe(response.choices[0].message.content || "{}");
            return NextResponse.json({ 
                styleSummary: {
                    summary: styleSummary.summary,
                    style_guide: styleSummary.style_guide
                }
            });
    }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
    }
}
