# Design Doc: V2 Style Generation Flow

## 1. Objective

To implement a new two-step style generation process on the `StyleMe` page (`app/page.tsx`). This involves first generating textual styling advice and a specialized image prompt, and then using that prompt to generate the final try-on image with a specific model version.

## 2. Current State

The `app/page.tsx` component operates in three stages:

1.  **Stage 1 (Input):** User selects a portrait, a garment, and an occasion.
2.  **Stage 2 (Suggestion):** Clicking "Get Styling Advice" triggers a loading state. It currently uses `setTimeout` to simulate an API call and displays mock suggestion data after 5 seconds.
3.  **Stage 3 (Result):** Clicking "Generate My Look!" moves to the final stage and displays a static placeholder image (`/examples/result-1.png`).

The entire process is self-contained within the frontend with no real backend calls for suggestion or final image generation.

## 3. Proposed Changes

We will replace the mock logic with real API calls to a new set of backend endpoints. The flow will be orchestrated from `app/page.tsx`.

### 3.1. Stage 1 -> Stage 2: Generating Style Advice

The `handleGetSuggestion` function will be modified to perform the following:

1.  **Trigger:** User clicks "Get Styling Advice".
2.  **Action:** The function will make a `POST` request to a new endpoint: `/api/generate-suggestion`.
3.  **Payload:** The request body will be a `FormData` object containing:
    - `human_image`: The user's portrait file.
    - `garment_image`: The selected garment file.
    - `occasion`: The string for the selected occasion (e.g., "日常通勤").
4.  **Backend Logic (`/api/generate-suggestion`):**
    - This endpoint will receive the images and text.
    - It will construct a detailed prompt for a text-generation model (e.g., OpenAI's GPT).
    - The prompt will ask the model to analyze the inputs and return a structured JSON object containing:
      - Detailed styling advice (e.g., `scene_fit`, `style_alignment`, etc.).
      - **A new key: `image_prompt`**. This will be a carefully crafted, descriptive prompt string suitable for an image generation model.
5.  **Frontend Response Handling:**
    - On a successful response, the frontend will parse the JSON.
    - The received suggestion object (including `image_prompt`) will be stored in the `styleSuggestion` state.
    - The UI will update to display the textual advice to the user, and `currentStage` will be `2`.

### 3.2. Stage 2 -> Stage 3: Generating the Final Image

The `handleGenerateFinalImage` function will be modified:

1.  **Trigger:** User reviews the advice and clicks "Generate My Look!".
2.  **Pre-computation:** The function will set the loading state for the final image generation.
3.  **Action:** It will make a `POST` request to the specified endpoint: `/api/generate-style-v2`.
4.  **Payload:** The request body will be a `FormData` object containing:
    - `human_image`: The user's portrait file.
    - `garment_image`: The selected garment file.
    - `prompt`: The `styleSuggestion.image_prompt` string obtained from the previous API call.
    - `modelVersion`: The hardcoded string `"kling-v2"`.
5.  **Backend Logic (`/api/generate-style-v2`):**
    - This endpoint will receive the images and the specific image prompt.
    - It will call the image generation service (Kling) with the provided parameters.
    - It will handle the response from the generation service and, upon success, return a JSON object with the `imageUrl` of the final generated image.
6.  **Frontend Response Handling:**
    - The frontend will receive the `imageUrl` and store it in the `generatedImageUrl` state.
    - It will then set `currentStage` to `3` to display the final result.

### 3.3. State Management & UI

- `currentStage`: Will continue to control the UI flow (1: Input, 2: Suggestion, 3: Result).
- `loadingProgress`: Will be used during the suggestion generation call. A new loading indicator might be needed for the final image generation step.
- `styleSuggestion`: Will now store the _actual_ response from `/api/generate-suggestion`. It's crucial that this state is not cleared between stages 2 and 3.
- `generatedImageUrl`: Will store the final image URL from `/api/generate-style-v2`.
- **Error Handling:** Both `handleGetSuggestion` and `handleGenerateFinalImage` will be wrapped in `try...catch` blocks. In case of an API error, an alert will be shown to the user, and the loading state will be reset, allowing them to try again.

## 4. File Modifications

The following files will be created or modified:

1.  **Modified:** `app/page.tsx`
    - Update `handleGetSuggestion` to call `/api/generate-suggestion`.
    - Update `handleGenerateFinalImage` to call `/api/generate-style-v2`.
    - Implement robust loading and error states for both API calls.
2.  **New:** `app/api/generate-suggestion/route.ts` (Tentative path)
    - Backend logic to handle the suggestion generation request.
3.  **New:** `app/api/generate-style-v2/route.ts` (Tentative path)
    - Backend logic to handle the final image generation request.
