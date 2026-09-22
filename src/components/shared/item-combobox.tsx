'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ItemOption = { id: string; sku: string; name: string };

/**
 * A type-to-filter product/service picker for a single Line Items row,
 * replacing the old plain <select> (which meant scrolling a 126+ row list
 * to find an item). Renders its dropdown panel via a portal into
 * document.body and positions it with the trigger's live bounding rect, so
 * it isn't clipped by the Line Items table's horizontal-scroll container —
 * a native <select> doesn't have this problem, a custom-rendered one does.
 */
export default function ItemCombobox<T extends ItemOption>({
  items,
  value,
  onSelect,
  onClear,
}: {
  items: T[];
  value: string | null;
  onSelect: (item: T) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value);

  function place() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
  }

  useEffect(() => {
    if (!open) return;
    place();
    function onOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    function onReposition() {
      place();
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    : items;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="input flex items-center justify-between gap-1 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? 'truncate' : 'truncate text-slate-400'}>
          {selected ? `${selected.sku} — ${selected.name}` : 'Custom — type to search…'}
        </span>
        <span className="text-slate-400">▾</span>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            <div className="border-b border-slate-100 p-2">
              <input
                autoFocus
                className="input"
                placeholder="Type SKU or item name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              <button
                type="button"
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                  !value ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-500'
                }`}
                onClick={() => {
                  onClear();
                  setOpen(false);
                  setQuery('');
                }}
              >
                — Custom (type your own description) —
              </button>
              {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No matching items.</p>}
              {filtered.slice(0, 200).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                    item.id === value ? 'bg-brand-50 font-medium text-brand-700' : ''
                  }`}
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="font-mono text-xs text-slate-500">{item.sku}</span> — {item.name}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
