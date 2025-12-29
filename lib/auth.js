import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DatabaseClient } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export class AuthService {
  constructor() {
    this.db = new DatabaseClient();
  }

  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Register new user
  async register(email, password, username) {
    try {
      // Check if user already exists
      const existingUser = await this.db.findUserByEmail(email);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create user
      const user = await this.db.createUser({
        email,
        password: hashedPassword
      });

      // Create default user preferences
      await this.db.upsertUserPreferences(user.id, {
        tempScale: 'F',
        showTemp: true,
        showHumidity: false,
        showSensors: true,
        showUsers: true,
        showAlerts: true,
        showNotifications: true,
        timeZone: 'America/Anchorage',
        darkMode: false,
        username: username || email.split('@')[0]
      });

      // Generate token
      const token = this.generateToken(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.createdAt
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Validate using auth.users table
      const authUser = await this.db.findAuthUserByEmail(email);
      if (!authUser) throw new Error('Invalid credentials');

      // For existing accounts: Allow login if they have a password hash, even without email_confirmed_at
      // For new accounts: Require email verification
      // Check if this is an existing account (has password but no email_confirmed_at)
      const hasPassword = !!(authUser.encrypted_password && authUser.encrypted_password.trim() !== '');
      const isVerified = !!(authUser.email_confirmed_at || authUser.confirmed_at);
      
      // Only require verification for accounts that appear to be newly created (no password yet or recently created)
      // Existing accounts with passwords should be able to log in
      if (!isVerified && hasPassword) {
        // This is likely an existing account - auto-verify and allow login
        // Update email_confirmed_at for backward compatibility
        try {
          const { prisma } = await import('./prismaClient.js');
          await prisma.$executeRaw`
            UPDATE auth.users
            SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                updated_at = NOW()
            WHERE id = ${authUser.id}::uuid
              AND deleted_at IS NULL
          `;
          console.log('Auto-verified existing account for backward compatibility:', { email, userId: authUser.id });
        } catch (updateError) {
          console.warn('Failed to auto-verify existing account, but allowing login:', updateError.message);
          // Continue with login even if update fails
        }
      } else if (!isVerified && !hasPassword) {
        // New account without password - require verification
        throw new Error('Please verify your email before logging in');
      }

      // Check password from auth.users.encrypted_password
      const hash = authUser.encrypted_password || '';
      
      // Debug logging
      if (!hash || hash.trim() === '') {
        console.error('Login attempt with empty password hash:', { email, userId: authUser.id });
        throw new Error('Invalid credentials');
      }
      
      console.log('Login - comparing password:', {
        email,
        userId: authUser.id,
        hashLength: hash.length,
        hashPrefix: hash.substring(0, 20),
        isExistingAccount: hasPassword && !isVerified
      });
      
      const ok = await this.comparePassword(password, hash);
      
      if (!ok) {
        console.error('Login - password comparison failed:', { email, userId: authUser.id });
        throw new Error('Invalid credentials');
      }
      
      console.log('Login - password comparison successful:', { email, userId: authUser.id });

      const safeUser = { id: authUser.id, email: authUser.email, createdAt: authUser.created_at };
      const token = this.generateToken(safeUser);
      return { user: { id: safeUser.id, email: safeUser.email, created_at: safeUser.created_at }, token };
    } catch (error) {
      throw error;
    }
  }

  // Google SSO login
  async loginWithGoogle(googleUserData) {
    try {
      const { email, name, picture, sub: googleId } = googleUserData;
      
      if (!email) {
        throw new Error('Email is required for Google login');
      }

      // Find or create user
      let authUser = await this.db.findAuthUserByEmail(email);
      
      if (!authUser) {
        // Create new user from Google
        authUser = await this.db.createAuthUserFromGoogle({
          email,
          name,
          picture,
          googleId
        });
      }

      if (!authUser) {
        throw new Error('Failed to create or find user');
      }

      // Generate token
      const safeUser = { 
        id: authUser.id, 
        email: authUser.email, 
        createdAt: authUser.created_at 
      };
      const token = this.generateToken(safeUser);
      
      return { 
        user: { 
          id: safeUser.id, 
          email: safeUser.email, 
          created_at: safeUser.createdAt 
        }, 
        token 
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user by token
  async getUserByToken(token) {
    try {
      const decoded = this.verifyToken(token);
      if (!decoded) {
        return null;
      }

      // Prefer lookup by email to avoid uuid/text cast issues
      let user = null;
      if (decoded.email) {
        user = await this.db.findAuthUserByEmail(decoded.email);
      }
      if (!user && decoded.id) {
        // Fallback by id (id is uuid in auth.users)
        try {
          const rows = await this.db.prisma.$queryRawUnsafe(
            `select id, email, created_at from auth.users where id = '${decoded.id}'::uuid and (deleted_at is null) limit 1`
          );
          user = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        } catch {}
      }
      if (!user) return null;
      return { id: user.id, email: user.email, created_at: user.created_at };
    } catch (error) {
      return null;
    }
  }

  // Update user password
  async updatePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.db.findUserById(userId);
      if (!user || !user.password) {
        throw new Error('User not found or no password set');
      }

      // Verify current password
      const isValidPassword = await this.comparePassword(currentPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await this.db.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Reset password (for future implementation)
  async resetPassword(email) {
    // This would typically involve sending a reset email
    // For now, just throw an error
    throw new Error('Password reset not implemented yet');
  }
}

const authService = new AuthService();
export default authService;
