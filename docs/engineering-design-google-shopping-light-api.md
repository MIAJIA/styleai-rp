# Engineering Design Document: Integrating Google Shopping Light API

## Objective

Replace the current mock search functionality with a real-time online search using the Google Shopping Light API. The goal is to enable users to find relevant product links and images online from US retailers.

## Overview

The Google Shopping Light API provides a streamlined way to access Google Shopping search results. This integration will allow our application to fetch real-time product data, including links and images, directly from Google Shopping US marketplace.

## System Architecture

### Current System

- **Mock Search**: Currently, the system uses a mock search that returns hardcoded product data.
- **Agent Interaction**: The agent selects a tool based on user input and returns mock data.

### Proposed System

- **Real API Integration**: Replace mock search with Google Shopping Light API calls.
- **US Market Focus**: Fixed geographic location to United States for consistent results.
- **Fallback Mechanism**: Maintain mock data as fallback when API is unavailable.
- **Enhanced Data**: Return real product links, images, prices, and ratings from US retailers.
- **Comprehensive Logging**: Detailed logging for debugging and monitoring API responses.

## Implementation Plan

### ✅ Phase 1: Core API Integration (COMPLETED)

1. **API Function Implementation**
   - ✅ Created `searchGoogleShoppingLight()` function in `lib/chat-agent.ts`
   - ✅ Added proper TypeScript interfaces for API response handling
   - ✅ Implemented error handling and fallback mechanisms
   - ✅ Updated response format to match actual Google Shopping Light API structure
   - ✅ Fixed geographic location to US market (`gl=us`, `hl=en`)
   - ✅ Added comprehensive logging for API response analysis

2. **Tool Integration**
   - ✅ Updated `search_fashion_items` tool to use real API instead of mock data
   - ✅ Maintained backward compatibility with existing tool interface
   - ✅ Added comprehensive logging for debugging
   - ✅ Optimized for performance by removing translation delays

3. **Response Processing**
   - ✅ Transform API response to match expected format
   - ✅ Handle both `shopping_results` and `inline_shopping_results`
   - ✅ Extract product information (title, price, rating, thumbnail, etc.)
   - ✅ Generate meaningful summaries focused on US market

### 🔄 Phase 2: Configuration & Setup (IN PROGRESS)

4. **Environment Configuration**
   - ⚠️ **REQUIRED**: Add `SERPAPI_KEY` to your `.env.local` file
   - ✅ Graceful fallback to mock data when API key is not configured
   - ✅ Clear logging to indicate when using mock vs real data

5. **API Key Setup Instructions**:

   ```bash
   # 1. Sign up for SerpApi account at https://serpapi.com/
   # 2. Get your API key from the dashboard
   # 3. Add to your .env.local file:
   SERPAPI_KEY=your_actual_api_key_here
   ```

### 📋 Phase 3: Testing & Optimization (TODO)

6. **Testing**
   - [ ] Test API integration with various search queries (English and non-English)
   - [ ] Validate response format handling
   - [ ] Test error scenarios and fallbacks
   - [ ] Performance testing

7. **Optimization**
   - [ ] Implement caching for frequently searched items
   - [ ] Add rate limiting to respect API quotas
   - [ ] Optimize image loading and display

## API Details

### Endpoint

- **URL**: `https://serpapi.com/search`
- **Engine**: `google_shopping_light`
- **Method**: GET

### Parameters Used

- `q`: Search query (accepts any language, searches US market)
- `engine`: `google_shopping_light`
- `api_key`: Your SerpApi key
- `hl`: `en` (Language: English - fixed)
- `gl`: `us` (Country: United States - fixed)
- `num`: `10` (Number of results)

### Geographic Location Settings

- **Fixed to US Market**: All searches are performed in the US market regardless of user location
- **English Language**: Results are returned in English for consistency
- **US Retailers**: Results include products from US-based retailers and shipping options

### Response Structure

The API returns both `shopping_results` and `inline_shopping_results` arrays containing:

- `title`: Product name
- `price`: Product price
- `extracted_price`: Numeric price value
- `thumbnail`: Product image URL
- `link`: Product page URL
- `source`: Retailer name
- `rating`: Product rating
- `reviews`: Number of reviews

## Debugging & Logging

### Enhanced Logging Features

The implementation includes comprehensive logging to help understand API responses:

#### 1. **Request Logging**

```
[SearchAPI] Calling Google Shopping Light API for query: "macbook"
[SearchAPI] API URL: https://serpapi.com/search?engine=google_shopping_light&q=macbook&api_key=HIDDEN_API_KEY&hl=en&gl=us&num=10
[SearchAPI] HTTP Response Status: 200 OK
```

#### 2. **Response Structure Analysis**

```
=== GOOGLE SHOPPING API RESPONSE ANALYSIS ===
[SearchAPI] Full response keys: ['search_metadata', 'search_parameters', 'shopping_results', 'inline_shopping_results', 'filters']
[SearchAPI] Search Metadata: {
  id: "684c560337979a9d571be3fc",
  status: "Success",
  total_time_taken: 4.60,
  url: "https://www.google.com/search?q=macbook&..."
}
```

#### 3. **Results Analysis**

```
[SearchAPI] shopping_results found: 15 items
[SearchAPI] inline_shopping_results found: 8 items
[SearchAPI] Total combined results: 23
```

#### 4. **Individual Item Processing**

```
[SearchAPI] Processing result 1: {
  title: "Apple - MacBook Air 15-inch...",
  price: "$1,299.00",
  rating: 4.5,
  thumbnail: "present",
  link: "present",
  source: "Best Buy"
}
```

#### 5. **Final Output Summary**

```
[SearchAPI] Successfully processed 10 results from US market
[SearchAPI] Final items structure: [
  {
    id: "shopping-0",
    name: "Apple - MacBook Air 15-inch...",
    price: "$1,299.00",
    hasImage: true,
    hasLink: true
  }
]
```

#### 6. **Error Logging**

```
[SearchAPI] Error calling Google Shopping Light API: Error message
[SearchAPI] Error details: {
  message: "API request failed with status 401",
  stack: "Error stack trace..."
}
[SearchAPI] Falling back to mock data due to API error
```

### How to Use Logging for Debugging

1. **Check Console Output**: All logs are prefixed with `[SearchAPI]` for easy filtering
2. **API Key Issues**: Look for "SERPAPI_KEY not found" or HTTP 401 errors
3. **Empty Results**: Check if `shopping_results` and `inline_shopping_results` are found
4. **Data Structure**: Examine the "First item structure" logs to understand response format
5. **Processing Issues**: Monitor individual result processing logs

## Current Status

### ✅ Completed

- Core API integration implemented
- Error handling and fallback mechanisms
- Response format processing
- Tool integration updated
- TypeScript interfaces defined
- US geographic location fixed
- Performance optimized (no translation delays)
- **Comprehensive logging system for debugging**

### ⚠️ Immediate Action Required

**You need to configure your SERPAPI_KEY to use real data:**

1. Go to <https://serpapi.com/> and create an account
2. Get your API key from the dashboard
3. Add it to your `.env.local` file:

   ```
   SERPAPI_KEY=your_actual_api_key_here
   ```

### 🔄 Next Steps

1. Configure API key (required for real data)
2. Test the integration with real searches
3. Monitor API usage and performance using the enhanced logs
4. Implement caching if needed

## Benefits

1. **Real-time Data**: Access to current product information and pricing from US market
2. **Wide Coverage**: Results from multiple US retailers and platforms
3. **Rich Metadata**: Ratings, reviews, images, and detailed product info
4. **Reliability**: Fallback to mock data ensures system stability
5. **Performance**: Optimized for speed with direct queries (no translation delays)
6. **Consistency**: Fixed US market location for predictable results
7. **Multi-language Support**: Accepts search queries in any language but searches US market
8. ****Debugging Support**: Comprehensive logging for easy troubleshooting and monitoring**

## Technical Notes

- The implementation gracefully handles API failures by falling back to mock data
- All API calls are logged for debugging and monitoring
- Response processing handles missing fields safely
- The system maintains the same interface for backward compatibility
- Search queries are used directly without translation to minimize latency
- Geographic location is fixed to US (`gl=us`) for consistent marketplace results
- Language is set to English (`hl=en`) for standardized response format
- **Comprehensive logging provides visibility into API requests, responses, and data processing**

## Search Query Handling

- **Multi-language Input**: Users can search in any language (Chinese, English, etc.)
- **Direct Processing**: Queries are sent directly to the API without translation
- **US Market Results**: All results come from the US marketplace regardless of query language
- **Performance Optimized**: No translation delays, immediate API calls

## Troubleshooting Guide

### Common Issues and Solutions

1. **No Results Returned**
   - Check logs for "shopping_results: NOT FOUND" and "inline_shopping_results: NOT FOUND"
   - Verify search query is not empty
   - Try different search terms

2. **API Key Issues**
   - Look for "SERPAPI_KEY not found" in logs
   - Check `.env.local` file configuration
   - Verify API key is valid on SerpApi dashboard

3. **HTTP Errors**
   - Check "HTTP Response Status" in logs
   - 401: Invalid API key
   - 429: Rate limit exceeded
   - 500: Server error (will fallback to mock data)

4. **Data Processing Issues**
   - Monitor "Processing result X" logs for individual item issues
   - Check "Final items structure" for output validation
   - Verify required fields are present in API response
