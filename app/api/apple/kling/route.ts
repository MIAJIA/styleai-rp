import { KlingTaskHandler } from "@/lib/klingTask";
import { Job } from "@/lib/types";
import { kv } from "@vercel/kv";


export async function POST(request: Request) {
    const req = await request.json();
    console.log("kling req: ", req);
    const { jobId, index } = req;
    console.log("kling jobId: ", jobId);
    console.log("kling index: ", index);

    const job = await kv.get(jobId) as Job;

    const klingTaskHandler = new KlingTaskHandler(job, index);
    await klingTaskHandler.runStylizationMultiple("kling-v1-5");

    const tryOnImageUrls = await klingTaskHandler.runVirtualTryOnMultiple();

    // const tryOnImageUrls = "https://s15-kling.klingai.com/bs2/upload-ylab-stunt-sgp/se/stream_lake_mmu_img2img_aiweb_v15_portrait_tob/635e75f2-ade0-40a6-bd15-0a58b8905e9a_raw_image.png?x-kcdn-pid=112372";
    return new Response(JSON.stringify({
        success: true,
        message: "Kling task completed",
        data: tryOnImageUrls
    }), { status: 200 });

}