class ApiClient {
  constructor() {
    this.baseUrl = '/api';
  }

  async getAuthHeaders() {
    // Get token from localStorage or cookies
    let token = null;
    
    // Try to get from localStorage first (for client-side)
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('auth-token');
    }
    
    // If no token in localStorage, try to get from cookies
    if (!token && typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth-token') {
          token = value;
          break;
        }
      }
    }
    
    // Always return headers; include Authorization only if we actually found a token.
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async request(endpoint, options = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${this.baseUrl}${endpoint}`;
      
      console.log('Making API request to:', url);
      console.log('Headers:', headers);
      
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...headers,
          ...options.headers
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response as JSON:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      let data;
      try {
        data = await response.json();
        console.log('API Success Response:', data);
        return data;
      } catch (parseError) {
        console.error('Failed to parse success response as JSON:', parseError);
        throw new Error('Invalid JSON response from server');
      }
    } catch (error) {
      console.error('API request failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        endpoint,
        method: options.method || 'GET'
      });
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

  // Sync Sensors API - Syncs data from mqtt_consumer_test to sensors table
  async syncSensors() {
    return this.request('/sync-sensors');
  }
  async getDevices() {
    return this.request('/devices');
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

  async updateAlertThresholds(sensorId, thresholds, deviceId) {
    console.log('updateAlertThresholds called with:', { sensorId, thresholds, deviceId });
    const requestBody = {
      sensor_id: sensorId,
      device_id: deviceId ?? thresholds?.device_id,
      ...thresholds
    };
    console.log('Request body:', requestBody);
    
    try {
      const result = await this.request('/alerts', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });
      console.log('updateAlertThresholds success:', result);
      return result;
    } catch (error) {
      console.error('updateAlertThresholds error:', error);
      throw error;
    }
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

  // Devices API
  async getDevices() {
    return this.request('/devices');
  }

  async createDevice(deviceData) {
    return this.request('/devices', {
      method: 'POST',
      body: JSON.stringify(deviceData)
    });
  }

  async updateDevice(deviceId, deviceData) {
    return this.request('/devices', {
      method: 'PUT',
      body: JSON.stringify({
        deviceId,
        ...deviceData
      })
    });
  }

  async deleteDevice(deviceId) {
    const params = new URLSearchParams({ deviceId });
    return this.request(`/devices?${params.toString()}`, { method: 'DELETE' });
  }

  // Team Invitations API
  async sendTeamInvite({ sensorId, role, email }) {
    return this.request('/sendInvite', {
      method: 'POST',
      body: JSON.stringify({
        sensorId,
        role,
        email
      })
    });
  }

  // Sensor Groups API
  async getSensorGroups() {
    return this.request('/sensor-groups');
  }

  async createSensorGroup({ name, sensorIds }) {
    return this.request('/sensor-groups', {
      method: 'POST',
      body: JSON.stringify({
        name,
        sensorIds
      })
    });
  }

  async updateSensorGroup({ id, name, sensorIds }) {
    return this.request('/sensor-groups', {
      method: 'PUT',
      body: JSON.stringify({
        id,
        name,
        sensorIds
      })
    });
  }

  async deleteSensorGroup(id) {
    const params = new URLSearchParams({ id });
    return this.request(`/sensor-groups?${params.toString()}`, { method: 'DELETE' });
  }

  // Batch Assignment API
  async batchAssignAccess({ email, role, selectAll, groupIds, sensorIds }) {
    return this.request('/shares/batch', {
      method: 'POST',
      body: JSON.stringify({
        email,
        role,
        selectAll,
        groupIds,
        sensorIds
      })
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
