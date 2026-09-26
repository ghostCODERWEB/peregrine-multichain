'use client';
import { useEffect } from 'react';

// Last resort when the root layout itself fails: plain markup, since the app's styles may not have loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error.name} ${error.message}`)) {
      try { if (!sessionStorage.getItem('reloaded-for-build')) { sessionStorage.setItem('reloaded-for-build', '1'); location.reload(); } } catch { location.reload(); }
    }
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#07100d', color: '#e8f3ee', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Peregrine hit a problem</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>Reloading usually fixes it.</p>
          <button type="button" onClick={() => { reset(); location.reload(); }} style={{ marginTop: 8, padding: '10px 20px', borderRadius: 999, border: 0, background: '#1fe0a3', color: '#04120c', fontWeight: 800, cursor: 'pointer' }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
