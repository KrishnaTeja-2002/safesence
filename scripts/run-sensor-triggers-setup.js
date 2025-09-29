#!/usr/bin/env node

/**
 * Script to set up sensor status triggers and functions
 * Run this script to install the automatic sensor status management system
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function setupSensorTriggers() {
  try {
    console.log('🚀 Setting up sensor status management system...');
    
    // Read the SQL file
    const sqlFile = join(__dirname, 'setup-sensor-status-triggers.sql');
    const sqlContent = readFileSync(sqlFile, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`  ${i + 1}/${statements.length}: Executing statement...`);
          await prisma.$executeRawUnsafe(statement);
        } catch (error) {
          // Some statements might fail if they already exist, which is okay
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate key')) {
            console.log(`    ⚠️  Statement skipped (already exists or not applicable)`);
          } else {
            console.error(`    ❌ Error executing statement:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Sensor status management system installed successfully!');
    
    // Get summary of current sensor statuses
    const summary = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as count
      FROM public.sensors 
      GROUP BY status
      ORDER BY status
    `;
    
    console.log('\n📊 Current sensor status summary:');
    summary.forEach(row => {
      console.log(`  ${row.status}: ${row.count} sensors`);
    });
    
    console.log('\n🎯 System features:');
    console.log('  ✅ Automatic status calculation based on min/max limits');
    console.log('  ✅ Warning thresholds (10% of limits)');
    console.log('  ✅ Offline detection (30 minutes without data)');
    console.log('  ✅ Auto-recovery when new data arrives');
    console.log('  ✅ Database triggers for real-time updates');
    
    console.log('\n📋 Next steps:');
    console.log('  1. Set min_limit and max_limit for your sensors');
    console.log('  2. Update sensor data regularly to keep status current');
    console.log('  3. Optionally set up a cron job to call /api/check-offline-sensors');
    
  } catch (error) {
    console.error('❌ Error setting up sensor triggers:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupSensorTriggers();
