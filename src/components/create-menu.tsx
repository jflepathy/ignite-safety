'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CREATE_MENU } from '@/lib/nav-config';

export default function CreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        + Create
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {CREATE_MENU.map((group) => (
            <div key={group.heading} className="mb-1 last:mb-0">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.heading}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
