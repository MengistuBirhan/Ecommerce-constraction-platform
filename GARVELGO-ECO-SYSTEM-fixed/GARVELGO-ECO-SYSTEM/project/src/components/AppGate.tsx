import type { CSSProperties, ReactNode } from 'react';
import { supabaseConfigured } from '@/lib/supabase';
import ErrorBoundary, { panelStyle } from '@/components/ErrorBoundary';

const codeStyle: CSSProperties = {
  background: '#f3f4f6',
  padding: '2px 6px',
  borderRadius: 4,
};

export function ConfigMissing() {
  return (
    <div style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>Setup needed / ማዋቀር ያስፈልጋል</h2>
      <p>The app cannot reach the database because these environment variables are missing in this build:</p>
      <p>
        <code style={codeStyle}>VITE_SUPABASE_URL</code>
        <br />
        <code style={codeStyle}>VITE_SUPABASE_ANON_KEY</code>
      </p>
      <p>
        Vercel → Project → Settings → Environment Variables → add both (Production + Preview), then{' '}
        <b>Redeploy</b>. Vite reads them at build time, so a redeploy is required.
      </p>
    </div>
  );
}

export default function AppGate({ children }: { children: ReactNode }) {
  if (!supabaseConfigured) return <ConfigMissing />;
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
