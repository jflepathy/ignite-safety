'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginForm({ companyName, logoUrl }: { companyName: string; logoUrl: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { redirect: false, email, password });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="mx-auto mb-4 h-16 w-auto rounded-lg bg-white p-2" />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-xl font-bold text-white">
              IS
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-white">{companyName}</h1>
          <p className="text-sm text-slate-400">Sign in to your workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ignitesafety.sc"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
