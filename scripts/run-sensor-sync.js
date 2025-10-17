#!/usr/bin/env node

/**
 * Script to sync sensor data from mqtt_consumer_test to public.sensors table
 * This ensures the dashboard shows correct online status
 */

const { execSync } = require('child_process');
const path = require('path');

async function runSensorSync() {
  console.log('🔄 Setting up sensor sync from mqtt_consumer_test to public.sensors...\n');

  try {
    // Read and execute the SQL script
    const sqlScript = path.join(__dirname, 'sync-mqtt-to-sensors.sql');
    const command = `psql "${process.env.DATABASE_URL}" -f "${sqlScript}"`;
    
    console.log('📝 Creating sync functions and triggers...');
    execSync(command, { stdio: 'inherit' });
    
    console.log('\n✅ Sync setup completed successfully!');
    console.log('\n📋 What was set up:');
    console.log('  • Trigger function to auto-sync new readings');
    console.log('  • Manual sync function for existing data');
    console.log('  • Automatic trigger on mqtt_consumer_test table');
    
    console.log('\n🚀 Next steps:');
    console.log('  1. Your dashboard should now show correct online status');
    console.log('  2. New readings will automatically update sensor status');
    console.log('  3. Run manual sync if needed: SELECT sync_all_recent_sensors();');
    
    console.log('\n💡 Dashboard Status:');
    console.log('  • Sensors will now show "online" if they have recent data');
    console.log('  • Status updates automatically every time new data arrives');
    console.log('  • Offline detection: 30+ minutes without data');
    
  } catch (error) {
    console.error('❌ Error setting up sensor sync:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('  • Check DATABASE_URL environment variable');
    console.log('  • Ensure you have access to the database');
    console.log('  • Verify the mqtt_consumer_test table exists');
    process.exit(1);
  }
}

// Run the setup
runSensorSync();
