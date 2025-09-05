import { authenticateRequest } from '../middleware/auth.js';

// GET /api/test-alerts - Test endpoint to check if alerts API is working
export async function GET(request) {
  try {
    console.log('Test alerts endpoint called');
    
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return new Response(JSON.stringify({ 
        error: authResult.error,
        status: authResult.status 
      }), { 
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      message: 'Test alerts endpoint working',
      user: authResult.user.id 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test alerts error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

