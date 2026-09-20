// Server-only: this module imports `prisma`. Client components must import
// constants from './permissions-constants' directly instead of from here —
// see that file for why.
import { prisma } from './prisma';
import { MODULE_ROUTE_PREFIX } from './roles';
import { MODULE_KEYS, MODULE_LABELS, resolveModuleVisibility } from './permissions-constants';
import type { ModuleKey } from './permissions-constants';

export { MODULE_ROUTE_PREFIX, MODULE_KEYS, MODULE_LABELS, resolveModuleVisibility };
export type { ModuleKey };

export async function getUserModuleOverrides(userId: string): Promise<Partial<Record<string, boolean>>> {
  const rows = await prisma.userPermissionOverride.findMany({ where: { userId } });
  return Object.fromEntries(rows.map((r) => [r.moduleKey, r.allowed]));
}
