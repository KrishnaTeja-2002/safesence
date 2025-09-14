#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const cols = await prisma.$queryRawUnsafe(
      "select column_name, data_type from information_schema.columns where table_schema='auth' and table_name='users' order by ordinal_position"
    );
    console.log('auth.users columns:', cols);

    const sample = await prisma.$queryRawUnsafe(
      "select * from auth.users limit 1"
    );
    console.log('auth.users sample keys:', sample?.[0] ? Object.keys(sample[0]) : []);
  } catch (e) {
    console.error('inspect failed:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();


