import { getProvider } from "@/lib/ai/providers";
import { Job } from "@/lib/types";
import { kv } from "@vercel/kv";

export async function POST(request: Request) {


    const req = await request.json();
    console.log("generate req: ", req);
    const { jobId, index, userId } = req;
    console.log("generate jobId: ", jobId);
    console.log("generate index: ", index);

    const job = await kv.get(jobId) as Job;

    const emitProgress = (evt: any) => {
        console.log(`[PROVIDER_PROGRESS] ${evt.step}: ${evt.message || ''}`);
    };

    const provider = getProvider("gemini");
    const result = await provider.generateFinalImages({
        jobId,
        suggestionIndex: index,
        humanImage: job.input.humanImage,
        garmentImage: job.input.garmentImage,
        suggestion: job.suggestions[index],
        userId,
        job: job,
    }, emitProgress);

    return new Response(JSON.stringify(result.finalImageUrls), { status: 200 });
}