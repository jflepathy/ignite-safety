import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SignOutButton from '@/components/sign-out-button';
import SidebarNav from '@/components/sidebar-nav';
import CreateMenu from '@/components/create-menu';
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
    <div className="flex min-h-screen">
      <aside className="app-shell-chrome flex w-64 flex-shrink-0 flex-col overflow-y-auto bg-ink-900 px-4 py-6">
        <div className="mb-6 flex items-center gap-2 px-2">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg bg-white object-contain p-1" />
          ) : (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
              IS
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white">{settings?.companyName ?? 'Ignite Safety'}</p>
            <p className="text-xs text-slate-400">{session.user.role}</p>
          </div>
        </div>
        <div className="flex-1">
          <SidebarNav isAdmin={session.user.role === 'ADMIN'} moduleVisibility={modules} />
        </div>
        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="truncate px-2 text-xs text-slate-400">{session.user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="app-shell-chrome flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3">
          <CreateMenu />
        </header>
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
