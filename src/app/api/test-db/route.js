export const runtime = "nodejs";

import { authenticateRequest } from '../middleware/auth-postgres.js';

// GET /api/test-db - Test database connection and device operations
export async function GET(request) {
  try {
    console.log('Testing database connection...');
    
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { db, user } = authResult;
    
    // Test basic database connection
    const testQuery = await db.prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database connection test:', testQuery);
    
    // Test device table access
    const deviceCount = await db.prisma.device.count();
    console.log('Total devices in database:', deviceCount);
    
    // Test user's devices
    const userDevices = await db.prisma.device.findMany({
      where: { ownerId: user.id }
    });
    console.log('User devices:', userDevices);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Database connection successful',
      data: {
        testQuery,
        deviceCount,
        userDevices: userDevices.length,
        userId: user.id
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database test error:', error);
    return new Response(JSON.stringify({ 
      error: 'Database test failed', 
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
