#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Checking for auth schema and auth.users...');

    const schemas = await prisma.$queryRawUnsafe(
      "select nspname as schema from pg_namespace where nspname = 'auth'"
    );
    const hasAuthSchema = Array.isArray(schemas) && schemas.length > 0;
    console.log('auth schema present:', hasAuthSchema);

    const tables = await prisma.$queryRawUnsafe(
      "select table_schema, table_name from information_schema.tables where table_schema = 'auth' order by table_name"
    );
    console.log('auth tables:', tables);

    let usersCount = null;
    if (hasAuthSchema) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          "select count(*)::int as count from auth.users"
        );
        usersCount = rows?.[0]?.count ?? 0;
      } catch (e) {
        // table might not exist
      }
    }
    console.log('auth.users count:', usersCount);
  } catch (e) {
    console.error('Check failed:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();


