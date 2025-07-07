// --- Helper Functions ---

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithTimeout(
  resource: RequestInfo,
  options: RequestInit & { timeout: number },
): Promise<Response> {
  const { timeout } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

// File API polyfill utility
export function createFilePolyfill(blob: Blob, filename: string, options?: FilePropertyBag): File {
  // Check if native File constructor exists and works
  if (typeof File !== 'undefined') {
    try {
      return new File([blob], filename, options);
    } catch (error) {
      console.warn('Native File constructor failed, using polyfill:', error);
    }
  }

  // Polyfill: Create a Blob with File-like properties
  const fileBlob = new Blob([blob], { type: options?.type || blob.type });

  // Add File-specific properties
  Object.defineProperty(fileBlob, 'name', {
    value: filename,
    writable: false,
    configurable: false
  });

  Object.defineProperty(fileBlob, 'lastModified', {
    value: options?.lastModified || Date.now(),
    writable: false,
    configurable: false
  });

  Object.defineProperty(fileBlob, 'webkitRelativePath', {
    value: '',
    writable: false,
    configurable: false
  });

  return fileBlob as File;
}

// Utility to check if we're in a browser environment
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

// Helper function to create a data URL to File converter that works cross-environment
export function dataURLtoFile(dataUrl: string, filename: string): File | null {
  if (!dataUrl) {
    return null;
  }

  try {
    const arr = dataUrl.split(',');
    if (arr.length < 2) return null;

    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    const blob = new Blob([u8arr], { type: mime });
    return createFilePolyfill(blob, filename, { type: mime });
  } catch (error) {
    console.error('Failed to convert data URL to file:', error);
    return null;
  }
}

// Helper function to convert a File to a Base64 string
export const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
};


// Helper to convert a URL to a File object
export async function urlToFile(url: string, filename: string, mimeType: string): Promise<File> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Converting URL to file (attempt ${attempt + 1}/${maxRetries}): ${url.substring(0, 100)}...`);

      const response = await fetchWithTimeout(url, {
        timeout: 120000 // 2 minutes timeout for file downloads
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.blob();

      // Use our polyfill utility that handles cross-environment compatibility
      return createFilePolyfill(data, filename, { type: mimeType });

    } catch (error) {
      console.error(`URL to file conversion attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to convert URL to file after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Wait before retrying
      const waitTime = (attempt + 1) * 2000; // 2s, 4s, 6s
      console.log(`Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }

  throw new Error("URL to file conversion failed: Maximum retries exceeded");
}


// 🔍 TOKEN ANALYZER: Calculate approximate token usage for Base64 images
export function calculateImageTokens(base64DataUrl: string): number {
  // Remove data:image/xxx;base64, prefix to get pure base64
  const base64Content = base64DataUrl.split(',')[1] || base64DataUrl;

  // OpenAI's token calculation for images is complex, but we can estimate:
  // - High detail images: ~765 tokens + (width/512) * (height/512) * 170 tokens
  // - Low detail images: ~85 tokens (fixed)
  // For base64, we estimate based on content length as a proxy

  const base64Length = base64Content.length;
  const estimatedTokens = Math.ceil(base64Length / 1000) * 85; // Rough estimation

  return estimatedTokens;
}

// 🔍 SIZE ANALYZER: Convert bytes to human-readable format
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}