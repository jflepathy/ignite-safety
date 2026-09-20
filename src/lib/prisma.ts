import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Neon's HTTP driver (fetch-based, no raw TCP / WebSocket) so the same
// client works identically in the Cloudflare Worker runtime, in `next dev`,
// and in one-off Node scripts (seed.ts, import-clients.ts) run from any
// environment — including ones where only outbound HTTPS is available.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const adapter = new PrismaNeonHTTP(connectionString, {});
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
