'use client';

import { useEffect, useRef } from 'react';
import SignaturePadLib from 'signature_pad';

export default function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear();
    }

    padRef.current = new SignaturePadLib(canvas, { backgroundColor: 'rgb(255,255,255)' });
    padRef.current.addEventListener('endStroke', () => {
      onChange(padRef.current!.isEmpty() ? null : padRef.current!.toDataURL('image/png'));
    });

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      <canvas
        ref={canvasRef}
        className="min-h-0 w-full flex-1 touch-none rounded-lg border border-slate-300 bg-white"
      />
      <button
        type="button"
        className="self-start text-xs text-slate-500 underline"
        onClick={() => {
          padRef.current?.clear();
          onChange(null);
        }}
      >
        Clear signature
      </button>
    </div>
  );
}
