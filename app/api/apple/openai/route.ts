import { getStyleSuggestionFromAI } from "@/lib/openAi";
import { GenerationMode, Job, Suggestion } from "@/lib/types";
import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";



const stylePrompts = {
    "Work": "office outfit, professional and polished, comfortable and well-fitted, with flexible piece combinations that are appropriate for both office work and everyday client meetings. The scene is a bright and open-plan office with glass partitions",
    "Cocktail": "casual outfit, relaxed and comfortable, effortlessly stylish, easy to move in, ideal for weekend downtime, coffee and shopping. The scene is a urban street lined with outdoor café tables and chairs",
    "Date": "date night outfit, alluring and confidently charming, creating a soft, romantic atmosphere that showcases personal style without revealing too much. The scene is an intimate candlelit bistro terrace",
    "Casual": "casual outfit, relaxed and comfortable, effortlessly stylish, easy to move in, ideal for weekend downtime, coffee and shopping. The scene is a urban street lined with outdoor café tables and chairs",
    "Vacation": "vacation outfit, fresh and comfortable with a clear vacation vibe, perfectly suited for beach days, resort lounging, or city sightseeing. The scene is a pristine beachfront resort featuring turquoise waves and palm trees",
};



export async function POST(request: Request) {
    const req = await request.json();
    const { onboardingData: userProfile, garmentImage,occasion } = req.body;

    console.log({
        humanImageUrl: userProfile.fullBodyPhoto,
        garmentImageUrl: garmentImage,
        occasion: occasion,
        userProfile: userProfile,
        stylePrompt: stylePrompts[occasion as keyof typeof stylePrompts],
    });

    // const jobId = "123"
    const jobId = "apple_openai_"+randomUUID();
    const userId = userProfile.userId;
    const now = Date.now();
    const humanImageBlob = { url: userProfile.fullBodyPhoto, type: "image/jpeg", name: "fullBodyPhoto.jpg" };
    const garmentImageBlob = { url: garmentImage, type: "image/jpeg", name: "garmentImage.jpg" };
    const generationMode: GenerationMode = "simple-scene";

    const newJob: Job = {
        jobId,
        userId, // Store userId in job for pipeline access
        status: 'pending', // IMPORTANT: Status is now 'pending'
        suggestions: [], // Suggestions will be generated later
        input: {
            humanImage: { url: humanImageBlob.url, type: humanImageBlob.type, name: humanImageBlob.name },
            garmentImage: { url: garmentImageBlob.url, type: garmentImageBlob.type, name: garmentImageBlob.name },
            generationMode,
            occasion,
            userProfile,
            customPrompt: "",
            stylePrompt: stylePrompts[occasion as keyof typeof stylePrompts],
        },
        createdAt: now,
        updatedAt: now,
    };

    await kv.set(jobId, newJob)

    const aiSuggestions = await getStyleSuggestionFromAI({
        humanImageUrl: userProfile.fullBodyPhoto,
        garmentImageUrl: garmentImage,
        occasion: occasion,
        userProfile: userProfile,
        stylePrompt: stylePrompts[occasion as keyof typeof stylePrompts],
    },{ count: 2 })



    newJob.suggestions = aiSuggestions.map((suggestion: any, index: number): Suggestion => ({
        index,
        status: 'pending', // Each suggestion starts as pending
        styleSuggestion: suggestion,
        personaProfile: {},
        // 🔍 MINIMAL: 只设置一个占位符，真正的 prompt 构建完全在 kling.ts 中处理
        finalPrompt: "Generated styling suggestion",
    }));

    await kv.set(jobId, newJob)

    // const newJob = await kv.get(jobId) as Job;
    // console.log("job: ", newJob.suggestions[0].styleSuggestion.outfit_suggestion.explanation);

    return new Response(JSON.stringify({
        success: true,
        message: newJob.suggestions[0].styleSuggestion.outfit_suggestion.explanation,
        jobId: jobId
    }), { status: 200 });
}