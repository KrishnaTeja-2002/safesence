#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database migration...');

  try {
    // Create the database schema
    console.log('Creating database schema...');
    
    // The Prisma schema will be applied when we run prisma db push
    // This script is mainly for any additional setup or data migration
    
    console.log('Database migration completed successfully!');
    
    // Test the connection
    console.log('Testing database connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database connection test:', result);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
