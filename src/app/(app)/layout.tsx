import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AppShell from '@/components/app-shell';
import { getUserModuleOverrides, resolveModuleVisibility } from '@/lib/permissions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user.role === 'TECHNICIAN') redirect('/technician');

  const isAdmin = session.user.role === 'ADMIN';
  const [settings, overrides] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    isAdmin ? Promise.resolve({}) : getUserModuleOverrides(session.user.id),
  ]);
  const uiModules = (settings?.uiModules as Record<string, boolean>) ?? {};
  const modules = resolveModuleVisibility(uiModules, overrides, isAdmin);

  return (
    <AppShell
      isAdmin={isAdmin}
      role={session.user.role}
      email={session.user.email}
      companyName={settings?.companyName ?? 'Ignite Safety'}
      logoUrl={settings?.logoUrl}
      moduleVisibility={modules}
    >
      {children}
    </AppShell>
  );
}
