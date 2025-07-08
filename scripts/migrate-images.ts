// This script is intended to be run once to migrate existing images in Vercel Blob.
// It iterates through all jobs in KV, downloads the original human and garment images,
// compresses them using Sharp, uploads the new versions, and updates the job records.

import { kv } from '@vercel/kv';
import { put, del } from '@vercel/blob';
import sharp from 'sharp';
import { type Job } from '@/lib/ai';

// --- Configuration ---
const COMPRESSION_CONFIG = {
  quality: 80,
  maxWidth: 1024,
  maxHeight: 1024,
  targetSizeKB: 200,
};
const JOB_KEY_PREFIX = 'job:*'; // Assuming jobs are stored with a 'job:' prefix
const DRY_RUN = false; // Set to true to run without making actual changes

// --- Helper Functions ---
async function fetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function compressImage(buffer: Buffer): Promise<Buffer> {
  let image = sharp(buffer)
    .resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: COMPRESSION_CONFIG.quality });

  let compressedBuffer = await image.toBuffer();

  // If the image is still too large, progressively reduce quality
  let quality = COMPRESSION_CONFIG.quality;
  while (compressedBuffer.length / 1024 > COMPRESSION_CONFIG.targetSizeKB && quality > 40) {
    quality -= 10;
    console.log(`      ... still too large, reducing quality to ${quality}`);
    compressedBuffer = await sharp(buffer)
      .jpeg({ quality })
      .toBuffer();
  }
  return compressedBuffer;
}

async function processImage(
  jobId: string,
  imageUrl: string,
  imageType: 'human' | 'garment'
): Promise<{ newUrl: string; originalUrl: string } | null> {
  if (!imageUrl || imageUrl.includes('-compressed')) {
    console.log(`  - Skipping ${imageType} image (already processed or missing).`);
    return null;
  }

  try {
    console.log(`  - Processing ${imageType} image: ${imageUrl.slice(-20)}`);

    // 1. Download
    const originalBuffer = await fetchImage(imageUrl);
    console.log(`    - Downloaded: ${(originalBuffer.length / 1024).toFixed(1)} KB`);

    // 2. Compress
    const compressedBuffer = await compressImage(originalBuffer);
    console.log(`    - Compressed: ${(compressedBuffer.length / 1024).toFixed(1)} KB`);

    // 3. Upload new image
    const newFileName = `${jobId}-${imageType}-compressed.jpg`;
    if (DRY_RUN) {
      console.log(`    - [DRY RUN] Would upload new image as ${newFileName}`);
      return { newUrl: `dry-run-url/${newFileName}`, originalUrl: imageUrl };
    }

    const { url: newUrl } = await put(newFileName, compressedBuffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });
    console.log(`    - Uploaded new image: ${newUrl}`);

    return { newUrl, originalUrl: imageUrl };

  } catch (error) {
    console.error(`  - Failed to process ${imageType} image for job ${jobId}:`, error);
    return null;
  }
}

// --- Main Migration Logic ---
async function migrate() {
  console.log('Starting image migration script...');
  if (DRY_RUN) {
    console.warn('--- DRY RUN is active. No actual changes will be made. ---');
  }

  let cursor = 0;
  let totalJobsProcessed = 0;

  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: JOB_KEY_PREFIX });
    cursor = Number(nextCursor);

    for (const key of keys) {
      console.log(`\nProcessing Job: ${key}`);
      const job = await kv.hgetall<Job>(key);

      if (!job) {
        console.log(`  - Job data not found, skipping.`);
        continue;
      }

      const updates: Partial<Job> & { [key: string]: any } = {};

      // Process Human Image
      const humanResult = await processImage(job.jobId, job.humanImage.url, 'human');
      if (humanResult) {
        updates['humanImage.url'] = humanResult.newUrl;
      }

      // Process Garment Image
      const garmentResult = await processImage(job.jobId, job.garmentImage.url, 'garment');
      if (garmentResult) {
        updates['garmentImage.url'] = garmentResult.newUrl;
      }

      // Update KV if there are changes
      if (Object.keys(updates).length > 0) {
        console.log(`  - Updating job record in KV...`);
        if (!DRY_RUN) {
          await kv.hset(key, updates);

          // Optionally, delete old blobs
          if (humanResult) await del(humanResult.originalUrl);
          if (garmentResult) await del(garmentResult.originalUrl);
          console.log(`  - Deleted old blobs.`);
        } else {
          console.log(`  - [DRY RUN] Would update with:`, updates);
        }
      } else {
        console.log(`  - No images needed processing for this job.`);
      }
      totalJobsProcessed++;
    }
  } while (cursor !== 0);

  console.log(`\nMigration complete. Total jobs processed: ${totalJobsProcessed}.`);
}

migrate().catch(console.error);