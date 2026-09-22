'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QuickEditButton from '@/components/shared/quick-edit-button';

type User = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  lockedUntil: string | Date | null;
};

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SALES', label: 'Sales' },
  { value: 'TECHNICIAN', label: 'Technician' },
];

type UnlinkedEmployee = { id: string; name: string; email: string | null };

export default function UsersManager({ users, unlinkedEmployees = [] }: { users: User[]; unlinkedEmployees?: UnlinkedEmployee[] }) {
  const router = useRouter();
  const [list, setList] = useState(users);
  const [employeeOptions, setEmployeeOptions] = useState(unlinkedEmployees);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'SALES', employeeId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function pickEmployee(employeeId: string) {
    const emp = employeeOptions.find((e) => e.id === employeeId);
    setForm((f) => ({
      ...f,
      employeeId,
      name: emp ? emp.name : f.name,
      email: emp?.email ? emp.email : f.email,
    }));
  }

  async function add() {
    setError('');
    setSaving(true);
    try {
      const { employeeId, ...userForm } = form;
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.formErrors?.[0] ?? 'Failed to create user');
      }
      const user = await res.json();
      // Link the selected existing Staff record to this new login (Session 11).
      if (employeeId) {
        await fetch(`/api/employees/${employeeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        setEmployeeOptions((prev) => prev.filter((e) => e.id !== employeeId));
      }
      setList((prev) => [...prev, { ...user, phone: null, lockedUntil: null }]);
      setForm({ name: '', username: '', email: '', password: '', role: 'SALES', employeeId: '' });
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setList((prev) => prev.map((u) => (u.id === id ? { ...u, active } : u)));
    router.refresh();
  }

  async function unlock(id: string) {
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlock: true }),
    });
    setList((prev) => prev.map((u) => (u.id === id ? { ...u, lockedUntil: null } : u)));
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500">
            <th className="py-2">Name</th>
            <th className="py-2">Username</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => {
            const isLocked = !!u.lockedUntil && new Date(u.lockedUntil) > new Date();
            return (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-2">{u.name}</td>
                <td className="py-2 text-slate-500">{u.username}</td>
                <td className="py-2 text-slate-500">{u.email ?? '—'}</td>
                <td className="py-2">
                  <span className="badge bg-slate-100 text-slate-700">{u.role}</span>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(u.id, !u.active)}
                      className={`badge ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {u.active ? 'Active' : 'Disabled'}
                    </button>
                    {isLocked && (
                      <button onClick={() => unlock(u.id)} className="badge bg-red-100 text-red-700" title="Too many failed login attempts — click to unlock">
                        Locked — unlock
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-2 text-right">
                  <QuickEditButton
                    title={`Edit ${u.name}`}
                    apiUrl={`/api/users/${u.id}`}
                    initialValues={{
                      name: u.name,
                      username: u.username,
                      email: u.email ?? '',
                      role: u.role,
                      password: '',
                    }}
                    fields={[
                      { key: 'name', label: 'Name', required: true },
                      { key: 'username', label: 'Username (used to sign in)', required: true },
                      { key: 'email', label: 'Email (optional)' },
                      { key: 'role', label: 'Role', type: 'select', options: ROLE_OPTIONS },
                      { key: 'password', label: 'Reset Password', type: 'password' },
                    ]}
                    onSaved={(updated) =>
                      setList((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)))
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3 lg:grid-cols-7">
        <select
          className="input"
          value={form.employeeId}
          onChange={(e) => pickEmployee(e.target.value)}
          title="Optionally link this login to an existing Staff record"
        >
          <option value="">— New person (no existing Staff) —</option>
          {employeeOptions.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="input" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input
          className="input"
          placeholder="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={saving} onClick={add}>
          + Add User
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
