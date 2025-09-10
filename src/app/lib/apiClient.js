import { createClient } from '@supabase/supabase-js';

// Create Supabase client for getting auth tokens
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kwaylmatpkcajsctujor.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M"
);

class ApiClient {
  constructor() {
    this.baseUrl = '/api';
  }

  async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${this.baseUrl}${endpoint}`;
      
      console.log('Making API request to:', url);
      console.log('Headers:', headers);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('API Success Response:', data);
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // User Preferences API
  async getUserPreferences() {
    return this.request('/user-preferences');
  }

  async updateUserPreferences(preferences) {
    return this.request('/user-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
  }

  // Sensors API
  async getSensors() {
    return this.request('/sensors');
  }

  async updateSensorThresholds(sensorId, thresholds) {
    return this.request('/sensors', {
      method: 'PUT',
      body: JSON.stringify({
        sensor_id: sensorId,
        ...thresholds
      })
    });
  }

  // Sensor Readings API
  async getSensorReadings(sensorId, options = {}) {
    const params = new URLSearchParams();
    if (options.startTime) params.append('start_time', options.startTime);
    if (options.endTime) params.append('end_time', options.endTime);
    if (options.limit) params.append('limit', options.limit);
    
    const queryString = params.toString();
    const endpoint = `/sensors/${sensorId}/readings${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  // Alerts API
  async getAlerts() {
    return this.request('/alerts');
  }

  async updateAlertThresholds(sensorId, thresholds) {
    return this.request('/alerts', {
      method: 'PUT',
      body: JSON.stringify({
        sensor_id: sensorId,
        ...thresholds
      })
    });
  }

  // Sharing API
  async shareSensor({ sensorId, role, email, userId }) {
    return this.request('/shares', {
      method: 'POST',
      body: JSON.stringify({
        sensor_id: sensorId,
        role,
        email,
        user_id: userId
      })
    });
  }

  async revokeShare({ sensorId, userId }) {
    const params = new URLSearchParams({ sensor_id: sensorId, user_id: userId });
    return this.request(`/shares?${params.toString()}`, { method: 'DELETE' });
  }

  async cancelInvite({ sensorId, email }) {
    const params = new URLSearchParams({ sensor_id: sensorId, email });
    return this.request(`/shares?${params.toString()}`, { method: 'DELETE' });
  }

  async getSensorShares(sensorId) {
    const params = new URLSearchParams({ sensor_id: sensorId });
    return this.request(`/shares?${params.toString()}`);
  }

  // Alert Preferences API
  async getAlertPreferences(sensorId) {
    const params = new URLSearchParams({ sensor_id: sensorId });
    return this.request(`/alert-preferences?${params.toString()}`);
  }

  async updateAlertPreferences(sensorId, preferences) {
    return this.request('/alert-preferences', {
      method: 'PUT',
      body: JSON.stringify({
        sensor_id: sensorId,
        ...preferences
      })
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
