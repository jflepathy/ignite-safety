import { AppRole } from '@/lib/auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: AppRole;
    };
  }
  interface User {
    id: string;
    role: AppRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: AppRole;
  }
}
