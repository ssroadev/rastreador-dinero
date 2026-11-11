import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Blocks, Download } from 'lucide-react';
import { getTopBloques } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, COLORS } from '../charts/chartTheme';

const fmt = (valor, decimales = 2) =>
  Number(valor ?? 0).toLocaleString('es-CO', {
    maximumFractionDigits: decimales,
  });

// El backend devuelve fechas en UTC; evitar mostrar el día anterior en Colombia.
const fmtFecha = (fecha) => {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
      });
};

function normalizar(respuesta) {
  if (!Array.isArray(respuesta)) {
    throw new Error('La API de Top Bloques no devolvió una lista.');
  }

  return respuesta
    .filter((r) => r && r.bloque != null)
    .map((r) => ({
      bloque: r.bloque,
      fecha: r.fecha,
      txs: Number(r.txs) || 0,
      comisionTotal: Number(r.comisionTotal) || 0,
      volumenBTC: Number(r.volumenBTC) || 0,
      tamVirtualTotal: Number(r.tamVirtualTotal) || 0,
      satVbPromedio: Number(r.satVbPromedio) || 0,
    }))
    .sort((a, b) => b.comisionTotal - a.comisionTotal);
}

function exportarCSV(datos) {
  if (!datos.length) return;
  const filas = [
    ['Posicion', 'Bloque', 'Fecha UTC', 'Transacciones', 'Comisiones BTC', 'Volumen salidas BTC', 'Tasa media sat/vB'],
    ...datos.map((d, i) => [
      i + 1,
      d.bloque,
      d.fecha ? new Date(d.fecha).toISOString().slice(0, 10) : '',
      d.txs,
      d.comisionTotal,
      d.volumenBTC,
      d.satVbPromedio,
    ]),
  ];

  const csv = '\uFEFF' + filas.map((fila) =>
    fila.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(';')
  ).join('\r\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'top_bloques_bitcoin.csv';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export default function TopBloques() {
  const [filtro, setFiltro] = useState(rangoPorDefecto());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const respuesta = await getTopBloques(filtro);
      setData(normalizar(respuesta));
    } catch (e) {
      setData([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // Todas las estadísticas se refieren únicamente a los bloques devueltos.
  const totalComisiones = data.reduce((sum, d) => sum + d.comisionTotal, 0);
  const totalTxs = data.reduce((sum, d) => sum + d.txs, 0);
  const totalTam = data.reduce((sum, d) => sum + d.tamVirtualTotal, 0);
  const tasaPonderada = totalTam > 0 ? (totalComisiones * 1e8) / totalTam : 0;
  const bloqueLider = data[0] || null;
  const promedioComision = data.length ? totalComisiones / data.length : 0;
  const top20 = data.slice(0, 20);

  const barrasOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: (p) => {
        const d = top20[p.dataIndex];
        if (!d) return '';
        return `<strong>Bloque #${d.bloque}</strong><br/>` +
          `Comisiones: <b>${fmt(d.comisionTotal, 6)} BTC</b><br/>` +
          `Transacciones: <b>${fmt(d.txs, 0)}</b><br/>` +
          `Tasa media: <b>${fmt(d.satVbPromedio, 2)} sat/vB</b>`;
      },
    },
    grid: { left: 108, right: 60, top: 15, bottom: 45 },
    xAxis: {
      type: 'value',
      name: 'Comisiones (BTC)',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3', formatter: (v) => fmt(v, 2) },
      splitLine: { lineStyle: { color: '#253244', opacity: 0.7 } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: top20.map((d) => `#${d.bloque}`),
      axisLabel: { color: '#a3b2c3', fontSize: 11 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    series: [{
      name: 'Comisiones BTC',
      type: 'bar',
      barMaxWidth: 18,
      data: top20.map((d) => d.comisionTotal),
      itemStyle: { color: COLORS.orange, borderRadius: [0, 4, 4, 0] },
      emphasis: { itemStyle: { color: '#ffc16b' } },
    }],
  };

  const relacionOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: (p) => {
        const [txs, comision, bloque, tasa] = p.data;
        return `<strong>Bloque #${bloque}</strong><br/>` +
          `Transacciones: <b>${fmt(txs, 0)}</b><br/>` +
          `Comisiones: <b>${fmt(comision, 6)} BTC</b><br/>` +
          `Tasa media: <b>${fmt(tasa, 2)} sat/vB</b>`;
      },
    },
    grid: { left: 70, right: 35, top: 28, bottom: 55 },
    xAxis: {
      type: 'value',
      name: 'Transacciones por bloque',
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3', formatter: (v) => fmt(v, 0) },
      splitLine: { lineStyle: { color: '#253244', opacity: 0.65 } },
    },
    yAxis: {
      type: 'value',
      name: 'Comisiones (BTC)',
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3', formatter: (v) => fmt(v, 2) },
      splitLine: { lineStyle: { color: '#253244', opacity: 0.65 } },
    },
    series: [{
      name: 'Bloques',
      type: 'scatter',
      data: data.map((d) => [d.txs, d.comisionTotal, d.bloque, d.satVbPromedio]),
      symbolSize: 11,
      itemStyle: { color: COLORS.blue, opacity: 0.78 },
      emphasis: { itemStyle: { color: COLORS.orange, opacity: 1 } },
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={Blocks}
        title="Top Bloques por Comisión"
        subtitle="Identifica los bloques con mayores comisiones de transacción y compara su actividad dentro del período seleccionado."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          {loading ? 'Consultando…' : 'Aplicar'}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => exportarCSV(data)}
          disabled={loading || !data.length}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && !error && data.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 12, padding: '12px 16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              El ranking incluye hasta 50 bloques con mayores comisiones del período. Los totales y promedios de abajo
              se calculan sobre esos bloques, <strong>no sobre todos los bloques de Bitcoin</strong>.
            </span>
          </div>

          <div className="grid-4" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Bloques en el ranking</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>{fmt(data.length, 0)}</div>
              <div className="kpi-label">seleccionados por comisión total</div>
            </div>
            <div className="card">
              <div className="card-title">Comisiones del ranking</div>
              <div className="kpi-value" style={{ color: 'var(--blue)', fontSize: 'clamp(19px, 1.7vw, 26px)' }}>
                {fmt(totalComisiones, 4)} <span style={{ fontSize: 12 }}>BTC</span>
              </div>
              <div className="kpi-label">sumadas entre los bloques listados</div>
            </div>
            <div className="card">
              <div className="card-title">Transacciones incluidas</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>{fmt(totalTxs, 0)}</div>
              <div className="kpi-label">en los bloques del ranking</div>
            </div>
            <div className="card">
              <div className="card-title">Tasa media ponderada</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                {fmt(tasaPonderada, 2)} <span style={{ fontSize: 12 }}>sat/vB</span>
              </div>
              <div className="kpi-label">comisiones / tamaño virtual del ranking</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Top {top20.length} bloques · comisiones totales</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Ordenados de mayor a menor BTC en comisiones
              </span>
            </div>
            <ReactECharts
              option={barrasOpt}
              style={{ height: Math.max(360, top20.length * 25 + 70) }}
              notMerge={true}
            />
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Actividad frente a comisiones</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Cada punto representa un bloque del ranking
              </span>
            </div>
            <ReactECharts option={relacionOpt} style={{ height: 340 }} notMerge={true} />
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Interpretación analítica</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
              El bloque <strong>#{bloqueLider.bloque}</strong>, registrado el{' '}
              <strong>{fmtFecha(bloqueLider.fecha)}</strong>, encabezó el ranking con{' '}
              <strong>{fmt(bloqueLider.comisionTotal, 6)} BTC</strong> en comisiones y{' '}
              <strong>{fmt(bloqueLider.txs, 0)} transacciones</strong>. La comisión media por bloque
              dentro del ranking fue de <strong>{fmt(promedioComision, 6)} BTC</strong>.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginTop: 10, fontSize: 12 }}>
              Estas cifras describen únicamente los bloques seleccionados. Las comisiones elevadas pueden estar
              relacionadas con la demanda de espacio en bloque, pero no demuestran por sí solas congestión
              ni representan toda la recompensa que recibe un minero.
            </p>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Ranking completo</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {data.length} bloques · Fechas UTC
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Bloque</th>
                    <th>Fecha (UTC)</th>
                    <th>Txs</th>
                    <th>Comisiones (BTC)</th>
                    <th>Volumen de salidas (BTC)</th>
                    <th>Tasa media (sat/vB)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={String(d.bloque)}>
                      <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                      <td className="mono" style={{ color: 'var(--accent)' }}>#{d.bloque}</td>
                      <td className="text-xs">{fmtFecha(d.fecha)}</td>
                      <td className="mono">{fmt(d.txs, 0)}</td>
                      <td className="mono font-semibold">{fmt(d.comisionTotal, 6)}</td>
                      <td className="mono">{fmt(d.volumenBTC, 4)}</td>
                      <td className="mono">{fmt(d.satVbPromedio, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
          No se encontraron bloques con datos para el período seleccionado.
        </div>
      )}
    </div>
  );
}
