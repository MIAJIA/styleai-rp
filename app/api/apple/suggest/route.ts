import { getStyleSuggestionFromAI } from "@/lib/apple/openAi";
import { GenerationMode, Job, Suggestion } from "@/lib/types";
import { kv } from "@vercel/kv";


export async function POST(request: Request) {
    const req = await request.json();
    console.log("Suggest req: ", req);
    const { jobId, index } = req;
    console.log("Suggest jobId: ", jobId);

    const job = await kv.get(jobId) as Job;
    console.log("job: ", job.suggestions);
    console.log("job: ", job.suggestions[index].styleSuggestion.outfit_suggestion.explanation);

    return new Response(JSON.stringify({
        success: true,
        message: job.suggestions[index].styleSuggestion.outfit_suggestion.explanation,
        jobId: jobId
    }), { status: 200 });
}