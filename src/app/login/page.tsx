import { prisma } from '@/lib/prisma';
import LoginForm from '@/components/login-form';

// Reads AppSettings (for the logo/company name shown on this page) on every
// request instead of at build time — the build environment shouldn't need a
// live database connection, and the branding can change without a redeploy.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { companyName: true, logoUrl: true } });
  return <LoginForm companyName={settings?.companyName ?? 'Ignite Safety'} logoUrl={settings?.logoUrl ?? null} />;
}
