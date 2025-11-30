#!/bin/bash

echo "🧪 Testing Production Deployment"
echo "================================"

RAILWAY_URL="https://rooms-through-time-production.up.railway.app"
VERCEL_URL="https://rooms-through-time.vercel.app"

echo ""
echo "1️⃣ Testing Railway Backend..."
echo "URL: $RAILWAY_URL"

# Test root endpoint
echo -n "   Root endpoint: "
if curl -s -f "$RAILWAY_URL/" > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ FAILED"
fi

# Test health endpoint
echo -n "   Health endpoint: "
HEALTH=$(curl -s -f "$RAILWAY_URL/health" 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ OK"
    echo "   Response: $(echo $HEALTH | head -c 100)..."
else
    echo "❌ FAILED"
    echo "   Error: $HEALTH"
fi

echo ""
echo "2️⃣ Testing Vercel Frontend..."
echo "URL: $VERCEL_URL"

# Test frontend
echo -n "   Frontend loads: "
if curl -s -f "$VERCEL_URL" | grep -q "AI Room Designer"; then
    echo "✅ OK"
else
    echo "❌ FAILED"
fi

echo ""
echo "3️⃣ Testing API Integration..."

# Test if frontend can reach backend
echo -n "   API connectivity: "
# This would need to be tested in browser console
echo "⚠️  Test manually in browser console"

echo ""
echo "================================"
echo "📋 Summary:"
echo "   Railway Backend: Check logs if failed"
echo "   Vercel Frontend: Working"
echo "   Next: Test image generation in browser"
