import { useState, useEffect } from 'react';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { getIndicadores } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';

/* ── Formato ──────────────────────────────────────────────────────────────────── */
const fmtInt  = (n) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const fmtBTC  = (n, d = 8) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'}) : '—';

/* ── KPI card ─────────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, unit, sub, accent }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="card-title">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="kpi-value" style={accent ? { color: accent } : {}}>
          {value ?? '—'}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>
            {unit}
          </span>
        )}
      </div>
      {sub && <div className="kpi-label">{sub}</div>}
    </div>
  );
}

/* ── Insight row ──────────────────────────────────────────────────────────────── */
function InsightRow({ label, value, bar, barColor = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {bar !== undefined && (
          <div style={{ width: 80, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(bar * 100, 100)}%`, height: '100%', background: barColor, borderRadius: 2 }} />
          </div>
        )}
        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', minWidth: 140, textAlign: 'right' }}>
          {value}
        </span>
      </div>
    </div>
  );
}

export default function Indicadores() {
  const [filtro, setFiltro]   = useState(rangoPorDefecto());  // Llamar a la función
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getIndicadores(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const comisionPct = data?.volumenBTC && data?.comisionTotalBTC
    ? data.comisionTotalBTC / data.volumenBTC
    : 0;

  return (
    <div>
      <PageHeader
        Icon={LayoutDashboard}
        title="Indicadores Generales"
        subtitle="Comportamiento global de las transacciones Bitcoin en el período seleccionado."
        actions={
          <button
            className="btn btn-secondary"
            onClick={cargar}
            disabled={loading}
            style={{ gap: 6 }}
          >
            <RefreshCw size={12} className={loading ? 'spin-icon' : ''} />
            {loading ? 'Cargando' : 'Actualizar'}
          </button>
        }
      />

      {/* Filter bar */}
      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          Aplicar
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && data && (
        <>
          {/* KPI row */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <KpiCard
              label="Transacciones"
              value={fmtInt(data.transacciones)}
              sub={`${fmtDate(data.primera)} — ${fmtDate(data.ultima)}`}
            />
            <KpiCard
              label="Volumen Total"
              value={fmtBTC(data.volumenBTC, 4)}
              unit="BTC"
              sub="suma de outputs"
              accent="var(--accent)"
            />
            <KpiCard
              label="Comisión Total"
              value={fmtBTC(data.comisionTotalBTC, 4)}
              unit="BTC"
              sub="recaudado por mineros"
              accent="var(--green)"
            />

          <KpiCard
            label="Comisión promedio"
            value={fmtInt(data.comisionPromedioBTC * 100_000_000)}
            unit="sat/tx"
            sub="Comisión media por transacción"
            accent="var(--yellow)"
          />

          </div>

          {/* Detail cards */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Resumen de red</span>
              </div>
              <InsightRow
                label="Tamaño virtual promedio"
                value={`${fmtInt(data.tamVirtualPromedio)} vbytes`}
              />
              <InsightRow
                label="Comisión / Volumen (ratio)"
                value={`${(comisionPct * 100).toFixed(4)} %`}
                bar={comisionPct * 200}
                barColor="var(--yellow)"
              />
              <InsightRow
                label="Primera transacción"
                value={fmtDate(data.primera)}
              />
              <InsightRow
                label="Última transacción"
                value={fmtDate(data.ultima)}
              />
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Utilidad analítica</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                Equipos de cumplimiento usan el <strong style={{ color: 'var(--text-primary)' }}>volumen total</strong> en un 
                período para detectar ventanas de lavado.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.75, marginTop: 8 }}>
                La <strong style={{ color: 'var(--text-primary)' }}>comisión promedio</strong> es un indicador 
                directo de congestión de la mempool — sube cuando hay alta demanda de espacio en bloque.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.75, marginTop: 8 }}>
                El <strong style={{ color: 'var(--text-primary)' }}>tamaño virtual</strong> informa sobre 
                la complejidad media (scripts SegWit vs legacy).
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
