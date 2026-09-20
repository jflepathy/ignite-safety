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
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Explicit per-staff-member module denials (granular access rights,
        // layered on top of the 3-role system). Only "denied" overrides are
        // embedded — an override can narrow what a Sales/Technician user
        // sees but never grant access past their role's own ROUTE_ACCESS
        // boundary, so RBAC integrity (e.g. Technicians never reaching
        // Admin-only routes) can't be bypassed via a permission override.
        const deniedOverrides = await prisma.userPermissionOverride.findMany({
          where: { userId: user.id, allowed: false },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          deniedModules: deniedOverrides.map((o) => o.moduleKey),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.deniedModules = (user as any).deniedModules ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).deniedModules = token.deniedModules ?? [];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
