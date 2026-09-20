// Standalone-script-only Prisma client — for prisma/seed.ts and
// prisma/import-clients.ts, run locally via `tsx`, NOT for app code.
//
// src/lib/prisma.ts (the app's shared client) deliberately imports from
// "@prisma/client/wasm", because that's the only build that can run on
// Cloudflare Workers (see the comments there for the full story). But the
// wasm build's engine loader is workerd/edge-runtime-specific — it expects
// the runtime to hand it a WebAssembly.Module the way Workers does, and
// fails ("the loaded wasm module was unexpectedly undefined or null") when
// run under plain Node via tsx, which these one-off scripts are.
//
// So this file uses the plain "@prisma/client" import instead, which under
// Node resolves to the classic native-binary ("library") engine — and that
// engine runs fine locally in this sandbox. It's still paired with the same
// PrismaNeonHTTP adapter as the app, so all actual database I/O still goes
// over plain HTTPS (not a raw TCP connection, which this sandbox can't
// make) — only the query-planning engine differs between this and the
// Workers build.
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const adapter = new PrismaNeonHTTP(connectionString, {});
export const prisma = new PrismaClient({ adapter, log: ['error'] });
