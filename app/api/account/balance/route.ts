import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";

// This JWT generation function is reused for all authenticated requests.
const getApiToken = (accessKey: string, secretKey: string): string => {
  const payload = {
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes expiration
    nbf: Math.floor(Date.now() / 1000) - 5, // 5 seconds tolerance
  };
  const token = jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });
  return token;
};

const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;
const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const ACCOUNT_COSTS_PATH = "/account/costs";

export async function GET() {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json(
      { error: "AccessKey or SecretKey is not configured in .env.local" },
      { status: 500 },
    );
  }

  try {
    const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

    // Per documentation, we query a time range. We'll default to the last 90 days.
    const endTime = Date.now();
    const startTime = endTime - 90 * 24 * 60 * 60 * 1000; // 90 days ago

    const url = new URL(`${KLING_API_BASE_URL}${ACCOUNT_COSTS_PATH}`);
    url.searchParams.append("start_time", String(startTime));
    url.searchParams.append("end_time", String(endTime));

    console.log(`Querying account balance from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error on account balance check: ${response.status} ${errorBody}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("An error occurred while fetching account balance:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
