import { AlertCircle } from 'lucide-react';

export default function ErrorBanner({ error }) {
  if (!error) return null;
  const msg = error?.response?.data?.error || error?.message || String(error);
  return (
    <div className="error-banner">
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{msg}</span>
    </div>
  );
}
