# Development Environment Guide

## 🎯 Overview

This guide explains how to set up and use the development environment with selective mock APIs to avoid excessive Kling AI API charges during development.

## 🔧 Environment Setup

### Development Mode (Partial Mock)

```bash
# Set environment to development
NODE_ENV=development npm run dev
```

### Production Mode (Real APIs)

```bash
# Set environment to production
NODE_ENV=production npm run start
```

## 🎭 Mock Functionality

### What Gets Mocked in Development Mode

1. **Virtual Try-On API** (`/v1/images/kolors-virtual-try-on`) - ✅ MOCKED
   - Returns base64 data URI images to avoid network issues
   - Simulates 3-second processing time
   - No API charges for try-on operations

2. **Stylization API** (`/v1/images/generations`) - ❌ NOT MOCKED
   - Always calls real Kling AI API
   - Requires valid API keys even in development
   - Incurs API charges for stylization

### Mock Strategy Rationale

- **Virtual Try-On**: High cost operation, frequently used, safe to mock
- **Stylization**: Core functionality that should be tested with real results
- **Selective Mocking**: Balances cost savings with realistic testing

### Mock Image Format

- **Try-On Mock**: Base64 data URI (1x1 pixel PNG images)
- **Stylization**: Real Kling AI generated images

## 🔍 Environment Testing

### Test Script

```bash
node scripts/test-env.js
```

This script will check:

- NODE_ENV setting
- API keys configuration
- Mock behavior status
- Recommendations for your setup

## 📋 API Call Flow

### Development Environment

```
User Request → API Status Check → Style Suggestions → Pipeline Selection
                                                           ↓
                                                    Stylization (REAL API)
                                                           ↓
                                                    Virtual Try-On (MOCK)
```

### Production Environment

```
User Request → API Status Check → Style Suggestions → Pipeline Selection
                                                           ↓
                                                    Stylization (REAL API)
                                                           ↓
                                                    Virtual Try-On (REAL API)
```

## 🔍 Debugging & Logging

### Key Log Prefixes

- `[ENV_CHECK]` - Environment detection logs
- `[DEV_MOCK]` - Development mock behavior logs (virtual try-on only)
- `[STYLIZATION_API]` - Stylization API calls (always real)
- `[KLING_API]` - Kling AI API interaction logs
- `[PIPELINE_RUNNER]` - Pipeline execution logs
- `[API_STATUS]` - Status API logs

### Example Debug Flow

```
[ENV_CHECK | Job 12345678] NODE_ENV: development
[STYLIZATION_API | Job 12345678] 🚀 Always using real Kling AI stylization API
[DEV_MOCK | Job 12345678] 🎭 Development environment detected - Using mock virtual try-on images
[DEV_MOCK | Job 12345678] 🎭 Skipping Kling AI virtual try-on API call
```

## 💰 Cost Management

### Development Benefits

- ✅ No virtual try-on charges (most expensive operation)
- ✅ Real stylization results for testing
- ⚠️ Stylization API charges still apply

### Production Usage

- 🚀 Real API calls for all operations
- 🚀 Requires valid Kling AI API keys
- 🚀 Full API charges apply

## 🚨 Error Handling

### API Keys Required for Development

Even in development mode, you need valid API keys for stylization:

```bash
# Required environment variables
KLING_AI_ACCESS_KEY=your_access_key
KLING_AI_SECRET_KEY=your_secret_key
```

### Without API Keys in Development

If API keys are missing, you'll see:

```
[STYLIZATION_API | Job 12345678] ❌ API keys not configured
[STYLIZATION_API | Job 12345678] 💡 To use real stylization API, set KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY
[STYLIZATION_API | Job 12345678] 💡 For full mock experience, use tryon-only mode
```

## 🔄 Generation Modes

### Try-On Only Mode (Full Mock)

```javascript
// No API keys required, fully mocked
generationMode: 'tryon-only'
```

### Simple Scene Mode (Partial Mock)

```javascript
// API keys required for stylization
generationMode: 'simple-scene'
```

### Advanced Scene Mode (Partial Mock)

```javascript
// API keys required for stylization
generationMode: 'advanced-scene'
```

## 📊 Testing Scenarios

### Test Try-On Only Mode (Full Mock)

1. Set `NODE_ENV=development`
2. Don't set API keys
3. Use `generationMode: 'tryon-only'`
4. Check logs for `[DEV_MOCK]` messages
5. Verify base64 data URI images are returned

### Test Simple Scene Mode (Partial Mock)

1. Set `NODE_ENV=development`
2. Set valid API keys
3. Use `generationMode: 'simple-scene'`
4. Check logs for both `[STYLIZATION_API]` and `[DEV_MOCK]` messages
5. Verify real stylization + mock try-on

## 🛠️ Troubleshooting

### Common Issues

1. **API keys missing in development**: Set KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY
2. **503 errors**: Check Kling AI account balance
3. **Network errors with mock**: Use tryon-only mode for full mock experience
4. **Missing logs**: Ensure console output is visible

### Verification Commands

```bash
# Check environment
echo $NODE_ENV

# Test environment setup
node scripts/test-env.js

# Check API keys
node -e "console.log('Keys:', !!process.env.KLING_AI_ACCESS_KEY, !!process.env.KLING_AI_SECRET_KEY)"
```

## 📝 Implementation Details

### Files Modified

- `lib/ai/services/kling.ts` - Added selective mock logic
- `lib/ai/services/blob.ts` - Added base64 data URI support
- `lib/ai/pipelines/pipeline-runner.ts` - Enhanced logging
- `app/api/generation/status/route.ts` - Added environment tracking

### Key Functions Modified

- `runVirtualTryOnMultiple()` - Virtual try-on mock logic (development only)
- `runStylizationMultiple()` - Always uses real API
- `saveFinalImageToBlob()` - Handles base64 data URI mock images

## 🎯 Recommended Workflow

### For Development Testing

1. Use `tryon-only` mode for full mock experience (no API keys needed)
2. Use `simple-scene` mode for realistic testing (API keys required)
3. Monitor logs for cost-effective debugging

### For Production

1. Ensure API keys are configured
2. Use any generation mode with confidence
3. Monitor balance for cost management

### Cost Optimization

- **Development**: Use `tryon-only` mode to avoid all charges
- **Testing**: Use `simple-scene` mode for balanced testing
- **Production**: Use any mode with full functionality
