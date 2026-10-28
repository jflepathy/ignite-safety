'use client';

import { useState, type Dispatch, type SetStateAction, type DragEvent } from 'react';

/** A copy of the line with a fresh key, to be inserted right after the original. */
export function duplicateLine<T extends { key: string }>(lines: T[], key: string): T[] {
  const idx = lines.findIndex((l) => l.key === key);
  if (idx === -1) return lines;
  const copy = { ...lines[idx], key: Math.random().toString(36).slice(2) };
  return [...lines.slice(0, idx + 1), copy, ...lines.slice(idx + 1)];
}

/**
 * Drag-to-reorder for line-item rows (Invoice, Sales Receipt, Estimate forms).
 *
 * Only a grip handle starts a drag — the row itself is draggable only while the
 * mouse is held on the handle, so selecting text inside the description / qty
 * inputs still works. Dropping a row on another row moves it to that row's
 * position. (Touch screens don't fire HTML5 drag events; the ▲ ▼ buttons remain
 * for those.)
 */
export function useLineDrag<T extends { key: string }>(setLines: Dispatch<SetStateAction<T[]>>) {
  const [armed, setArmed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function reset() {
    setArmed(null);
    setDragging(null);
    setOver(null);
  }

  function move(fromKey: string, toKey: string) {
    setLines((prev) => {
      const from = prev.findIndex((l) => l.key === fromKey);
      const to = prev.findIndex((l) => l.key === toKey);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return {
    /** Spread onto the grip handle element. */
    handleProps: (key: string) => ({
      onMouseDown: () => setArmed(key),
      onMouseUp: () => setArmed(null),
    }),
    /** Spread onto the <tr>. */
    rowProps: (key: string) => ({
      draggable: armed === key,
      onDragStart: (e: DragEvent) => {
        setDragging(key);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', key);
      },
      onDragOver: (e: DragEvent) => {
        if (dragging && dragging !== key) {
          e.preventDefault();
          if (over !== key) setOver(key);
        }
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragging && dragging !== key) move(dragging, key);
        reset();
      },
      onDragEnd: reset,
    }),
    /** Extra classes for the row: fades the dragged row, outlines the drop target. */
    rowClass: (key: string) =>
      dragging === key ? 'opacity-40' : over === key && dragging ? 'bg-brand-50 outline outline-1 outline-brand-300' : '',
  };
}
