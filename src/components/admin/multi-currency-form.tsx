'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  multiCurrencyEnabled: boolean;
  baseCurrency: string;
  fxAutoUpdateEnabled: boolean;
  fxRateLockEnabled: boolean;
};

type Rate = { currencyCode: string; rateToBase: string; isManualOverride: boolean; locked: boolean; source: string | null; updatedAt: string };

export default function MultiCurrencyForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rates, setRates] = useState<Rate[]>([]);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [loadingRates, setLoadingRates] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newRate, setNewRate] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  function loadRates() {
    setLoadingRates(true);
    fetch('/api/admin/exchange-rates')
      .then((r) => r.json())
      .then((data) => {
        setRates(data.rates);
        setLastFetched(data.fxLastFetchedAt);
      })
      .finally(() => setLoadingRates(false));
  }

  useEffect(() => {
    loadRates();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  async function addRate() {
    if (!newCode || newCode.length !== 3) return;
    const res = await fetch('/api/admin/exchange-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currencyCode: newCode.toUpperCase(), rateToBase: newRate }),
    });
    if (res.ok) {
      setNewCode('');
      setNewRate(1);
      loadRates();
    }
  }

  async function toggleLock(code: string, locked: boolean) {
    await fetch(`/api/admin/exchange-rates/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked }),
    });
    loadRates();
  }

  async function updateRate(code: string, rateToBase: number) {
    await fetch('/api/admin/exchange-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currencyCode: code, rateToBase }),
    });
    loadRates();
  }

  async function removeRate(code: string) {
    await fetch(`/api/admin/exchange-rates/${code}`, { method: 'DELETE' });
    loadRates();
  }

  async function refreshNow() {
    setRefreshing(true);
    setRefreshMsg('');
    try {
      const res = await fetch('/api/admin/exchange-rates/refresh', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Refresh failed');
      setRefreshMsg(body.message ?? `Updated ${body.updated} currency rate(s).`);
      loadRates();
      router.refresh();
    } catch (e: any) {
      setRefreshMsg(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Multi-Currency Engine</h2>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink-900">Enable Multi-Currency</p>
            <p className="text-xs text-slate-500">Allow transactions and reports in currencies other than the base currency.</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, multiCurrencyEnabled: !f.multiCurrencyEnabled }))}
            className={`relative h-6 w-11 rounded-full transition-colors ${form.multiCurrencyEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.multiCurrencyEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {form.multiCurrencyEnabled && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Base Currency</label>
                <input
                  className="input"
                  value={form.baseCurrency}
                  maxLength={3}
                  onChange={(e) => setForm({ ...form, baseCurrency: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink-900">Automatic Daily Rate Retrieval</p>
                <p className="text-xs text-slate-500">Fetch current rates once a day from an external FX provider.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, fxAutoUpdateEnabled: !f.fxAutoUpdateEnabled }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${form.fxAutoUpdateEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.fxAutoUpdateEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink-900">Lock All Rates</p>
                <p className="text-xs text-slate-500">
                  Override: when on, no currency is auto-refreshed regardless of its individual lock. Use this to freeze
                  rates for a period (e.g. quarter-end).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, fxRateLockEnabled: !f.fxRateLockEnabled }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${form.fxRateLockEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.fxRateLockEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
        </div>
      </div>

      {form.multiCurrencyEnabled && (
        <div className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Exchange Rates (per {form.baseCurrency})</h2>
              <p className="text-xs text-slate-500">
                {lastFetched ? `Last auto-refreshed: ${new Date(lastFetched).toLocaleString()}` : 'Never auto-refreshed yet.'}
              </p>
            </div>
            <button className="btn-secondary" disabled={refreshing} onClick={refreshNow}>
              {refreshing ? 'Refreshing…' : '↻ Refresh Now'}
            </button>
          </div>
          {refreshMsg && <p className="text-sm text-slate-600">{refreshMsg}</p>}

          {loadingRates ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-2">Currency</th>
                  <th className="py-2 text-right">Rate to {form.baseCurrency}</th>
                  <th className="py-2">Source</th>
                  <th className="py-2">Locked</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.currencyCode} className="border-t border-slate-100">
                    <td className="py-2 font-mono">{r.currencyCode}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        step="0.000001"
                        className="input w-32 text-right"
                        defaultValue={r.rateToBase}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (v > 0 && v.toString() !== r.rateToBase) updateRate(r.currencyCode, v);
                        }}
                      />
                    </td>
                    <td className="py-2 text-slate-500">{r.isManualOverride ? 'Manual' : r.source ?? '—'}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => toggleLock(r.currencyCode, !r.locked)}
                        className={`badge ${r.locked ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {r.locked ? 'Locked' : 'Unlocked'}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeRate(r.currencyCode)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {rates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No currencies configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-4">
            <div>
              <label className="label">Currency Code</label>
              <input className="input w-24 uppercase" maxLength={3} value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="USD" />
            </div>
            <div>
              <label className="label">Rate to {form.baseCurrency}</label>
              <input
                type="number"
                step="0.000001"
                className="input w-32"
                value={newRate}
                onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <button className="btn-secondary" onClick={addRate}>
              + Add Currency
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
