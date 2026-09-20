// Explicit "/wasm" import, left external — see src/lib/prisma.ts for why.
import { Prisma } from '@prisma/client/wasm';

/**
 * Deep-converts Prisma Decimal instances and Date objects into plain
 * strings so the result is safe to pass as a prop from a Server Component
 * to a Client Component.
 *
 * Root cause this fixes: Next.js's React Server Components boundary only
 * accepts plain serializable values (objects/arrays/primitives/Date/a
 * short allow-list) as props into a 'use client' component. Prisma
 * Decimal fields (e.g. AppSettings.discountLimitPercent, TaxRate.ratePercent)
 * are class instances, not plain objects. Passing them straight through
 * (as `settings as any` did throughout the admin settings forms) breaks
 * hydration for that entire client subtree — every button and toggle
 * inside it stops responding to clicks, because React never finishes
 * attaching event handlers. This is the actual cause behind the
 * "unresponsive toggle buttons" bug: the toggle click handlers themselves
 * were always correct, the component around them just never hydrated.
 */
export function serializePlain<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) {
    return value.toString() as unknown as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => serializePlain(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializePlain(v);
    }
    return out as T;
  }
  return value;
}
