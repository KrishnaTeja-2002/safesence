# ESP32 Firmware - Replay Field Implementation

## Overview
The ESP32 firmware now includes a `replay` field in MQTT messages to distinguish between:
- **Live data** (`replay: false` or omitted) - Real-time sensor readings
- **Backfilled data** (`replay: true`) - Historical data sent after reconnection

This prevents duplicate data during ESP32 reconnections and enables proper time-series analysis.

## JSON Message Format

### Live Data (Real-time)
```json
{
  "sensor_id": "device123/temp_sensor_01",
  "reading_value": 23.5,
  "timestamp": 1698765432,
  "replay": false
}
```

### Backfilled Data (Historical)
```json
{
  "sensor_id": "device123/temp_sensor_01",
  "reading_value": 22.1,
  "timestamp": 1698765132,
  "replay": true
}
```

## ESP32 Implementation Example

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

WiFiClient espClient;
PubSubClient client(espClient);

// Offline buffer for storing readings during disconnection
struct SensorReading {
  float value;
  unsigned long timestamp;
};

std::vector<SensorReading> offlineBuffer;
const int MAX_BUFFER_SIZE = 1000; // Adjust based on ESP32 memory

void publishReading(float value, unsigned long timestamp, bool isReplay) {
  StaticJsonDocument<200> doc;
  
  doc["sensor_id"] = String(DEVICE_ID) + "/" + String(SENSOR_ID);
  doc["reading_value"] = value;
  doc["timestamp"] = timestamp;
  doc["replay"] = isReplay;
  
  char jsonBuffer[200];
  serializeJson(doc, jsonBuffer);
  
  client.publish(MQTT_TOPIC, jsonBuffer);
}

void sendLiveReading(float sensorValue) {
  unsigned long currentTime = millis() / 1000; // Unix timestamp
  
  if (client.connected()) {
    // Send live data
    publishReading(sensorValue, currentTime, false);
  } else {
    // Store in offline buffer
    if (offlineBuffer.size() < MAX_BUFFER_SIZE) {
      offlineBuffer.push_back({sensorValue, currentTime});
    }
  }
}

void flushOfflineBuffer() {
  if (!client.connected()) return;
  
  // Send all buffered readings as replay data
  for (const auto& reading : offlineBuffer) {
    publishReading(reading.value, reading.timestamp, true);
    delay(10); // Throttle to avoid overwhelming MQTT broker
  }
  
  offlineBuffer.clear();
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(CLIENT_ID)) {
      Serial.println("connected");
      
      // Flush any offline data after reconnection
      if (!offlineBuffer.empty()) {
        Serial.printf("Flushing %d buffered readings\\n", offlineBuffer.size());
        flushOfflineBuffer();
      }
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Read sensor and send live data
  float temperature = readTemperatureSensor();
  sendLiveReading(temperature);
  
  delay(1000); // Adjust based on your sampling rate
}
```

## Telegraf Configuration

Update your Telegraf MQTT consumer to handle the replay field:

```toml
[[inputs.mqtt_consumer]]
  servers = ["tcp://localhost:1883"]
  topics = ["sensors/#"]
  data_format = "json"
  
  # Map JSON fields to InfluxDB fields
  json_name_key = "sensor_id"
  json_time_key = "timestamp"
  json_time_format = "unix"
  
  # Tag replay field for filtering
  tag_keys = ["replay"]

[[outputs.postgresql]]
  address = "postgres://user:pass@localhost:5432/dbname"
  
  # Write to mqtt_consumer_test table
  schema = "public"
  table = "mqtt_consumer_test"
  
  # Column mapping
  [[outputs.postgresql.column]]
    name = "time"
    type = "timestamp"
    value = "{{.Time}}"
  
  [[outputs.postgresql.column]]
    name = "sensor_id"
    type = "text"
    value = "{{.Fields.sensor_id}}"
  
  [[outputs.postgresql.column]]
    name = "reading_value"
    type = "float"
    value = "{{.Fields.reading_value}}"
  
  [[outputs.postgresql.column]]
    name = "replay"
    type = "boolean"
    value = "{{.Tags.replay}}"
  
  [[outputs.postgresql.column]]
    name = "mqtt_topic"
    type = "text"
    value = "{{.Topic}}"
```

## Database Schema

The `mqtt_consumer_test` table includes:

```sql
CREATE TABLE public.mqtt_consumer_test (
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  sensor_id TEXT NOT NULL,
  mqtt_topic TEXT,
  reading_value FLOAT,
  replay BOOLEAN DEFAULT false,
  UNIQUE(sensor_id, time)  -- Prevents duplicates
);

-- Optimized indexes for 24h queries
CREATE INDEX idx_mqtt_consumer_test_sensor_time 
ON mqtt_consumer_test (sensor_id, time DESC);

CREATE INDEX idx_mqtt_consumer_test_live 
ON mqtt_consumer_test (sensor_id, time DESC) 
WHERE COALESCE(replay, false) = false;
```

## API Usage

### Query live data only (default)
```bash
GET /api/sensors/temp_sensor_01/readings
# Returns only live data (replay=false)
```

### Include replay/backfilled data
```bash
GET /api/sensors/temp_sensor_01/readings?include_replay=true
# Returns all data including backfilled readings
```

### Optimized 24h query
```bash
GET /api/sensors/temp_sensor_01/readings-24h
# Returns aggregated 24h data with ~200 points for fast chart rendering
```

## Testing End-to-End Flow

1. **Simulate offline buffer**:
   ```cpp
   // Disconnect WiFi
   WiFi.disconnect();
   
   // Take 10 readings (these go to buffer)
   for (int i = 0; i < 10; i++) {
     float temp = readTemperatureSensor();
     sendLiveReading(temp);
     delay(1000);
   }
   
   // Reconnect WiFi
   WiFi.reconnect();
   reconnect(); // Will flush buffer with replay=true
   ```

2. **Verify in database**:
   ```sql
   -- Check for replay data
   SELECT time, sensor_id, reading_value, replay
   FROM mqtt_consumer_test
   WHERE sensor_id LIKE '%temp_sensor_01%'
   ORDER BY time DESC
   LIMIT 20;
   ```

3. **Test deduplication**:
   The unique constraint on `(sensor_id, time)` prevents duplicate entries even if the same reading is sent multiple times.

## Benefits

1. **Deduplication**: Unique constraint prevents duplicate data during reconnections
2. **Data Integrity**: Clearly distinguish live vs backfilled data for analysis
3. **Performance**: Filtered queries (`replay=false`) are faster with partial indexes
4. **Debugging**: Easy to identify connection issues by checking replay=true counts
5. **Compliance**: Audit trail shows which data was delayed/backfilled

## Migration Path

If you have existing ESP32 firmware:

1. Deploy database schema changes (add replay field + indexes)
2. Update Telegraf configuration to handle replay field
3. Update ESP32 firmware with offline buffering + replay logic
4. Legacy data (without replay field) defaults to `replay=false`

No downtime required - backward compatible!

