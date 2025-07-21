#!/usr/bin/env node

/**
 * Environment Test Script
 * This script helps validate environment variables and settings
 * for development vs production behavior
 */

console.log('🔍 Environment Check Script');
console.log('='.repeat(50));

// Check NODE_ENV
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Is development: ${process.env.NODE_ENV === 'development'}`);
console.log(`Is production: ${process.env.NODE_ENV === 'production'}`);

console.log('\n🔑 Kling AI API Keys Check:');
console.log('='.repeat(30));
console.log(`KLING_AI_ACCESS_KEY: ${process.env.KLING_AI_ACCESS_KEY ? '✅ SET' : '❌ MISSING'}`);
console.log(`KLING_AI_SECRET_KEY: ${process.env.KLING_AI_SECRET_KEY ? '✅ SET' : '❌ MISSING'}`);

if (process.env.KLING_AI_ACCESS_KEY) {
  console.log(`Access Key Length: ${process.env.KLING_AI_ACCESS_KEY.length} chars`);
  console.log(`Access Key Preview: ${process.env.KLING_AI_ACCESS_KEY.substring(0, 10)}...`);
}

if (process.env.KLING_AI_SECRET_KEY) {
  console.log(`Secret Key Length: ${process.env.KLING_AI_SECRET_KEY.length} chars`);
  console.log(`Secret Key Preview: ${process.env.KLING_AI_SECRET_KEY.substring(0, 10)}...`);
}

console.log('\n🌐 API Base URLs:');
console.log('='.repeat(20));
console.log(`Kling API Base: https://api-singapore.klingai.com`);
console.log(`Try-On Endpoint: /v1/images/kolors-virtual-try-on`);
console.log(`Stylization Endpoint: /v1/images/generations`);

console.log('\n🎭 Mock Behavior (Selective):');
console.log('='.repeat(30));
if (process.env.NODE_ENV === 'development') {
  console.log('✅ Development mode - Selective mock enabled');
  console.log('✅ Virtual Try-On API: MOCKED (base64 data URIs)');
  console.log('⚠️  Stylization API: REAL API (requires keys)');
  console.log('💡 Use tryon-only mode for full mock experience');
} else {
  console.log('🚀 Production mode - Using real APIs for all operations');
  console.log('🚀 Virtual Try-On API: REAL API');
  console.log('🚀 Stylization API: REAL API');
  console.log('🚀 Full API charges will be incurred');
}

console.log('\n📋 Test Results:');
console.log('='.repeat(20));
const isDevelopment = process.env.NODE_ENV === 'development';
const hasApiKeys = process.env.KLING_AI_ACCESS_KEY && process.env.KLING_AI_SECRET_KEY;

console.log(`Development mode: ${isDevelopment ? '✅ YES' : '❌ NO'}`);
console.log(`Has API keys: ${hasApiKeys ? '✅ YES' : '❌ NO'}`);

console.log('\n💰 Cost Analysis:');
console.log('='.repeat(15));
if (isDevelopment) {
  if (hasApiKeys) {
    console.log('💰 Partial cost savings - Virtual try-on mocked, stylization real');
    console.log('💰 Recommended modes: simple-scene, advanced-scene');
  } else {
    console.log('💰 Full cost savings - Use tryon-only mode');
    console.log('💰 Recommended mode: tryon-only');
  }
} else {
  console.log('💰 Full costs apply - All APIs are real');
  console.log('💰 Recommended: Monitor balance for cost management');
}

console.log('\n🔧 Generation Modes:');
console.log('='.repeat(20));
console.log('📌 tryon-only (dev): No API keys needed, fully mocked');
console.log('📌 simple-scene (dev): API keys required, partial mock');
console.log('📌 advanced-scene (dev): API keys required, partial mock');
console.log('📌 Any mode (prod): API keys required, no mock');

console.log('\n🎯 Recommendations:');
console.log('='.repeat(20));
if (isDevelopment) {
  if (hasApiKeys) {
    console.log('💡 Perfect for realistic testing with cost savings!');
    console.log('💡 Use simple-scene/advanced-scene for development');
  } else {
    console.log('💡 Perfect for cost-free testing!');
    console.log('💡 Use tryon-only mode for full mock experience');
    console.log('💡 Add API keys for realistic stylization testing');
  }
} else {
  if (hasApiKeys) {
    console.log('💡 Production setup looks good!');
    console.log('💡 Monitor balance for cost management');
  } else {
    console.log('⚠️  Warning: No API keys found for production use!');
  }
}

console.log('\n🔧 How to switch modes:');
console.log('='.repeat(25));
console.log('Development: NODE_ENV=development npm run dev');
console.log('Production: NODE_ENV=production npm run start');
console.log('');
console.log('🎭 Mock modes:');
console.log('- Full mock: tryon-only (no API keys needed)');
console.log('- Partial mock: simple-scene/advanced-scene (API keys needed)');
console.log('- No mock: production (all real APIs)');