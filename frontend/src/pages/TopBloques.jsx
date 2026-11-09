import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Blocks } from 'lucide-react';
import { getTopBloques } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { tooltip, grid, xAxisCategory, yAxis, COLORS } from '../charts/chartTheme';

const fmt  = (n, d = 6) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';

export default function TopBloques() {
  const [filtro, setFiltro]   = useState({ desde: '', hasta: '' });
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getTopBloques(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const top20 = data.slice(0, 20);
  const max   = top20.reduce((m, d) => Math.max(m, d.comisionTotal ?? 0), 0);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0]?.dataIndex;
        const d = top20[i];
        if (!d) return '';
        return `Bloque <b style="color:var(--accent)">#${d.bloque}</b><br/>` +
          `Comisión: <b>${fmt(d.comisionTotal)} BTC</b><br/>` +
          `Txs: ${fmt(d.txs, 0)} · ${fmt(d.satVbPromedio, 1)} sat/vb`;
      },
    },
    grid: grid({ bottom: 68 }),
    xAxis: xAxisCategory(
      top20.map(d => `#${d.bloque}`),
      { axisLabel: { rotate: 40, fontSize: 10 } }
    ),
    yAxis: yAxis({ name: 'BTC' }),
    series: [{
      type: 'bar',
      data: top20.map(d => d.comisionTotal ?? 0),
      itemStyle: {
        borderRadius: [3, 3, 0, 0],
        color: (p) => {
          const ratio = (p.data ?? 0) / (max || 1);
          if (ratio > .75) return COLORS.red;
          if (ratio > .45) return COLORS.orange;
          return COLORS.yellow;
        },
      },
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={Blocks}
        title="Top Bloques por Comisión"
        subtitle="Los bloques con mayor ingreso para mineros. Coinciden con períodos de máxima congestión."
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
              <span className="card-title">Top 20 — comisión total por bloque</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>gradiente: amarillo → rojo = mayor ingreso</span>
            </div>
            <ReactECharts option={option} style={{ height: 300 }} />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Ranking completo</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{data.length} bloques</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Bloque</th>
                    <th>Fecha</th>
                    <th>Txs</th>
                    <th>Comisión Total (BTC)</th>
                    <th>Volumen (BTC)</th>
                    <th>sat / vb</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={d.bloque}>
                      <td className="text-xs" style={{ color: 'var(--text-tertiary)', width: 40 }}>{i + 1}</td>
                      <td><span className="mono" style={{ color: 'var(--accent)' }}>#{fmt(d.bloque, 0)}</span></td>
                      <td className="text-xs">{fmtDate(d.fecha)}</td>
                      <td className="mono">{fmt(d.txs, 0)}</td>
                      <td><span className="mono font-semibold">{fmt(d.comisionTotal)} ₿</span></td>
                      <td className="mono">{fmt(d.volumenBTC, 4)} ₿</td>
                      <td>
                        <span className={`badge ${(d.satVbPromedio ?? 0) > 50 ? 'badge-red' : (d.satVbPromedio ?? 0) > 20 ? 'badge-orange' : 'badge-green'}`}>
                          {fmt(d.satVbPromedio, 1)}
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
