#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { AuthService } = require('../lib/auth.js');

const prisma = new PrismaClient();
const authService = new AuthService();

async function testMigration() {
  console.log('🧪 Testing SafeSense Migration from Supabase to Coolify PostgreSQL...\n');

  try {
    // Test 1: Database Connection
    console.log('1️⃣ Testing database connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful:', result);

    // Test 2: Check if tables exist
    console.log('\n2️⃣ Checking database schema...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('✅ Available tables:', tables.map(t => t.table_name));

    // Test 3: Test User operations
    console.log('\n3️⃣ Testing user operations...');
    
    // Create a test user
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'testpassword123';
    
    console.log('Creating test user...');
    const userResult = await authService.register(testEmail, testPassword, 'TestUser');
    console.log('✅ User created:', userResult.user.email);

    // Test login
    console.log('Testing login...');
    const loginResult = await authService.login(testEmail, testPassword);
    console.log('✅ Login successful:', loginResult.user.email);

    // Test token verification
    console.log('Testing token verification...');
    const user = await authService.getUserByToken(loginResult.token);
    console.log('✅ Token verification successful:', user.email);

    // Test 4: Test User Preferences
    console.log('\n4️⃣ Testing user preferences...');
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id }
    });
    console.log('✅ User preferences found:', preferences ? 'Yes' : 'No');

    // Test 5: Test Sensor operations (if any exist)
    console.log('\n5️⃣ Testing sensor operations...');
    const sensorCount = await prisma.sensor.count();
    console.log(`✅ Sensors in database: ${sensorCount}`);

    // Test 6: Test Team Invitations
    console.log('\n6️⃣ Testing team invitations...');
    const invitationCount = await prisma.teamInvitation.count();
    console.log(`✅ Team invitations in database: ${invitationCount}`);

    // Test 7: Test Raw Readings
    console.log('\n7️⃣ Testing raw readings...');
    const readingCount = await prisma.rawReading.count();
    console.log(`✅ Raw readings in database: ${readingCount}`);

    // Cleanup test user
    console.log('\n🧹 Cleaning up test data...');
    await prisma.userPreferences.deleteMany({
      where: { userId: user.id }
    });
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests passed! Migration is successful!');
    console.log('\n📋 Next steps:');
    console.log('1. Set up your .env.local file with Coolify PostgreSQL credentials');
    console.log('2. Run: npm run db:generate');
    console.log('3. Run: npm run db:push');
    console.log('4. Run: npm run dev');
    console.log('5. Test the application in your browser');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testMigration();
