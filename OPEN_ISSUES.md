P1. 改成carousel

generate-style 里面call kling 生成prompt的时候去掉“Overall Recommendation” 和 “Confidence note” 只把输出中的Styling tips 加入进去kling的prompt。 请注意 我还需要在其他地方用到"Overall Recommendation" 和 "Confidence note" 所以openai的output还是保持不变

# Open Issue: Generated Images are Cropped (Missing Head/Face)

**Last Updated:** 2024-07-26

---

### 1. Problem Description

When a user uploads a portrait photograph (especially one with a non-standard aspect ratio), the final AI-generated "virtual try-on" image returned by the Kling AI API is consistently cropped, with the subject's head and face missing. The API call itself is successful and returns a seemingly valid image, but the composition is incorrect.

### 2. Root Cause Analysis (Hypothesis)

The root cause is almost certainly in the **client-side pre-processing of the user's uploaded photo** before it is sent to the `/api/generate` endpoint.

The Kling AI API has strict requirements for image aspect ratio. Our current client-side logic attempts to resize or pad the image to meet these requirements. However, this pre-processing creates an image that, while technically valid in dimensions, causes the AI model to misinterpret the subject. It appears the model performs its own "center crop" or focuses on the torso, leading to the head being cut off in the final output.

The problem is **not** in how the final image is displayed on the results page; the image data itself is flawed.

### 3. Attempts and History

1.  **No Pre-processing:** Led to `Image aspect ratio is invalid` errors from the API.
2.  **Client-Side Padding ("Letterboxing"):** We tried padding the image with white bars to fit the required aspect ratio. This resolved the API error but was the first time we observed the "missing head" phenomenon.
3.  **Client-Side Top-Crop:** We attempted to crop the image from the top to preserve the head. This also failed, suggesting the AI's internal cropping is not simple.
4.  **Frontend Display Fixes (`object-contain`):** We confirmed the issue is not a display-time problem. The image file itself is cropped. The current display logic correctly shows whatever image the API returns, without further cropping.

### 4. Actionable Next Steps (TODOs)

To solve this, the image pre-processing logic needs a fundamental redesign.

- **[HIGH PRIORITY] `app/page.tsx` (or image upload component):**

  - **TODO:** The core task is to re-implement the client-side image pre-processing. The goal is to create a "smart crop" function. This function should:
    1.  Identify the most important region of the image (e.g., from the top of the head to the waist).
    2.  Crop and resize this region to precisely match the aspect ratio expected by the Kling AI API.
    3.  Consider giving the user a manual cropping tool as a more robust solution, allowing them to define the area for the virtual try-on.

- **`app/api/generate/route.ts`:**

  - **TODO:** As an alternative to client-side logic, investigate implementing server-side image processing using a library like `sharp`. This would offload the work from the user's device, provide more consistent results, and give us more control over the final image sent to the AI. See `OPEN_ISSUES.md` for full context.

- **`app/results/page.tsx`:**
  - **TODO:** The current `object-contain` display is appropriate for now. If the image generation is fixed, and the resulting images have a consistent, correct aspect ratio, re-evaluate if this "letterbox" display is still needed or if the container can be sized to the image directly. See `OPEN_ISSUES.md` for full context.
