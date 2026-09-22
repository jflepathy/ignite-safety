import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
export { type AppRole, ROLE_HOME, ROUTE_ACCESS } from '@/lib/roles';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const username = credentials.username.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { username } });
        // Generic failure for "no such user" — don't reveal whether a
        // username exists.
        if (!user || !user.active) return null;

        // --- Login attempt limiting -----------------------------------
        // Checked BEFORE the password compare so a locked account can't be
        // brute-forced during its own cooldown window either. NextAuth v4
        // collapses every authorize() failure (return null OR a thrown
        // Error) to the same generic "CredentialsSignin" error on the
        // client, so a locked account fails exactly like a wrong password —
        // deliberately: it avoids leaking account existence/lock state to
        // whoever (or whatever script) is doing the guessing, while still
        // fully blocking the attempt server-side.
        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          // Escalating cooldown: 5 misses -> 15 min lock, 10 -> 1 hr, 15+ -> 24 hr.
          const lockMinutes = attempts >= 15 ? 24 * 60 : attempts >= 10 ? 60 : attempts >= 5 ? 15 : 0;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: lockMinutes > 0 ? new Date(now.getTime() + lockMinutes * 60000) : user.lockedUntil,
            },
          });
          return null;
        }

        // Successful login — clear any lockout state.
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
        }

        // Explicit per-staff-member module denials (granular access rights,
        // layered on top of the 3-role system). Only "denied" overrides are
        // embedded — an override can narrow what a Sales/Technician user
        // sees but never grant access past their role's own ROUTE_ACCESS
        // boundary, so RBAC integrity (e.g. Technicians never reaching
        // Admin-only routes) can't be bypassed via a permission override.
        const overrides = await prisma.userPermissionOverride.findMany({ where: { userId: user.id } });
        const deniedModules = overrides.filter((o) => o.action === 'view' && !o.allowed).map((o) => o.moduleKey);
        const editModules = overrides.filter((o) => o.action === 'edit' && o.allowed).map((o) => o.moduleKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          deniedModules,
          editModules,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.deniedModules = (user as any).deniedModules ?? [];
        token.editModules = (user as any).editModules ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
        (session.user as any).deniedModules = token.deniedModules ?? [];
        (session.user as any).editModules = token.editModules ?? [];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
