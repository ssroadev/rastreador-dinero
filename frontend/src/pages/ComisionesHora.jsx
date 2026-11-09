import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Flame } from 'lucide-react';
import { getComisionesHora } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip } from '../charts/chartTheme';

const DIAS  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);

export default function ComisionesHora() {
  const [filtro, setFiltro]   = useState(rangoPorDefecto());
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargar = async () => {
    setLoading(true); setError(null);
    try { setData(await getComisionesHora(filtro)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const heatValues = data.map(d => [d.hora, d.dia - 1, +(d.tasaPromedioSatVb ?? 0)]);
  const maxRate    = data.reduce((m, d) => Math.max(m, d.tasaPromedioSatVb ?? 0), 0);

  // Find min rate cell for recommendation
  const minCell = data.reduce((min, d) => (!min || d.tasaPromedioSatVb < min.tasaPromedioSatVb) ? d : min, null);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      formatter: (p) =>
        `${DIAS[p.data[1]]} ${p.data[0]}:00 UTC<br/>` +
        `<span style="color:#f7931a;font-weight:700">${Number(p.data[2]).toFixed(2)} sat/vbyte</span>`,
    },
    grid: { left: 44, right: 20, top: 14, bottom: 72 },
    xAxis: {
      type: 'category',
      data: HORAS,
      axisLabel: { color: '#4a5e73', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', interval: 1 },
      axisLine: { lineStyle: { color: '#1c2a3a' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: DIAS,
      axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLine: { lineStyle: { color: '#1c2a3a' } },
      splitLine: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxRate || 100,
      calculable: false,
      show: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemHeight: 120,
      textStyle: { color: '#7d8fa3', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
      inRange: {
        color: ['#0d1117', '#0f2d47', '#1a4d6e', '#f7931a', '#ffd166'],
      },
      formatter: (v) => `${v.toFixed(0)} sat/vb`,
    },
    series: [{
      type: 'heatmap',
      data: heatValues,
      itemStyle: { borderColor: '#0d1117', borderWidth: 1 },
      emphasis: {
        itemStyle: { shadowBlur: 8, shadowColor: 'rgba(247,147,26,.4)' },
      },
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={Flame}
        title="Mapa de Calor — Comisiones por Día y Hora"
        subtitle="¿Cuándo conviene enviar una transacción para minimizar la comisión? Oscuro = bajo coste."
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
        <div className="grid-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Tasa promedio (sat / vbyte)</span>
              {minCell && (
                <span className="badge badge-green">
                  Mínimo: {DIAS[minCell.dia - 1]} {minCell.hora}h — {Number(minCell.tasaPromedioSatVb).toFixed(1)} sat/vb
                </span>
              )}
            </div>
            <ReactECharts option={option} style={{ height: 340 }} />
          </div>

          {/* Top 5 cheapest slots */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Ventanas de menor coste</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Top 5 franjas más baratas</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Día</th>
                    <th>Hora (UTC)</th>
                    <th>sat / vbyte</th>
                    <th>N° Transacciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data]
                    .sort((a, b) => (a.tasaPromedioSatVb ?? 0) - (b.tasaPromedioSatVb ?? 0))
                    .slice(0, 5)
                    .map((d, i) => (
                      <tr key={i}>
                        <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                        <td>{DIAS[d.dia - 1]}</td>
                        <td className="mono">{String(d.hora).padStart(2, '0')}:00</td>
                        <td>
                          <span className="badge badge-green mono">{Number(d.tasaPromedioSatVb).toFixed(2)}</span>
                        </td>
                        <td className="mono">{Number(d.transacciones).toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="card empty-state">Sin datos para el rango seleccionado.</div>
      )}
    </div>
  );
}
