'use client';

import { useState } from 'react';

// Self-service "change my own password" (Session 20). One shared component
// used in two places with two different visual contexts:
//  - the desktop sidebar footer (variant="sidebar"), styled to match
//    SignOutButton right above it
//  - the technician header (variant="header"), styled to match the small
//    "Back to Desktop" link next to it
// Both open the same modal and hit the same API route.
export default function ChangePasswordButton({ variant = 'sidebar' }: { variant?: 'sidebar' | 'header' }) {
  const [open, setOpen] = useState(false);

  const triggerClassName =
    variant === 'sidebar'
      ? 'w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white'
      : 'text-xs font-medium text-slate-300 hover:text-white hover:underline';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        🔑 Change password
      </button>
      {open && <ChangePasswordModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json: any = await res.json();
      if (!res.ok) {
        setError(json?.error?.formErrors?.[0] ?? json?.error?.fieldErrors?.newPassword?.[0] ?? 'Could not change password.');
        setBusy(false);
        return;
      }
      setSuccess(true);
      setBusy(false);
    } catch {
      setError('Something went wrong — please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        {success ? (
          <div className="text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-2 text-sm font-semibold text-ink-900">Password changed</p>
            <p className="mt-1 text-xs text-slate-500">Use your new password next time you sign in.</p>
            <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">Change password</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div>
              <label className="label">Current password</label>
              <input
                type="password"
                autoFocus
                required
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                required
                minLength={8}
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
