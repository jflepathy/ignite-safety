import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function toNumber(d: unknown): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  return parseFloat(String(d));
}
