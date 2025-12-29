import { prisma } from './prismaClient.js';
import crypto from 'crypto';

/**
 * Device Service for tracking user devices and detecting new devices
 */
export class DeviceService {
  /**
   * Generate device fingerprint from user agent and IP
   */
  generateDeviceFingerprint(userAgent, ipAddress) {
    const data = `${userAgent || ''}|${ipAddress || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if device is known for user
   */
  async isKnownDevice(userId, deviceFingerprint) {
    try {
      const result = await prisma.$queryRaw`
        SELECT 1 FROM public.user_devices
        WHERE user_id = ${userId}::uuid 
        AND device_fingerprint = ${deviceFingerprint}
        LIMIT 1
      `;
      return Array.isArray(result) && result.length > 0;
    } catch (error) {
      console.error('Error checking known device:', error);
      return false; // On error, treat as unknown device for security
    }
  }

  /**
   * Register or update device
   */
  async registerDevice(userId, deviceFingerprint, deviceName, userAgent, ipAddress) {
    try {
      await prisma.$executeRaw`
        INSERT INTO public.user_devices (
          user_id,
          device_fingerprint,
          device_name,
          user_agent,
          ip_address,
          last_used_at,
          created_at
        ) VALUES (
          ${userId}::uuid,
          ${deviceFingerprint},
          ${deviceName || null},
          ${userAgent || null},
          ${ipAddress || null},
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, device_fingerprint) 
        DO UPDATE SET 
          last_used_at = NOW(),
          user_agent = EXCLUDED.user_agent,
          ip_address = EXCLUDED.ip_address
      `;
      return true;
    } catch (error) {
      console.error('Error registering device:', error);
      return false;
    }
  }

  /**
   * Get device name from user agent
   */
  getDeviceName(userAgent) {
    if (!userAgent) return 'Unknown Device';
    
    // Simple device detection
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return 'Mobile Device';
    }
    if (userAgent.includes('Windows')) {
      return 'Windows Device';
    }
    if (userAgent.includes('Mac')) {
      return 'Mac Device';
    }
    if (userAgent.includes('Linux')) {
      return 'Linux Device';
    }
    return 'Web Browser';
  }
}

export default new DeviceService();

