import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { AlertTriangle, Search } from 'lucide-react';
import { getAtipicas } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { tooltip, COLORS } from '../charts/chartTheme';

const fmt      = (n, d = 6) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });
const truncate = (s, n = 16) => s ? (s.length > n ? s.slice(0, n) + '…' : s) : '—';
const fmtTs    = (d) => d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Atipicas() {
  const [filtro, setFiltro]   = useState({ desde: '', hasta: '' });
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getAtipicas(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const filtered = search
    ? data.filter(d => d.txid?.includes(search) || String(d.bloque_height).includes(search))
    : data;

  const scatterOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      formatter: (p) =>
        `<span class="mono">${truncate(p.data[2], 20)}</span><br/>` +
        `Volumen: <b>${fmt(p.data[0], 4)} BTC</b><br/>` +
        `Tasa: <b>${fmt(p.data[1], 1)} sat/vb</b>`,
    },
    grid: { left: 64, right: 24, top: 24, bottom: 44 },
    xAxis: {
      name: 'Volumen BTC',
      nameTextStyle: { color: '#4a5e73', fontSize: 11 },
      axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLine: { lineStyle: { color: '#1c2a3a' } },
      splitLine: { lineStyle: { color: '#1c2a3a', type: 'solid', opacity: .3 } },
    },
    yAxis: {
      name: 'sat / vb',
      nameTextStyle: { color: '#4a5e73', fontSize: 11 },
      axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#1c2a3a', type: 'solid', opacity: .3 } },
    },
    series: [{
      type: 'scatter',
      data: data.map(d => [d.total_salida ?? 0, d.satVb ?? 0, d.txid]),
      symbolSize: 6,
      itemStyle: { color: COLORS.red, opacity: .6 },
      emphasis: { itemStyle: { color: COLORS.orange, opacity: 1, shadowBlur: 6, symbolSize: 10 } },
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={AlertTriangle}
        title="Transacciones Atípicas"
        subtitle="Detección de outliers por volumen o comisión. Señal de alerta para análisis de fraude y cumplimiento."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          Aplicar
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && data.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Dispersión: Volumen vs Tasa</span>
              <span style={{ fontSize: 11, color: 'var(--red)' }}>
                {data.length} transacciones fuera del rango normal
              </span>
            </div>
            <ReactECharts option={scatterOpt} style={{ height: 300 }} />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Listado</span>
              <div className="flex items-center gap-2">
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    placeholder="Buscar txid / bloque…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 26, width: 220 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {filtered.length} resultados
                </span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TxID</th>
                    <th>Timestamp</th>
                    <th>Bloque</th>
                    <th>Volumen (BTC)</th>
                    <th>Comisión (BTC)</th>
                    <th>In / Out</th>
                    <th>sat / vb</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((d, i) => (
                    <tr key={i}>
                      <td><span className="mono" style={{ color: 'var(--accent)' }}>{truncate(d.txid, 18)}</span></td>
                      <td className="text-xs">{fmtTs(d.fecha)}</td>
                      <td className="mono">#{fmt(d.bloque_height, 0)}</td>
                      <td className="mono font-semibold">{fmt(d.total_salida, 6)} ₿</td>
                      <td className="mono">{fmt(d.comision, 8)}</td>
                      <td className="mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {d.n_inputs} / {d.n_outputs}
                      </td>
                      <td>
                        <span className={`badge ${(d.satVb ?? 0) > 100 ? 'badge-red' : (d.satVb ?? 0) > 30 ? 'badge-orange' : 'badge-neutral'}`}>
                          {fmt(d.satVb, 1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
