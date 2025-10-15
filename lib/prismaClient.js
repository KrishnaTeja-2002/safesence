import { PrismaClient } from '@prisma/client';

// Ensure we reuse a single PrismaClient across hot reloads and route invocations
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__safesensePrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__safesensePrisma = prisma;
}

export async function ensurePrismaConnected() {
  try {
    // A lightweight query to ensure connection is alive
    await prisma.$queryRaw`select 1`;
  } catch {
    try {
      await prisma.$connect();
    } catch {}
  }
}


