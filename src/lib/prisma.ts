// Imported from the explicit "/wasm" build (not the bare "@prisma/client"
// specifier), and marked external for webpack via serverComponentsExternalPackages
// (see next.config.js). Both pieces matter:
//  - Staying external stops webpack from trying to bundle the wasm binary
//    itself during this Next build, which it can't do (wasm.mjs — the file
//    Prisma's own "import" condition points to — doesn't actually exist,
//    and even redirected to the real wasm.js, webpack's wasm support chokes
//    on parsing Prisma's compiled query engine).
//  - Using the explicit "/wasm" subpath, rather than the bare specifier,
//    avoids a separate ambiguity one step later: when OpenNext's own esbuild
//    pass bundles this external require for the actual Workers deploy, its
//    node-platform default condition ("node") and Cloudflare's condition
//    ("workerd") both appear on @prisma/client's *root* export map — and
//    "node" wins because it's listed first, resolving to the native-binary
//    build (the "could not locate the Query Engine for runtime
//    debian-openssl-1.1.x" production error this setup previously hit). The
//    "/wasm" subpath's own export map has no such platform branching (only
//    require-vs-import), so it resolves to the correct wasm build
//    unambiguously either way.
import { PrismaClient, Prisma } from '@prisma/client/wasm';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';

export { Prisma };

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Neon's HTTP driver (fetch-based, no raw TCP or WebSocket) — this is the
// adapter Neon's own docs recommend for Cloudflare Workers, and it's the
// one confirmed working end-to-end in this deployment (the WebSocket-based
// PrismaNeon/Pool adapter was tried first but failed at runtime on Workers
// with an unrelated native-engine-binary error that wasn't worth chasing
// further once this proven alternative was in hand).
//
// The one real limitation: PrismaNeonHTTP does not support Prisma's
// implicit transactions, which rules out `$transaction()` and `upsert()`
// (upsert is internally wrapped in a transaction). Every call site that
// needed either has been rewritten as a plain sequential find-then-write —
// see the comments at each one. Nothing else about querying is affected.
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
