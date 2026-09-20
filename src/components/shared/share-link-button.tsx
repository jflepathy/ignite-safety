'use client';

import { useState } from 'react';

export default function ShareLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <button className="btn-secondary" onClick={copy}>
      {copied ? '✓ Link Copied' : '🔗 Copy Share Link'}
    </button>
  );
}
