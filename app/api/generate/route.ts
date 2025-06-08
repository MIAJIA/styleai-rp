import { NextResponse } from "next/server";

// Helper function to convert a file to a Base64 string
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  // Return raw base64 string, not a Data URL, as expected by many APIs
  return buffer.toString("base64");
};

// Helper function for delaying execution, to be used in polling
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const KLING_API_KEY = process.env.KLING_AI_API_KEY;

// IMPORTANT: Please replace these with the actual URLs from your Kling AI documentation
const KILNG_API_SUBMIT_URL = "https://api.klingai.com/v1/virtual-tryon/submit"; // Placeholder
const KILNG_API_STATUS_BASE_URL = "https://api.klingai.com/v1/tasks/status/"; // Placeholder, e.g., "https://api.kling.com/tasks/"

export async function POST(request: Request) {
  if (!KLING_API_KEY) {
    return NextResponse.json({ error: "API key is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const humanImageFile = formData.get("human_image") as File | null;
    const garmentImageFile = formData.get("garment_image") as File | null;

    if (!humanImageFile || !garmentImageFile) {
      return NextResponse.json(
        { error: "Missing human_image or garment_image" },
        { status: 400 }
      );
    }

    // Step 1 - Convert images to Base64
    const humanImageBase64 = await fileToBase64(humanImageFile);
    const garmentImageBase64 = await fileToBase64(garmentImageFile);

    // Step 2 - Call Kling AI to submit the task
    console.log("Submitting task to Kling AI...");
    const submitResponse = await fetch(KILNG_API_SUBMIT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KLING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        human_image: humanImageBase64,
        garment_image: garmentImageBase64,
        // Add other parameters like 'style' if the API supports it
      }),
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`API Error on submit: ${submitResponse.status} ${errorBody}`);
    }

    const submitResult = await submitResponse.json();
    const taskId = submitResult.task_id;
    console.log(`Task submitted successfully. Task ID: ${taskId}`);


    // Step 3 - Poll for the result
    let attempts = 0;
    const maxAttempts = 40; // e.g., 40 attempts * 3 seconds = 2 minute timeout
    let finalImageUrl = "";

    while (attempts < maxAttempts) {
        console.log(`Polling attempt #${attempts + 1} for task: ${taskId}`);

        const statusCheckResponse = await fetch(`${KILNG_API_STATUS_BASE_URL}${taskId}`, {
          headers: {
            'Authorization': `Bearer ${KLING_API_KEY}`,
          },
        });

        if (!statusCheckResponse.ok) {
            throw new Error(`API Error on status check: ${statusCheckResponse.status}`);
        }

        const statusResult = await statusCheckResponse.json();

        if (statusResult.task_status === "succeed") {
            // NOTE: Adjust the path based on the actual API response structure
            finalImageUrl = statusResult.task_result.images[0].url;
            console.log("Task succeeded! Image URL:", finalImageUrl);
            break;
        } else if (statusResult.task_status === "failed") {
            throw new Error(`AI generation failed. Reason: ${statusResult.task_result?.error || 'Unknown'}`);
        }

        attempts++;
        await sleep(3000); // Wait for 3 seconds before the next poll
    }

    if (!finalImageUrl) {
        throw new Error("AI generation timed out.");
    }

    // Step 4 - Return the final image URL to the frontend
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error("An error occurred in the generate API:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}