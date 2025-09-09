// Test script for AI activation functionality
// Run with: node test-ai-activation.js

const API_BASE_URL = 'http://127.0.0.1:8000';

async function testSegmentation() {
    console.log('🔍 Testing AI Vision (Segmentation)...');
    
    try {
        // Test with a sample image URL
        const testImageUrl = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800';
        
        const response = await fetch(`${API_BASE_URL}/segment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: testImageUrl })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const result = await response.json();
        console.log('✅ Segmentation successful!');
        console.log('   Masks found:', result.masks ? result.masks.length : 0);
        
        return true;
    } catch (error) {
        console.error('❌ Segmentation failed:', error.message);
        return false;
    }
}

async function testHealthCheck() {
    console.log('🏥 Testing backend health...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const result = await response.json();
        
        console.log('✅ Backend is healthy!');
        console.log('   FAL API configured:', result.fal_api_configured);
        
        return result.fal_api_configured;
    } catch (error) {
        console.error('❌ Backend health check failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🧪 Running AI Activation Tests\n');
    
    const healthOk = await testHealthCheck();
    if (!healthOk) {
        console.log('\n❌ Backend not ready. Make sure to:');
        console.log('   1. Run: ./start-dev.sh');
        console.log('   2. Check your FAL_KEY in backend/.env');
        return;
    }
    
    console.log('');
    const segmentOk = await testSegmentation();
    
    console.log('\n📊 Test Results:');
    console.log('   Backend Health:', healthOk ? '✅' : '❌');
    console.log('   AI Segmentation:', segmentOk ? '✅' : '❌');
    
    if (healthOk && segmentOk) {
        console.log('\n🎉 AI Activation is working properly!');
    } else {
        console.log('\n🔧 AI Activation needs fixing. Check the logs above.');
    }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
    global.fetch = (await import('node-fetch')).default;
}

runTests().catch(console.error);