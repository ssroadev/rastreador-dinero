import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Split, Search } from 'lucide-react';
import { getFragmentacion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, COLORS } from '../charts/chartTheme';

const fmt      = (n, d = 8) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });
const truncate = (s, n = 16) => s ? (s.length > n ? s.slice(0, n) + '…' : s) : '—';
const fmtTs    = (d) => d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Fragmentacion() {
  const [filtro, setFiltro]   = useState(rangoPorDefecto());
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getFragmentacion(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const filtered = search
    ? data.filter(d => d.txid?.includes(search))
    : data;

  // Scatter: n_outputs (x) vs coefVariacion (y)
  const scatterOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      formatter: (p) =>
        `<span class="mono">${truncate(p.data[2], 18)}</span><br/>` +
        `Outputs: <b>${p.data[0]}</b><br/>` +
        `CV: <b>${p.data[1]}</b><br/>` +
        `Volumen: <b>${fmt(p.data[3], 4)} BTC</b>`,
    },
    grid: { left: 56, right: 24, top: 24, bottom: 44 },
    xAxis: {
      name: 'Nº de salidas',
      nameTextStyle: { color: '#4a5e73', fontSize: 11 },
      axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLine: { lineStyle: { color: '#1c2a3a' } },
      splitLine: { lineStyle: { color: '#1c2a3a', opacity: .3 } },
    },
    yAxis: {
      name: 'Coef. variación',
      nameTextStyle: { color: '#4a5e73', fontSize: 11 },
      axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#1c2a3a', opacity: .3 } },
    },
    series: [{
      type: 'scatter',
      data: data.map(d => [d.n_outputs, d.coefVariacion, d.txid, d.total_salida]),
      symbolSize: 8,
      itemStyle: { color: COLORS.purple, opacity: .6 },
      emphasis: { itemStyle: { color: COLORS.orange, opacity: 1, shadowBlur: 6 } },
    }],
  };

  const totalVol = data.reduce((s, d) => s + d.total_salida, 0);
  const avgOuts  = data.length ? data.reduce((s, d) => s + d.n_outputs, 0) / data.length : 0;

  return (
    <div>
      <PageHeader
        Icon={Split}
        title="Fragmentación"
        subtitle="Detecta transacciones con pocas entradas y muchas salidas casi iguales. Patrón típico de mezcladores, payment batching y detección de lavado."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>Aplicar</button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && data.length > 0 && (
        <>
          <div className="grid-3" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Transacciones detectadas</div>
              <div className="kpi-value" style={{ color: 'var(--purple)' }}>{data.length}</div>
              <div className="kpi-label">fragmentación sospechosa</div>
            </div>
            <div className="card">
              <div className="card-title">Volumen total</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>{fmt(totalVol, 4)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span></div>
              <div className="kpi-label">en transacciones fragmentadas</div>
            </div>
            <div className="card">
              <div className="card-title">Salidas promedio</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)' }}>{avgOuts.toFixed(1)}</div>
              <div className="kpi-label">outputs por transacción</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Dispersión: salidas vs uniformidad</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>CV bajo = salidas más uniformes</span>
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
                    placeholder="Buscar txid..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 26, width: 200 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{filtered.length} resultados</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TxID</th>
                    <th>Timestamp</th>
                    <th>Bloque</th>
                    <th>In / Out</th>
                    <th>Volumen (BTC)</th>
                    <th>Valor medio salida</th>
                    <th>CV</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((d, i) => (
                    <tr key={i}>
                      <td><span className="mono" style={{ color: 'var(--accent)' }}>{truncate(d.txid, 18)}</span></td>
                      <td className="text-xs">{fmtTs(d.fecha)}</td>
                      <td className="mono">#{fmt(d.bloque, 0)}</td>
                      <td className="mono" style={{ color: 'var(--text-tertiary)' }}>{d.n_inputs} → {d.n_outputs}</td>
                      <td className="mono font-semibold">{fmt(d.total_salida, 4)} ₿</td>
                      <td className="mono">{fmt(d.valorMedio, 8)}</td>
                      <td><span className={`badge ${d.coefVariacion < 0.05 ? 'badge-red' : 'badge-orange'}`}>{d.coefVariacion}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 32 }}>
          No se detectaron transacciones de fragmentación en el rango seleccionado.
          <br />Prueba con un rango más amplio.
        </div>
      )}
    </div>
  );
}
