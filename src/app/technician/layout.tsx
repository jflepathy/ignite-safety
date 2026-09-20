import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import SignOutButton from '@/components/sign-out-button';

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user.role === 'SALES') redirect('/outreach');

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-ink-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold">
            IS
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Technician POS</p>
            <p className="text-xs text-slate-400">{session.user.name}</p>
          </div>
        </div>
        <SignOutButton />
      </header>
      <main className="px-4 py-4 pb-24">{children}</main>
    </div>
  );
}
