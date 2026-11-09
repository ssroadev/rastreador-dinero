import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { PieChart } from 'lucide-react';
import { getConcentracion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, COLORS } from '../charts/chartTheme';

const fmt      = (n, d = 4) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });
const truncate = (s, n = 16) => s ? (s.length > n ? s.slice(0, n) + '…' : s) : '—';

export default function Concentracion() {
  const [filtro, setFiltro]   = useState(rangoPorDefecto());
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getConcentracion(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  // Lorenz curve: x = % de direcciones, y = % acumulado del volumen
  const top = data?.top || [];
  const totalDirs = data?.totalDirecciones || 0;

  const lorenzData = top.map((d, i) => [
    +(((i + 1) / Math.max(top.length, 1)) * 100).toFixed(2),
    d.pctAcumulado,
  ]);

  const lorenzOpt = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis',
      formatter: (params) => {
        const p = params[0];
        return `${p.data[0]}% de direcciones<br/>→ <b>${p.data[1]}%</b> del volumen`;
      }
    },
    grid: { left: 56, right: 24, top: 24, bottom: 48 },
    xAxis: {
      name: '% de direcciones',
      nameTextStyle: { color: '#4a5e73', fontSize: 11 },
      axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLine: { lineStyle: { color: '#1c2a3a' } },
      splitLine: { lineStyle: { color: '#1c2a3a', opacity: .3 } },
    },
    yAxis: {
      name: '% acumulado volumen',
      nameTextStyle: { color: '#4a5e73', fontSize: 11 },
      axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#1c2a3a', opacity: .3 } },
      max: 100,
    },
    series: [
      {
        type: 'line',
        data: lorenzData,
        smooth: true,
        lineStyle: { color: COLORS.orange, width: 2 },
        itemStyle: { color: COLORS.orange },
        areaStyle: { color: `${COLORS.orange}18` },
        symbol: 'none',
      },
      {
        type: 'line',
        data: [[0, 0], [100, 100]],
        lineStyle: { color: '#4a5e73', type: 'dashed', width: 1 },
        symbol: 'none',
        silent: true,
      },
    ],
  };

  return (
    <div>
      <PageHeader
        Icon={PieChart}
        title="Concentración por dirección"
        subtitle="¿Cuánto del volumen mueve el 1% de las direcciones? Curva de Lorenz y análisis Pareto sobre outputs de transacciones."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>Aplicar</button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && data && data.totalDirecciones > 0 && (
        <>
          <div className="grid-4" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Direcciones únicas</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)' }}>{data.totalDirecciones.toLocaleString('es-CO')}</div>
              <div className="kpi-label">en el rango</div>
            </div>
            <div className="card">
              <div className="card-title">Volumen total</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>{fmt(data.volumenTotal, 2)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span></div>
              <div className="kpi-label">recibido</div>
            </div>
            <div className="card">
              <div className="card-title">Top 1% controla</div>
              <div className="kpi-value" style={{ color: 'var(--red)' }}>{data.pctTop1}%</div>
              <div className="kpi-label">del volumen</div>
            </div>
            <div className="card">
              <div className="card-title">Top 10% controla</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>{data.pctTop10}%</div>
              <div className="kpi-label">del volumen</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Curva de Lorenz — distribución del volumen</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>línea diagonal = distribución equitativa</span>
            </div>
            <ReactECharts option={lorenzOpt} style={{ height: 320 }} />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Top 50 direcciones</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{top.length} direcciones analizadas</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Dirección</th>
                    <th>Total recibido (BTC)</th>
                    <th>Nº txs</th>
                    <th>% volumen</th>
                    <th>% acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {top.slice(0, 50).map((d, i) => (
                    <tr key={i}>
                      <td className="text-xs" style={{ color: 'var(--text-tertiary)', width: 40 }}>{i + 1}</td>
                      <td><span className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{truncate(d.dir, 24)}</span></td>
                      <td className="mono font-semibold">{fmt(d.totalRecibido, 4)}</td>
                      <td className="mono">{d.nTx}</td>
                      <td className="mono" style={{ color: 'var(--text-tertiary)' }}>{d.pctVolumen}%</td>
                      <td>
                        <span className={`badge ${d.pctAcumulado > 50 ? 'badge-orange' : 'badge-neutral'}`}>
                          {d.pctAcumulado}%
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

      {!loading && (!data || data.totalDirecciones === 0) && !error && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 32 }}>
          Sin datos para el rango seleccionado. Prueba con fechas más amplias.
        </div>
      )}
    </div>
  );
}
