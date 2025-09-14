import { AuthService } from '../../../../lib/auth.js';
import { DatabaseClient } from '../../../../lib/database.js';

const authService = new AuthService();
const db = new DatabaseClient();

export async function authenticateRequest(request) {
  try {
    console.log('Authenticating request...');
    
    // First try to get token from Authorization header
    const authHeader = request.headers.get('authorization');
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else {
      // Fallback to cookie-based authentication
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        
        // Try different possible cookie names
        token = cookies['auth-token'] || 
                cookies['jwt-token'] ||
                cookies['session-token'];
      }
    }
    
    if (!token) {
      console.error('No authentication token found');
      return { error: 'No authentication token found', status: 401 };
    }

    console.log('Token found, verifying...');
    
    // Verify the JWT token
    const user = await authService.getUserByToken(token);

    if (!user) {
      console.error('Token verification failed');
      return { error: 'Invalid or expired token', status: 401 };
    }

    console.log('Authentication successful for user:', user.id);
    return { user, db };
  } catch (error) {
    console.error('Authentication error:', error);
    return { error: 'Authentication failed', status: 500 };
  }
}

// Alternative method using session from cookies (if you prefer cookie-based auth)
export async function authenticateRequestFromCookies(request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return { error: 'No cookies found', status: 401 };
    }

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});

    const token = cookies['auth-token'] || cookies['jwt-token'] || cookies['session-token'];
    if (!token) {
      return { error: 'No authentication token found in cookies', status: 401 };
    }

    const user = await authService.getUserByToken(token);
    if (!user) {
      return { error: 'Invalid or expired token', status: 401 };
    }

    return { user, db };
  } catch (error) {
    return { error: 'Authentication failed', status: 500 };
  }
}
