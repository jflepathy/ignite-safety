'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type User = { id: string; name: string; email: string; role: string; active: boolean };

export default function UsersManager({ users }: { users: User[] }) {
  const router = useRouter();
  const [list, setList] = useState(users);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SALES' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.formErrors?.[0] ?? 'Failed to create user');
      }
      const user = await res.json();
      setList((prev) => [...prev, user]);
      setForm({ name: '', email: '', password: '', role: 'SALES' });
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

  return (
    <div className="card space-y-4 p-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500">
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id} className="border-t border-slate-100">
              <td className="py-2">{u.name}</td>
              <td className="py-2 text-slate-500">{u.email}</td>
              <td className="py-2">
                <span className="badge bg-slate-100 text-slate-700">{u.role}</span>
              </td>
              <td className="py-2">
                <button
                  onClick={() => toggleActive(u.id, !u.active)}
                  className={`badge ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {u.active ? 'Active' : 'Disabled'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-5">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input
          className="input"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="ADMIN">Admin</option>
          <option value="SALES">Sales</option>
          <option value="TECHNICIAN">Technician</option>
        </select>
        <button className="btn-primary" disabled={saving} onClick={add}>
          + Add User
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
