'use client';

import { useEffect, useState } from 'react';
import { MODULE_KEYS, MODULE_LABELS } from '@/lib/permissions-constants';
import { EDIT_MODULE_KEYS, EDIT_MODULE_LABELS } from '@/lib/edit-permissions-constants';

type User = { id: string; name: string; email: string; role: string };
type Override = { userId: string; moduleKey: string; action: 'view' | 'edit'; allowed: boolean };

export default function PermissionsManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    fetch('/api/admin/permissions')
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users);
        setOverrides(data.overrides);
        setSelectedUserId((prev) => prev || data.users.find((u: User) => u.role !== 'ADMIN')?.id || data.users[0]?.id || '');
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  function overrideFor(moduleKey: string, action: 'view' | 'edit') {
    return overrides.find((o) => o.userId === selectedUserId && o.moduleKey === moduleKey && (o.action ?? 'view') === action)?.allowed;
  }

  async function setOverride(moduleKey: string, action: 'view' | 'edit', allowed: boolean | null) {
    const key = `${action}:${moduleKey}`;
    setSaving(key);
    try {
      await fetch('/api/admin/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, moduleKey, action, allowed }),
      });
      setOverrides((prev) => {
        const rest = prev.filter((o) => !(o.userId === selectedUserId && o.moduleKey === moduleKey && (o.action ?? 'view') === action));
        return allowed === null ? rest : [...rest, { userId: selectedUserId, moduleKey, action, allowed }];
      });
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="card p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Access &amp; Permissions</h2>
        <p className="text-sm text-slate-500">
          Explicit, per-staff-member overrides on top of the base Admin / Sales / Technician role system. Changes take
          effect the next time that person signs in.
        </p>
        <div>
          <label className="label">Staff Member</label>
          <select className="input max-w-sm" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedUser && (
        <div className="card p-6">
          {selectedUser.role === 'ADMIN' ? (
            <p className="text-sm text-slate-500">Admin accounts are unrestricted and cannot have module overrides.</p>
          ) : (
            <>
              <div className="mb-4 flex gap-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setTab('view')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${tab === 'view' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}
                >
                  View Access
                </button>
                <button
                  type="button"
                  onClick={() => setTab('edit')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${tab === 'edit' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}
                >
                  Edit Access
                </button>
              </div>

              {tab === 'view' ? (
                <>
                  <p className="mb-3 text-xs text-slate-400">
                    Whether this person can see a whole section at all. An override can only <span className="font-medium">restrict</span> a
                    section their role would otherwise see — never grant access past what their role already allows.
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                        <th className="py-2">Section</th>
                        <th className="py-2">Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULE_KEYS.map((key) => {
                        const value = overrideFor(key, 'view'); // undefined = role default
                        const savingKey = `view:${key}`;
                        return (
                          <tr key={key} className="border-t border-slate-100">
                            <td className="py-2">{MODULE_LABELS[key]}</td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={saving === savingKey}
                                  onClick={() => setOverride(key, 'view', null)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                    value === undefined ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                                  }`}
                                >
                                  Role default
                                </button>
                                <button
                                  type="button"
                                  disabled={saving === savingKey}
                                  onClick={() => setOverride(key, 'view', true)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                    value === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'
                                  }`}
                                >
                                  Allow
                                </button>
                                <button
                                  type="button"
                                  disabled={saving === savingKey}
                                  onClick={() => setOverride(key, 'view', false)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                    value === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'
                                  }`}
                                >
                                  Deny
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  <p className="mb-3 text-xs text-slate-400">
                    Whether this person can edit records in these components — separate from whether they can see them.
                    Deny-by-default: leaving one on "No edit access" is the same as never granting it. This only takes
                    effect for a component this person's role can already open (Sales — not Technician — can reach all
                    of these today).
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                        <th className="py-2">Component</th>
                        <th className="py-2">Edit Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EDIT_MODULE_KEYS.map((key) => {
                        const value = overrideFor(key, 'edit'); // undefined/false = no edit access (deny-by-default)
                        const savingKey = `edit:${key}`;
                        return (
                          <tr key={key} className="border-t border-slate-100">
                            <td className="py-2">{EDIT_MODULE_LABELS[key]}</td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={saving === savingKey}
                                  onClick={() => setOverride(key, 'edit', null)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                    value !== true ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                                  }`}
                                >
                                  No edit access
                                </button>
                                <button
                                  type="button"
                                  disabled={saving === savingKey}
                                  onClick={() => setOverride(key, 'edit', true)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                    value === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'
                                  }`}
                                >
                                  Can edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
