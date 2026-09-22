import { AppRole } from '@/lib/auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      username?: string;
      role: AppRole;
      deniedModules?: string[];
      editModules?: string[];
    };
  }
  interface User {
    id: string;
    role: AppRole;
    username?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: AppRole;
    username?: string;
    deniedModules?: string[];
    editModules?: string[];
  }
}
