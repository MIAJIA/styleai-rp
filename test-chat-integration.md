# Chat Page API Integration Testing Guide

## Testing Steps

### 1. Basic Functionality Test
1. Start the development server: `npm run dev`
2. Visit the homepage: `http://localhost:3000`
3. Upload a selfie and a clothing image
4. Select an occasion (e.g., "Coffee Shop Date")
5. Select "Chat Experience" in Step 4
6. Verify that the data is correctly passed to the Chat page

### 2. API Integration Test
1. Click "Start Generating My Style" on the Chat page
2. Verify the following process:
   - The "AI is analyzing your outfit needs..." loading status is displayed
   - A job is successfully created by calling `/api/generation/start`
   - Polling starts for `/api/generation/status`
   - When the status is `suggestion_generated`, the outfit suggestions are displayed
   - The "AI is generating your exclusive style image..." loading status is displayed
   - When the status is `completed`, the final generated image is displayed
   - Completion messages and action buttons are displayed

### 3. Error Handling Test
1. Test for network error scenarios
2. Test for scenarios where the API returns an error
3. Verify that the retry function works correctly
4. Verify timeout handling (5 minutes)

### 4. User Experience Test
1. Verify that messages automatically scroll to the bottom
2. Verify the image click-to-enlarge function
3. Verify the loading animation effects
4. Verify the responsive layout

## Expected Results

### Success Flow
1. User selects images and occasion → Chat page displays a personalized welcome message
2. Click to start generation → Loading status is displayed
3. API call is successful → AI-generated outfit suggestions are displayed (including occasion fit, style matching, etc.)
4. Continue generation → The final style image is displayed
5. Completion → Action buttons are displayed (Try another set, View my styles)

### API Data Flow
```
User action → FormData(human_image, garment_image, occasion)
       → POST /api/generation/start
       → Returns jobId
       → Poll GET /api/generation/status?jobId=xxx
       → status: suggestion_generated → Display text suggestions
       → status: completed → Display final image
```

## Debug Information

Check the following logs in the browser console:
- `[CHAT POLLING] Received data:` - Data returned from polling
- `[CHAT POLLING] Suggestion generated` - Suggestion generation complete
- `[CHAT POLLING] Generation completed` - Image generation complete
- Any error messages and stack traces

## Known Issues

1. Image format conversion may have compatibility issues in some browsers
2. Long generation times may trigger the timeout mechanism
3. Unstable network may cause polling to fail

## Next Steps for Optimization

1. Add a more detailed progress indicator
2. Optimize the user-friendliness of error messages
3. Add a feature to save generation history
4. Implement a smarter retry mechanism