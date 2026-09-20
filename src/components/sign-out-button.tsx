'use client';

import { signOut } from 'next-auth/react';

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white"
    >
      ↩ Sign out
    </button>
  );
}
