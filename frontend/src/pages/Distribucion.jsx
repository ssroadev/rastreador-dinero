import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3, Download } from 'lucide-react';
import { getDistribucion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, COLORS, PALETTE } from '../charts/chartTheme';

const fmt = (valor, decimales = 2) =>
  Number(valor ?? 0).toLocaleString('es-CO', {
    maximumFractionDigits: decimales,
  });

const porcentaje = (parte, total) =>
  total > 0 ? (parte / total) * 100 : 0;

// Coincide con $bucket de backend/scripts/pre-agregar-dia.js:
// boundaries: [1, 2, 3, 5, 10, 20, 50, 100, 500].
const ETIQUETAS = {
  '1': '1 salida',
  '2': '2 salidas',
  '3': '3–4 salidas',
  '5': '5–9 salidas',
  '10': '10–19 salidas',
  '20': '20–49 salidas',
  '50': '50–99 salidas',
  '100': '100–499 salidas',
  '500+': '500 o más',
};

const ORDEN = ['1', '2', '3', '5', '10', '20', '50', '100', '500+'];

function nombreRango(rango) {
  return ETIQUETAS[String(rango)] ?? `Rango ${String(rango)}`;
}

function normalizarDatos(respuesta) {
  if (!Array.isArray(respuesta)) {
    throw new Error('La API de Distribución no devolvió una lista de rangos.');
  }

  return respuesta
    .map((d) => ({
      rango: String(d.rango),
      count: Math.max(0, Number(d.count) || 0),
      comisionPromedio: Number(d.comisionPromedio) || 0,
      volumenPromedio: Number(d.volumenPromedio) || 0,
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => {
      const i = ORDEN.indexOf(a.rango);
      const j = ORDEN.indexOf(b.rango);
      return (i < 0 ? 999 : i) - (j < 0 ? 999 : j);
    });
}

export default function Distribucion() {
  const [filtro, setFiltro] = useState(rangoPorDefecto());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const respuesta = await getDistribucion(filtro);
      setData(normalizarDatos(respuesta));
    } catch (e) {
      setData([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const total = data.reduce((s, d) => s + d.count, 0);
  const unaODos = data
    .filter((d) => d.rango === '1' || d.rango === '2')
    .reduce((s, d) => s + d.count, 0);
  const grupoPrincipal = data.reduce(
    (mayor, actual) => (!mayor || actual.count > mayor.count ? actual : mayor),
    null
  );

  // La API entrega un resumen agregado por rango; no descargamos transacciones individuales.
  const descargarCSV = () => {
    if (!data.length) return;

    const filas = [
      ['Rango de salidas', 'Transacciones', 'Porcentaje', 'Comisión promedio BTC', 'Volumen promedio BTC'],
      ...data.map((d) => [
        nombreRango(d.rango),
        d.count,
        porcentaje(d.count, total).toFixed(2).replace('.', ','),
        String(d.comisionPromedio).replace('.', ','),
        String(d.volumenPromedio).replace('.', ','),
      ]),
    ];

    const contenido = '\uFEFF' + filas.map((fila) =>
      fila.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(';')
    ).join('\r\n');

    const url = URL.createObjectURL(new Blob([contenido], {
      type: 'text/csv;charset=utf-8;',
    }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'distribucion_salidas_bitcoin.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  const barOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: ({ dataIndex }) => {
        const d = data[dataIndex];
        if (!d) return '';
        return `<strong>${nombreRango(d.rango)}</strong><br/>` +
          `Transacciones: <b>${fmt(d.count, 0)}</b><br/>` +
          `Participación: <b>${fmt(porcentaje(d.count, total), 2)}%</b>`;
      },
    },
    grid: { left: 115, right: 55, top: 18, bottom: 40 },
    xAxis: {
      type: 'value',
      name: 'Transacciones',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3', formatter: (v) => fmt(v, 0) },
      splitLine: { lineStyle: { color: '#253244', opacity: 0.65 } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: data.map((d) => nombreRango(d.rango)),
      axisLabel: { color: '#a3b2c3', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    series: [{
      name: 'Transacciones',
      type: 'bar',
      barMaxWidth: 22,
      data: data.map((d) => d.count),
      itemStyle: { color: COLORS.orange, borderRadius: [0, 4, 4, 0] },
      emphasis: { itemStyle: { color: '#ffb44d' } },
    }],
  };

  const pieOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: (p) =>
        `${p.name}<br/><b>${fmt(p.value, 0)} transacciones</b><br/>${fmt(p.percent, 2)}% del total`,
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { color: '#a3b2c3', fontSize: 11 },
    },
    series: [{
      name: 'Distribución',
      type: 'pie',
      radius: ['43%', '69%'],
      center: ['50%', '43%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: { scaleSize: 5 },
      data: data.map((d, i) => ({
        name: nombreRango(d.rango),
        value: d.count,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={BarChart3}
        title="Distribución de salidas"
        subtitle="Explora cuántas salidas tienen las transacciones Bitcoin y compara su frecuencia, comisión y volumen por rango."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          {loading ? 'Consultando…' : 'Aplicar'}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={descargarCSV}
          disabled={loading || total === 0}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && !error && total > 0 && (
        <>
          <div className="grid-3" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Transacciones del período</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {fmt(total, 0)}
              </div>
              <div className="kpi-label">suma de los rangos del informe</div>
            </div>
            <div className="card">
              <div className="card-title">Con 1 o 2 salidas</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)' }}>
                {fmt(porcentaje(unaODos, total), 2)}%
              </div>
              <div className="kpi-label">{fmt(unaODos, 0)} transacciones</div>
            </div>
            <div className="card">
              <div className="card-title">Rango más frecuente</div>
              <div className="kpi-value" style={{ color: 'var(--green)', fontSize: 22 }}>
                {nombreRango(grupoPrincipal.rango)}
              </div>
              <div className="kpi-label">
                {fmt(porcentaje(grupoPrincipal.count, total), 2)}% del total
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Transacciones por cantidad de salidas</span>
              </div>
              <ReactECharts option={barOpt} style={{ height: 390 }} notMerge={true} />
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Participación por rango</span>
              </div>
              <ReactECharts option={pieOpt} style={{ height: 390 }} notMerge={true} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12, padding: '18px 22px' }}>
            <div className="card-header">
              <span className="card-title">Interpretación analítica</span>
              <span className="badge badge-green">Datos agregados en MongoDB</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <p>
                El rango <strong>{nombreRango(grupoPrincipal.rango)}</strong> es el más
                frecuente: reúne <strong>{fmt(grupoPrincipal.count, 0)}</strong> transacciones,
                equivalentes al <strong>{fmt(porcentaje(grupoPrincipal.count, total), 2)}%</strong> del total.
              </p>
              <p style={{ marginTop: 10 }}>
                En conjunto, las transacciones con una o dos salidas representan
                el <strong>{fmt(porcentaje(unaODos, total), 2)}%</strong> de las operaciones analizadas.
              </p>
              <p style={{ marginTop: 10, fontSize: 12 }}>
                La cantidad de salidas describe la estructura de las transacciones; por sí sola
                no permite identificar mezcladores, fraude ni propietarios de direcciones.
                Las comisiones y los volúmenes se muestran como promedios por transacción
                dentro de cada rango.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Detalle por rango de salidas</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {data.length} rangos con registros
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rango de salidas</th>
                    <th>Transacciones</th>
                    <th>% del total</th>
                    <th>Comisión promedio (BTC)</th>
                    <th>Volumen promedio (BTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={d.rango}>
                      <td className="mono">{nombreRango(d.rango)}</td>
                      <td className="mono font-semibold">{fmt(d.count, 0)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 64, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${porcentaje(d.count, total)}%`,
                              height: '100%',
                              background: PALETTE[i % PALETTE.length],
                            }} />
                          </div>
                          <span className="mono">{fmt(porcentaje(d.count, total), 2)}%</span>
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

      {!loading && !error && total === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>
          No hay resultados de distribución para el período seleccionado.
          Comprueba las fechas y vuelve a consultar.
        </div>
      )}
    </div>
  );
}
