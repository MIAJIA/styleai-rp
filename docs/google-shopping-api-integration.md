# Google Shopping Light API Integration

## Overview

This document describes the implementation of Google Shopping Light API integration in the StyleAI chat agent system.

## Implementation Details

### API Integration Features

1. **Real-time Product Search**: Uses SerpApi's Google Shopping Light API to fetch real product data
2. **US Market Focus**: Fixed geographic location to US market (`gl=us`, `hl=en`)
3. **Comprehensive Logging**: Detailed debugging logs for API requests and responses
4. **Error Handling**: Graceful fallback to mock data when API fails
5. **Response Processing**: Combines `shopping_results` and `inline_shopping_results`

### Configuration

#### Environment Variables

```bash
SERPAPI_KEY=your_serpapi_key_here
```

#### API Parameters

- **Engine**: `google_shopping_light`
- **Language**: `en` (English)
- **Country**: `us` (United States)
- **Results**: Limited to 5 per request

### Code Structure

#### Interfaces

- `GoogleShoppingResult`: Individual product result structure
- `GoogleShoppingResponse`: Complete API response structure

#### Functions

- `searchGoogleShoppingLight()`: Main API integration function
- `getMockSearchResults()`: Fallback mock data function

### Logging Features

The implementation includes comprehensive logging for debugging:

1. **Request Monitoring**
   - API URL construction (with hidden API key)
   - HTTP response status codes
   - Query parameters validation

2. **Response Analysis**
   - Complete response structure breakdown
   - Metadata extraction (search ID, processing time)
   - Results array analysis (`shopping_results` vs `inline_shopping_results`)
   - Field-by-field logging of sample results

3. **Processing Logs**
   - Result transformation details
   - Final output structure verification
   - Error handling and fallback activation

### Error Handling

1. **Missing API Key**: Automatic fallback to mock data
2. **API Request Failures**: HTTP error handling with detailed logging
3. **Empty Results**: Graceful handling of no-results scenarios
4. **Malformed Responses**: Robust parsing with error recovery

### Integration Points

The API is integrated into the chat agent through:

- Tool call handling in `ChatAgent.chat()` method
- `search_fashion_items` tool function
- Real-time product search triggered by user queries

## Usage

Users can trigger product searches by:

- Asking for specific items ("find me a blue dress")
- Requesting similar products ("show me something like this")
- General fashion queries ("what's trending in jackets")

## Benefits

1. **Real Data**: Live product information from US retailers
2. **Performance**: Fast response times with Google Shopping Light API
3. **Reliability**: Fallback mechanisms ensure system stability
4. **Debugging**: Comprehensive logging for troubleshooting
5. **Scalability**: Ready for production use with proper API key configuration

## Next Steps

1. Configure production API key in environment variables
2. Monitor API usage and response times
3. Optimize result processing based on user feedback
4. Consider implementing caching for frequently searched items
