'use client';

import { useEffect, useRef } from 'react';

// A USB/Bluetooth barcode scanner acts as a "keyboard wedge" -- it just
// fires ordinary keydown events, character by character, then a trailing
// Enter, faster than any human could type. This hook listens globally
// (document, capture phase) so a scan registers no matter which field
// happens to have focus on the page -- the item combobox doesn't need to
// be open or clicked into first (Session 20: "regardless if you are on
// item it should register the item").
//
// Detection: keystrokes arriving less than MAX_INTERVAL_MS apart are
// buffered as one scan; anything slower resets the buffer, so normal human
// typing (even a fast typist is well above this interval) is left alone
// and keeps working exactly as before. A buffered run that ends in Enter
// and meets the minimum length is treated as a completed scan and handed
// to `onScan` with the scanned code; Enter's default action is prevented
// so it doesn't also submit/activate whatever was focused.
//
// Individual characters that are part of a fast burst are also prevented
// from reaching the focused field (so a scan doesn't leave stray digits in
// the Notes box or PO Number field) -- except sometimes the very first
// character of a run, before there's a prior keystroke to compare timing
// against, which is a harmless, standard trade-off for this kind of
// keyboard-wedge integration.
const MAX_INTERVAL_MS = 30;
const MIN_SCAN_LENGTH = 3;

export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      const isFastFollowOn = gap <= MAX_INTERVAL_MS;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (isFastFollowOn && code.length >= MIN_SCAN_LENGTH) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(code);
        }
        lastKeyTimeRef.current = now;
        return;
      }

      // Only buffer single printable characters -- ignores Shift, Tab,
      // arrow keys, etc. (e.key is the literal character for those, e.g.
      // "a", "5", "-"; special keys report a name like "Shift" instead).
      if (e.key.length === 1) {
        if (isFastFollowOn) {
          bufferRef.current += e.key;
          e.preventDefault();
          e.stopPropagation();
        } else {
          bufferRef.current = e.key;
        }
      } else {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled]);
}
