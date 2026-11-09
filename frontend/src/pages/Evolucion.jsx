import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp } from 'lucide-react';
import { getEvolucion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, grid, xAxisCategory, yAxis, lineSeries, COLORS, legend } from '../charts/chartTheme';

const METRICS = {
  transacciones:       { label: 'N° Transacciones',         unit: 'txs',    color: COLORS.orange },
  comisionPromedioBTC: { label: 'Comisión Promedio',         unit: 'BTC',    color: COLORS.yellow },
  tamVirtualPromedio:  { label: 'Tamaño Virtual Promedio',   unit: 'vbytes', color: COLORS.blue   },
  salidasPromedio:     { label: 'Outputs Promedio',          unit: 'outs',   color: COLORS.cyan   },
};

export default function Evolucion() {
  const [filtro, setFiltro]   = useState(rangoPorDefecto());
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [metric, setMetric]   = useState('transacciones');

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getEvolucion(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const cfg  = METRICS[metric];
  const dias = data.map(d => d.dia);
  const vals = data.map(d => d[metric]);

  const option = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: legend({ show: false }),
    grid: grid({ bottom: 52 }),
    xAxis: xAxisCategory(dias, { axisLabel: { rotate: 30, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#4a5e73', interval: Math.floor(data.length / 12) } }),
    yAxis: yAxis({ name: cfg.unit }),
    series: [lineSeries(cfg.label, vals, cfg.color, { areaStyle: { color: `${cfg.color}14` } })],
  };

  return (
    <div>
      <PageHeader
        Icon={TrendingUp}
        title="Evolución Temporal"
        subtitle="Actividad diaria de la red. Detecta picos de congestión y tendencias de volumen."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div className="tabs">
          {Object.entries(METRICS).map(([k, v]) => (
            <button key={k} className={`tab ${metric === k ? 'active' : ''}`} onClick={() => setMetric(k)}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          Aplicar
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && data.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{cfg.label} — por día</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {data.length} días
            </span>
          </div>
          <ReactECharts option={option} style={{ height: 380 }} />
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="card empty-state">Sin datos para el rango seleccionado.</div>
      )}
    </div>
  );
}
