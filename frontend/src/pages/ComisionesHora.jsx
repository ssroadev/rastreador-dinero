import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Flame } from 'lucide-react';
import { getComisionesHora } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip } from '../charts/chartTheme';

// MongoDB usa $dayOfWeek: domingo = 1, sábado = 7.
// El repositorio agrupa las horas en America/Bogota.
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

const fmt = (valor, decimales = 2) => Number(valor ?? 0).toLocaleString('es-CO', {
  minimumFractionDigits: decimales,
  maximumFractionDigits: decimales,
});
const fmtInt = valor => Number(valor ?? 0).toLocaleString('es-CO');

export default function ComisionesHora() {
  const [filtro, setFiltro] = useState(rangoPorDefecto());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await getComisionesHora(filtro);
      setData(Array.isArray(resultado) ? resultado : []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const celdas = data
    .map(d => ({
      dia: Number(d.dia),
      hora: Number(d.hora),
      tasa: Number(d.tasaPromedioSatVb),
      transacciones: Number(d.transacciones),
    }))
    .filter(d =>
      Number.isInteger(d.dia) && d.dia >= 1 && d.dia <= 7 &&
      Number.isInteger(d.hora) && d.hora >= 0 && d.hora <= 23 &&
      Number.isFinite(d.tasa) && d.tasa >= 0 &&
      Number.isFinite(d.transacciones) && d.transacciones > 0
    );

  // Las franjas son medias históricas; la media general se pondera por transacciones.
  const totalTx = celdas.reduce((s, d) => s + d.transacciones, 0);
  const tasaPromedio = totalTx
    ? celdas.reduce((s, d) => s + d.tasa * d.transacciones, 0) / totalTx
    : 0;

  const ordenadas = [...celdas].sort((a, b) => a.tasa - b.tasa);
  const minima = ordenadas[0] || null;
  const maxima = ordenadas[ordenadas.length - 1] || null;

  // Para que «sin datos» NO parezca una comisión de 0 sat/vB.
  const presentes = new Set(celdas.map(d => `${d.dia}-${d.hora}`));
  const faltantes = [];
  for (let dia = 1; dia <= 7; dia++) {
    for (let hora = 0; hora < 24; hora++) {
      if (!presentes.has(`${dia}-${hora}`)) faltantes.push([hora, dia - 1, 0]);
    }
  }

  const option = {
    backgroundColor: 'transparent',
    animationDuration: 350,
    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: p => {
        const punto = p.data;
        if (!punto || p.seriesIndex !== 1) return 'Sin registros para esta franja';
        return `<b>${DIAS[punto[1]]} · ${HORAS[punto[0]]} (Bogotá)</b><br/>` +
          `Comisión promedio: <b>${fmt(punto[2])} sat/vB</b><br/>` +
          `Transacciones analizadas: <b>${fmtInt(punto[3])}</b>`;
      },
    },
    grid: { left: 78, right: 22, top: 24, bottom: 90 },
    xAxis: {
      type: 'category',
      data: HORAS,
      name: 'Hora de Bogotá (UTC−5)',
      nameLocation: 'middle',
      nameGap: 36,
      nameTextStyle: { color: '#a3b2c3', fontSize: 11 },
      axisLabel: { color: '#a3b2c3', fontSize: 10, interval: 2 },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: DIAS_CORTOS,
      axisLabel: { color: '#a3b2c3', fontSize: 12 },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { show: false },
    },
    visualMap: [
      {
        // Las franjas sin registros deben conservar su color gris.
        show: false,
        seriesIndex: 0,
        min: 0,
        max: 1,
        inRange: { color: ['#273242', '#273242'] },
      },
      {
        seriesIndex: 1,
        dimension: 2, // La tasa sat/vB está en data[2]; data[3] contiene el número de transacciones.
        min: 0,
        max: Math.max(1, ...celdas.map(d => d.tasa)),
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 5,
        itemWidth: 12,
        itemHeight: 170,
        text: ['Mayor tasa', 'Menor tasa'],
        textStyle: { color: '#a3b2c3', fontSize: 11 },
        inRange: {
          color: ['#15314a', '#256d91', '#f7931a', '#ffcc66'],
        },
      },
    ],
    series: [
      {
        name: 'Sin datos',
        type: 'heatmap',
        data: faltantes,
        silent: true,
        itemStyle: { color: '#273242', borderColor: '#0d1117', borderWidth: 1.5 },
      },
      {
        name: 'Comisión promedio',
        type: 'heatmap',
        data: celdas.map(d => [d.hora, d.dia - 1, d.tasa, d.transacciones]),
        itemStyle: { borderColor: '#0d1117', borderWidth: 1.5 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(247,147,26,.35)' } },
      },
    ],
  };

  return (
    <div>
      <PageHeader
        Icon={Flame}
        title="Mapa de calor · Comisiones por día y hora"
        subtitle="Compara las tasas de comisión históricas por franja horaria de Bogotá para identificar patrones de la red Bitcoin."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          {loading ? 'Consultando...' : 'Aplicar'}
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && celdas.length > 0 && (
        <>
          <div className="grid-3" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Tasa media del período</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {fmt(tasaPromedio)} <span style={{ fontSize: 13 }}>sat/vB</span>
              </div>
              <div className="kpi-label">Ponderada por transacciones</div>
            </div>
            <div className="card">
              <div className="card-title">Franja de menor tasa observada</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {fmt(minima.tasa)} <span style={{ fontSize: 13 }}>sat/vB</span>
              </div>
              <div className="kpi-label">{DIAS[minima.dia - 1]}, {HORAS[minima.hora]} · Bogotá</div>
            </div>
            <div className="card">
              <div className="card-title">Franja de mayor tasa observada</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                {fmt(maxima.tasa)} <span style={{ fontSize: 13 }}>sat/vB</span>
              </div>
              <div className="kpi-label">{DIAS[maxima.dia - 1]}, {HORAS[maxima.hora]} · Bogotá</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Tasa promedio de comisión por día y hora</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Zona horaria: Bogotá (UTC−5)</span>
            </div>
            <ReactECharts option={option} style={{ height: 385 }} notMerge={true} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '8px 16px 16px' }}>
              Las celdas grises indican franjas sin registros. El color refleja la comisión media histórica,
              no una predicción del precio de una transacción futura.
            </p>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Cinco franjas con menor comisión media</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Histórico del período seleccionado</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Día</th>
                    <th>Hora (Bogotá)</th>
                    <th>Tasa media (sat/vB)</th>
                    <th>Transacciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.slice(0, 5).map((d, i) => (
                    <tr key={`${d.dia}-${d.hora}`}>
                      <td className="mono">{i + 1}</td>
                      <td>{DIAS[d.dia - 1]}</td>
                      <td className="mono">{HORAS[d.hora]}</td>
                      <td><span className="badge badge-green mono">{fmt(d.tasa)}</span></td>
                      <td className="mono">{fmtInt(d.transacciones)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 22px', lineHeight: 1.7 }}>
            <div className="card-title">Interpretación analítica</div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 10 }}>
              Entre las {fmtInt(celdas.length)} franjas horarias con datos, la menor tasa promedio
              se observó el <strong>{DIAS[minima.dia - 1]} a las {HORAS[minima.hora]}</strong>,
              con <strong>{fmt(minima.tasa)} sat/vB</strong> sobre {fmtInt(minima.transacciones)} transacciones.
              La mayor tasa se observó el <strong>{DIAS[maxima.dia - 1]} a las {HORAS[maxima.hora]}</strong>,
              con <strong>{fmt(maxima.tasa)} sat/vB</strong>.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 10 }}>
              Este reporte describe actividad pasada. La comisión efectiva de un envío depende
              de las condiciones de la mempool y de la prioridad de confirmación al momento de transmitir.
            </p>
          </div>
        </>
      )}

      {!loading && celdas.length === 0 && !error && (
        <div className="card empty-state">Sin datos para el rango seleccionado.</div>
      )}
    </div>
  );
}
