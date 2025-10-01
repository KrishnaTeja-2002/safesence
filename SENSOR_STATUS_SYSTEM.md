# Sensor Status Management System

This system automatically manages sensor status based on data values and time thresholds using PostgreSQL triggers and functions.

## Features

### 🎯 Automatic Status Calculation
- **Value-based status**: Set status based on min/max limits with warning thresholds
- **Time-based status**: Mark sensors as offline if no data for 30 minutes
- **Auto-recovery**: Set to online when new data arrives
- **Real-time updates**: Database triggers automatically update status

### 📊 Status Types
- **`ok`**: Sensor reading is within normal limits
- **`warning`**: Sensor reading is within 10% of min/max limits
- **`alert`**: Sensor reading exceeds min/max limits
- **`offline`**: No data received for 30+ minutes

## Database Schema Changes

### New Columns Added to `sensors` Table
```sql
ALTER TABLE public.sensors ADD COLUMN min_limit DECIMAL(10,2);
ALTER TABLE public.sensors ADD COLUMN max_limit DECIMAL(10,2);
```

### Functions Created
- `calculate_sensor_status()` - Calculates status based on value and limits
- `check_sensor_offline_status()` - Checks if sensor should be offline
- `update_sensor_status()` - Trigger function for automatic updates
- `check_all_sensors_offline()` - Batch check for offline sensors

### Triggers Created
- `sensor_status_trigger` - Updates status on sensor UPDATE
- `sensor_status_insert_trigger` - Updates status on sensor INSERT

## Installation

### 1. Run the Setup Script
```bash
node scripts/run-sensor-triggers-setup.js
```

### 2. Or Execute SQL Manually
```bash
psql -d your_database -f scripts/setup-sensor-status-triggers.sql
```

## Usage

### Setting Sensor Limits
```javascript
// Update sensor with limits
await apiClient.updateSensorThresholds('sensor-123', {
  minLimit: 20.0,    // Minimum temperature
  maxLimit: 80.0,    // Maximum temperature
  warningLimit: 10   // Warning threshold percentage (default: 10%)
});
```

### Updating Sensor Data
```javascript
// Update sensor with new reading (triggers automatic status update)
await apiClient.updateSensorThresholds('sensor-123', {
  latestTemp: 25.5   // New temperature reading
});
```

### API Endpoints

#### Test Sensor Status
```bash
# Test status calculation
POST /api/test-sensor-status
{
  "sensorId": "sensor-123",
  "latestTemp": 25.5,
  "minLimit": 20.0,
  "maxLimit": 80.0,
  "warningLimit": 10
}

# Get current sensor statuses
GET /api/test-sensor-status?sensorId=sensor-123
```

#### Check Offline Sensors
```bash
# Manually check for offline sensors
POST /api/check-offline-sensors

# Get sensor status summary
GET /api/check-offline-sensors
```

## Status Logic

### Value-Based Status
1. **Alert**: `value < minLimit` OR `value > maxLimit`
2. **Warning**: `value < (minLimit + 10%)` OR `value > (maxLimit - 10%)`
3. **OK**: Value is within normal range

### Time-Based Status
1. **Offline**: `lastFetchedTime` is NULL OR > 30 minutes ago
2. **Online**: Data received within last 30 minutes

### Final Status Priority
1. **Offline** (highest priority) - No data for 30+ minutes
2. **Alert** - Value exceeds limits
3. **Warning** - Value near limits
4. **OK** - Normal operation

## Monitoring

### Scheduled Checks
Set up a cron job to periodically check for offline sensors:

```bash
# Run every 5 minutes
*/5 * * * * curl -X POST https://your-domain.com/api/check-offline-sensors
```

### Dashboard Integration
The dashboard automatically displays sensor status with color coding:
- 🟢 **Green**: OK status
- 🟡 **Yellow**: Warning status  
- 🔴 **Red**: Alert status
- ⚫ **Gray**: Offline status

## Examples

### Example 1: Temperature Sensor
```sql
-- Set limits for temperature sensor
UPDATE public.sensors 
SET min_limit = 20.0, max_limit = 80.0, warning_limit = 10
WHERE sensor_id = 'temp-sensor-001';

-- Update with new reading
UPDATE public.sensors 
SET latest_temp = 25.5, last_fetched_time = NOW()
WHERE sensor_id = 'temp-sensor-001';
-- Status automatically becomes 'ok'
```

### Example 2: Alert Condition
```sql
-- Update with alert value
UPDATE public.sensors 
SET latest_temp = 85.0, last_fetched_time = NOW()
WHERE sensor_id = 'temp-sensor-001';
-- Status automatically becomes 'alert'
```

### Example 3: Offline Detection
```sql
-- Simulate no data for 35 minutes
UPDATE public.sensors 
SET last_fetched_time = NOW() - INTERVAL '35 minutes'
WHERE sensor_id = 'temp-sensor-001';
-- Status automatically becomes 'offline'
```

## Troubleshooting

### Check Trigger Status
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%sensor_status%';
```

### Test Functions Manually
```sql
-- Test status calculation
SELECT calculate_sensor_status(25.5, 20.0, 80.0, 10);

-- Test offline check
SELECT check_sensor_offline_status(NOW() - INTERVAL '35 minutes');
```

### View Current Statuses
```sql
SELECT 
  sensor_id,
  sensor_name,
  latest_temp,
  min_limit,
  max_limit,
  status,
  last_fetched_time
FROM public.sensors 
ORDER BY status, sensor_name;
```

## Performance

### Indexes Created
- `idx_sensors_last_fetched_time` - For time-based queries
- `idx_sensors_status` - For status-based queries

### Optimization Tips
1. Use the periodic check API instead of real-time checks
2. Batch sensor updates when possible
3. Monitor query performance with large sensor counts

## Security

- All functions run with database privileges
- Triggers are automatically applied to all sensor updates
- No external dependencies required
- Status calculation is deterministic and consistent





