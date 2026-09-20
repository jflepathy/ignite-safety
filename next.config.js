/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // Leave @prisma/client (and friends) as an external `require()` in the
    // Next server bundle instead of letting webpack inline it. Webpack's
    // wasm handling is what breaks when it tries to bundle Prisma's wasm
    // query engine directly; left external, OpenNext's own esbuild pass
    // resolves it later with the "workerd" package-export condition, which
    // correctly picks Prisma's wasm build (no native engine binary needed —
    // required for this to run on Cloudflare Workers at all).
    serverComponentsExternalPackages: ['@prisma/client', '@prisma/adapter-neon', '@neondatabase/serverless'],
    // Next's own build tracer (@vercel/nft, used to populate both
    // .next/standalone and — via that — OpenNext's server bundle) decides
    // which node_modules files to carry forward by static analysis, using
    // plain Node resolution. It never sees Prisma's wasm build (only
    // reachable through the "workerd" package-export condition, which is
    // Cloudflare-specific), so it silently drops wasm.js, the compiled
    // query_engine_bg.wasm binary, and their loaders — leaving only the
    // native-binary build, which can't run on Workers at all. Forcing them
    // into the trace here is what makes them actually present on disk for
    // OpenNext's later esbuild pass to find and bundle.
    outputFileTracingIncludes: {
      '/**': [
        './node_modules/.prisma/client/wasm.js',
        './node_modules/.prisma/client/wasm.d.ts',
        './node_modules/.prisma/client/wasm-worker-loader.mjs',
        './node_modules/.prisma/client/wasm-edge-light-loader.mjs',
        './node_modules/.prisma/client/query_engine_bg.wasm',
        './node_modules/.prisma/client/query_engine_bg.js',
        './node_modules/@prisma/client/wasm.js',
        './node_modules/@prisma/client/wasm.d.ts',
      ],
    },
  },
};

module.exports = nextConfig;

import('@opennextjs/cloudflare').then(({ initOpenNextCloudflareForDev }) => {
  initOpenNextCloudflareForDev();
});
