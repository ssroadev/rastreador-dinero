import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { CalendarRange } from 'lucide-react';
import { getMensual } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { tooltip, grid, xAxisCategory, yAxis, legend, COLORS } from '../charts/chartTheme';

const fmt = (n, d = 4) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });

export default function Mensual() {
  const [filtro, setFiltro]   = useState({ desde: '', hasta: '' })   // sin rango = todos los meses;
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getMensual(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const meses = data.map(d => d.mes);

  const optActivity = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: legend(),
    grid: grid({ right: 64, bottom: 44 }),
    xAxis: xAxisCategory(meses),
    yAxis: [
      yAxis({ name: 'txs' }),
      yAxis({ name: 'BTC', position: 'right', splitLine: { show: false } }),
    ],
    series: [
      {
        name: 'Transacciones',
        type: 'bar',
        data: data.map(d => d.transacciones),
        itemStyle: { color: COLORS.blue, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Volumen (BTC)',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.volumenBTC),
        smooth: true,
        lineStyle: { color: COLORS.orange, width: 1.5 },
        itemStyle: { color: COLORS.orange },
        areaStyle: { color: `${COLORS.orange}10` },
        symbol: 'circle', symbolSize: 5,
      },
    ],
  };

  const optFees = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: legend(),
    grid: grid({ right: 64, bottom: 44 }),
    xAxis: xAxisCategory(meses),
    yAxis: [
      yAxis({ name: 'BTC total' }),
      yAxis({ name: 'BTC prom.', position: 'right', splitLine: { show: false } }),
    ],
    series: [
      {
        name: 'Comisión Total',
        type: 'bar',
        data: data.map(d => d.comisionTotal),
        itemStyle: { color: COLORS.yellow, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Comisión Prom.',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.comisionPromedio),
        smooth: true,
        lineStyle: { color: COLORS.red, width: 1.5 },
        itemStyle: { color: COLORS.red },
        symbol: 'circle', symbolSize: 4,
      },
    ],
  };

  const trend = (cur, prev) => {
    if (!prev) return null;
    const d = ((cur - prev) / prev) * 100;
    return { val: d, up: d >= 0 };
  };

  return (
    <div>
      <PageHeader
        Icon={CalendarRange}
        title="Comparación Mensual"
        subtitle="Diferencias mes a mes en actividad, volumen y comisiones. Identifica ciclos y tendencias de crecimiento."
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
            <div className="card-header"><span className="card-title">Actividad: Transacciones y Volumen</span></div>
            <ReactECharts option={optActivity} style={{ height: 300 }} />
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header"><span className="card-title">Comisiones: Total y Promedio</span></div>
            <ReactECharts option={optFees} style={{ height: 280 }} />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Tabla resumen</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Transacciones</th>
                    <th>Var.</th>
                    <th>Volumen (BTC)</th>
                    <th>Comisión Total (BTC)</th>
                    <th>Comisión Prom. (BTC)</th>
                    <th>Tam. Prom. (vb)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => {
                    const t = trend(d.transacciones, data[i - 1]?.transacciones);
                    return (
                      <tr key={d.mes}>
                        <td className="mono">{d.mes}</td>
                        <td className="mono">{fmt(d.transacciones, 0)}</td>
                        <td>
                          {t && (
                            <span className={t.up ? 'trend-up' : 'trend-down'} style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                              {t.up ? '▲' : '▼'} {Math.abs(t.val).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="mono">{fmt(d.volumenBTC, 2)} ₿</td>
                        <td className="mono">{fmt(d.comisionTotal, 4)} ₿</td>
                        <td className="mono">{fmt(d.comisionPromedio, 8)} ₿</td>
                        <td className="mono">{fmt(d.tamPromedio, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
