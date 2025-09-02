# API Migration Guide

This guide documents the migration from direct Supabase queries to authenticated API endpoints.

## Overview

The application has been updated to use API endpoints instead of direct SQL queries to Supabase. This provides better security, authentication, and centralized data access control.

## New API Endpoints

### Authentication Middleware
- **File**: `src/app/api/middleware/auth.js`
- **Purpose**: Verifies JWT tokens and provides authenticated Supabase client
- **Usage**: Used by all API routes to authenticate requests

### User Preferences API
- **Endpoint**: `/api/user-preferences`
- **Methods**: GET, PUT
- **Purpose**: Manage user preferences and settings
- **Authentication**: Required

### Sensors API
- **Endpoint**: `/api/sensors`
- **Methods**: GET, PUT
- **Purpose**: Fetch sensors data and update thresholds
- **Authentication**: Required

### Sensor Readings API
- **Endpoint**: `/api/sensors/[id]/readings`
- **Methods**: GET
- **Purpose**: Fetch historical sensor readings
- **Authentication**: Required
- **Query Parameters**: 
  - `start_time`: ISO timestamp for start of range
  - `end_time`: ISO timestamp for end of range
  - `limit`: Maximum number of records (default: 20000)

### Alerts API
- **Endpoint**: `/api/alerts`
- **Methods**: GET, PUT
- **Purpose**: Fetch alerts data and update thresholds
- **Authentication**: Required

## API Client

### File: `src/app/lib/apiClient.js`

A client-side utility that handles:
- Automatic JWT token retrieval from Supabase session
- Request authentication headers
- Error handling
- API endpoint abstraction

### Usage Example

```javascript
import apiClient from '../lib/apiClient';

// Get user preferences
const preferences = await apiClient.getUserPreferences();

// Update sensor thresholds
await apiClient.updateSensorThresholds(sensorId, {
  min_limit: 20,
  max_limit: 80,
  warning_limit: 10
});

// Get sensor readings
const readings = await apiClient.getSensorReadings(sensorId, {
  startTime: '2024-01-01T00:00:00Z',
  limit: 1000
});
```

## Environment Variables

You need to set the following environment variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://kwaylmatpkcajsctujor.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M


# Supabase Service Role Key (for API routes - server-side only)
# This key bypasses RLS and should be kept secret
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTI0MDAyNCwiZXhwIjoyMDcwODE2MDI0fQ.JA8hvdpcrJYOaSeG3YBqJWJvIdVjrR2-qY8lkSr7f6c
```

## Migration Changes

### Pages Updated

1. **Account Page** (`src/app/account/page.js`)
   - Replaced direct `user_preferences` queries with API calls
   - Uses `apiClient.getUserPreferences()` and `apiClient.updateUserPreferences()`

2. **Dashboard Page** (`src/app/dashboard/page.js`)
   - Replaced direct `sensors` queries with API calls
   - Uses `apiClient.getSensors()`

3. **History Page** (`src/app/history/page.js`)
   - Replaced direct `sensors` and `raw_readings_v2` queries with API calls
   - Uses `apiClient.getSensors()` and `apiClient.getSensorReadings()`

4. **Alerts Page** (`src/app/alerts/page.js`)
   - Replaced direct `sensors` queries with API calls
   - Uses `apiClient.getAlerts()` and `apiClient.updateAlertThresholds()`

5. **Sensors Page** (`src/app/sensors/page.js`)
   - Replaced direct `sensors` queries with API calls
   - Uses `apiClient.getSensors()`

## Security Benefits

1. **Authentication**: All API requests are authenticated using JWT tokens
2. **Authorization**: Server-side validation of user permissions
3. **Data Validation**: Input validation and sanitization on API endpoints
4. **Rate Limiting**: Can be easily added to API routes
5. **Audit Logging**: API calls can be logged for security monitoring

## Error Handling

The API client includes comprehensive error handling:
- Network errors
- Authentication failures
- Server errors
- Invalid responses

All errors are logged to the console and can be caught by the calling code.

## Next Steps

1. Set up the `SUPABASE_SERVICE_ROLE_KEY` environment variable
2. Test all API endpoints to ensure they work correctly
3. Consider adding rate limiting to API routes
4. Add API response caching if needed
5. Implement API versioning for future changes

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure the user is logged in and has a valid session
2. **Service Role Key**: Make sure `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. **CORS Issues**: API routes should work within the same domain
4. **RLS Policies**: Service role key bypasses RLS, but ensure your policies are correct for direct client access

### Debug Mode

Enable debug logging by adding console.log statements in the API client or middleware to trace request flow.
