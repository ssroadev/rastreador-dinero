import { CalendarDays } from 'lucide-react';

export default function RangoFechas({ desde, hasta, onChange }) {
  const set = (key) => (e) => onChange({ desde, hasta, [key]: e.target.value });

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2">
        <CalendarDays size={13} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Desde</span>
        <input
          type="date"
          value={desde}
          onChange={set('desde')}
          style={{ width: 140 }}
        />
      </label>
      <label className="flex items-center gap-2">
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Hasta</span>
        <input
          type="date"
          value={hasta}
          onChange={set('hasta')}
          style={{ width: 140 }}
        />
      </label>
    </div>
  );
}
