#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runReplayMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    // Read the SQL file
    const sqlPath = join(__dirname, 'add-replay-field.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('\\nExecuting replay field migration...');
    console.log('This will:');
    console.log('  - Add replay BOOLEAN column to mqtt_consumer_test');
    console.log('  - Create optimized indexes for 24h queries');
    console.log('  - Add partial indexes for live data filtering');
    console.log('');

    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Update ESP32 firmware to include replay field in MQTT messages');
    console.log('  2. Update Telegraf configuration to map replay field');
    console.log('  3. Test end-to-end flow: ESP32 → MQTT → Telegraf → Database');
    console.log('  4. See ESP32_REPLAY_FIELD.md for implementation details');
    console.log('');

    // Verify the changes
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mqtt_consumer_test'
        AND column_name = 'replay'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verified: replay column exists');
      console.log('   Type:', result.rows[0].data_type);
      console.log('   Default:', result.rows[0].column_default);
    } else {
      console.warn('⚠️  Warning: Could not verify replay column');
    }

    // Check indexes
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'mqtt_consumer_test'
        AND indexname LIKE '%replay%' OR indexname LIKE '%sensor_time%'
    `);

    if (indexes.rows.length > 0) {
      console.log('\\n✅ Created indexes:');
      indexes.rows.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
    }

  } catch (error) {
    console.error('\\n❌ Migration failed:', error.message);
    console.error('\\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\\nDisconnected from database');
  }
}

// Run the migration
runReplayMigration().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

