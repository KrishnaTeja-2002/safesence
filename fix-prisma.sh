#!/bin/bash

# Script to fix Prisma client issues
echo "🔧 Fixing Prisma Client Issues..."
echo ""

# Step 1: Regenerate Prisma Client
echo "📦 Step 1: Regenerating Prisma Client..."
npx prisma generate --schema=./prisma/schema.prisma

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

echo "✅ Prisma client regenerated successfully"
echo ""

# Step 2: Verify models are available
echo "🔍 Step 2: Verifying Prisma models..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const models = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
console.log('Available models:', models.join(', '));
if (prisma.sensorGroup) {
    console.log('✅ sensorGroup model is available');
} else {
    console.log('❌ sensorGroup model is NOT available');
}
if (prisma.sensorGroupMember) {
    console.log('✅ sensorGroupMember model is available');
} else {
    console.log('❌ sensorGroupMember model is NOT available');
}
"

echo ""
echo "✅ Verification complete"
echo ""
echo "⚠️  IMPORTANT: Please restart your Next.js development server:"
echo "   1. Stop the current server (Ctrl+C)"
echo "   2. Run: npm run dev"
echo ""
echo "This will ensure the new Prisma client is loaded."

