import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions, ROLE_HOME } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  redirect(ROLE_HOME[session.user.role]);
}
