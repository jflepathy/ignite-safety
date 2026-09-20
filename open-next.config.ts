import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({
  // Using the default in-memory/no-op incremental cache for now (no R2
  // bucket configured). Revalidation/ISR isn't relied on by this app —
  // every page reads live from the database — so this is fine as-is.
});
