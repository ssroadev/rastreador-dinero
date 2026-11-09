import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3 } from 'lucide-react';
import { getDistribucion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { tooltip, grid, xAxisCategory, yAxis, barSeries, COLORS, PALETTE } from '../charts/chartTheme';

const fmt = (n, d = 2) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });

function bucketLabel(rango, index) {
  const limits = [2, 3, 5, 10, 20, 50, 100, 500];
  if (rango === '500+') return '≥ 500';
  const next = limits[index];
  return next ? `${rango} – ${next}` : `${rango}+`;
}

export default function Distribucion() {
  const [filtro, setFiltro]   = useState({ desde: '', hasta: '' });
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getDistribucion(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const labels = data.map((d, i) => bucketLabel(d.rango, i));
  const total  = data.reduce((s, d) => s + d.count, 0);

  const barOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      formatter: (p) => {
        const d = data[p[0]?.dataIndex];
        if (!d) return '';
        return `${labels[p[0].dataIndex]}<br/>` +
          `Txs: <b>${fmt(d.count, 0)}</b> (${((d.count / total) * 100).toFixed(1)}%)<br/>` +
          `Comisión prom: ${fmt(d.comisionPromedio, 8)} BTC`;
      },
    },
    grid: grid({ bottom: 48 }),
    xAxis: xAxisCategory(labels),
    yAxis: yAxis({ name: 'txs' }),
    series: [barSeries('Transacciones', data.map(d => d.count), COLORS.blue)],
  };

  const pieOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      formatter: (p) => `${p.name}<br/><b>${fmt(p.value, 0)}</b> txs — ${p.percent?.toFixed(1)}%`,
    },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '50%'],
      data: data.map((d, i) => ({
        value: d.count,
        name: labels[i],
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        color: '#7d8fa3',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
      },
      labelLine: { lineStyle: { color: '#1c2a3a' } },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.5)' } },
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={BarChart3}
        title="Distribución de Outputs"
        subtitle="¿Cuántas salidas tienen las transacciones? Muchas salidas pueden indicar mixers o pagos masivos."
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
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Volumen por rango de outputs</span></div>
              <ReactECharts option={barOpt} style={{ height: 280 }} />
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Proporción relativa</span></div>
              <ReactECharts option={pieOpt} style={{ height: 280 }} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Detalle por bucket</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>total: {fmt(total, 0)} txs</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rango Outputs</th>
                    <th>Transacciones</th>
                    <th>% del total</th>
                    <th>Comisión Prom. (BTC)</th>
                    <th>Volumen Prom. (BTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={i}>
                      <td className="mono">{labels[i]}</td>
                      <td className="mono">{fmt(d.count, 0)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 60, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${(d.count / total) * 100}%`, height: '100%', background: PALETTE[i % PALETTE.length], borderRadius: 2 }} />
                          </div>
                          <span className="mono">{((d.count / total) * 100).toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className="mono">{fmt(d.comisionPromedio, 8)}</td>
                      <td className="mono">{fmt(d.volumenPromedio, 4)}</td>
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
