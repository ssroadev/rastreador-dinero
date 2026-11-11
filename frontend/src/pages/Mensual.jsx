import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { CalendarRange, Download } from 'lucide-react';
import { getMensual } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { tooltip, COLORS } from '../charts/chartTheme';

const fmt = (valor, decimales = 2) =>
  Number(valor ?? 0).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });

const nombreMes = (mes) => {
  if (!/^\d{4}-\d{2}$/.test(String(mes))) return String(mes ?? '—');
  return new Date(`${mes}-01T00:00:00.000Z`).toLocaleDateString('es-CO', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

const variacion = (actual, anterior) => {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
};

function normalizar(respuesta) {
  if (!Array.isArray(respuesta)) {
    throw new Error('La API de Comparación no devolvió una lista de meses.');
  }
  return respuesta
    .filter((r) => r && r.mes)
    .map((r) => ({
      mes: String(r.mes),
      transacciones: Number(r.transacciones) || 0,
      volumenBTC: Number(r.volumenBTC) || 0,
      comisionTotal: Number(r.comisionTotal) || 0,
      comisionPromedio: Number(r.comisionPromedio) || 0,
      tamPromedio: Number(r.tamPromedio) || 0,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

function descargarCSV(datos) {
  if (!datos.length) return;
  const filas = [
    ['Mes', 'Transacciones', 'Volumen BTC', 'Comision total BTC', 'Comision promedio BTC', 'Tamano virtual promedio vB'],
    ...datos.map((d) => [
      d.mes, d.transacciones, d.volumenBTC, d.comisionTotal,
      d.comisionPromedio, d.tamPromedio,
    ]),
  ];
  const csv = '\uFEFF' + filas.map((fila) =>
    fila.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(';')
  ).join('\r\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'comparacion_mensual_bitcoin.csv';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export default function Mensual() {
  // Se dejan vacíos para consultar todos los meses disponibles.
  const [filtro, setFiltro] = useState({ desde: '', hasta: '' });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(normalizar(await getMensual(filtro)));
    } catch (e) {
      setData([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const meses = data.map((d) => nombreMes(d.mes));
  const totalTx = data.reduce((s, d) => s + d.transacciones, 0);
  const totalVol = data.reduce((s, d) => s + d.volumenBTC, 0);
  const totalComisiones = data.reduce((s, d) => s + d.comisionTotal, 0);
  const satPromedio = totalTx > 0 ? (totalComisiones * 1e8) / totalTx : 0;
  const mesMasActivo = data.reduce(
    (mejor, d) => (!mejor || d.transacciones > mejor.transacciones ? d : mejor),
    null
  );

  const ejeBase = {
    axisLabel: { color: '#a3b2c3', fontSize: 11 },
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { show: false },
  };
  const ejeValores = (titulo, lado = 'left') => ({
    type: 'value',
    name: titulo,
    position: lado,
    nameTextStyle: { color: '#a3b2c3' },
    axisLabel: {
      color: '#a3b2c3',
      formatter: (v) => fmt(v, v >= 100 ? 0 : 2),
    },
    splitLine: lado === 'left'
      ? { lineStyle: { color: '#253244', opacity: 0.7 } }
      : { show: false },
  });

  const optActividad = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: { top: 4, textStyle: { color: '#a3b2c3' } },
    grid: { left: 80, right: 90, top: 58, bottom: 50 },
    xAxis: { ...ejeBase, type: 'category', data: meses },
    yAxis: [ejeValores('Transacciones'), ejeValores('BTC', 'right')],
    series: [
      {
        name: 'Transacciones', type: 'bar', barMaxWidth: 58,
        data: data.map((d) => d.transacciones),
        itemStyle: { color: COLORS.blue, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Volumen BTC', type: 'line', yAxisIndex: 1,
        data: data.map((d) => d.volumenBTC),
        smooth: false, symbolSize: 7,
        lineStyle: { width: 3, color: COLORS.orange },
        itemStyle: { color: COLORS.orange },
      },
    ],
  };

  const optComisiones = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: { top: 4, textStyle: { color: '#a3b2c3' } },
    grid: { left: 80, right: 90, top: 58, bottom: 50 },
    xAxis: { ...ejeBase, type: 'category', data: meses },
    yAxis: [ejeValores('BTC total'), ejeValores('sat/tx', 'right')],
    series: [
      {
        name: 'Comisiones totales (BTC)', type: 'bar', barMaxWidth: 58,
        data: data.map((d) => d.comisionTotal),
        itemStyle: { color: COLORS.yellow, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Comisión media (sat/tx)', type: 'line', yAxisIndex: 1,
        data: data.map((d) => d.comisionPromedio * 1e8),
        smooth: false, symbolSize: 7,
        lineStyle: { width: 3, color: COLORS.purple },
        itemStyle: { color: COLORS.purple },
      },
    ],
  };

  return (
    <div>
      <PageHeader
        Icon={CalendarRange}
        title="Comparación mensual"
        subtitle="Compara actividad, volumen y comisiones entre los meses con información disponible de Bitcoin."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          {loading ? 'Consultando...' : 'Aplicar'}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => descargarCSV(data)}
          disabled={loading || !data.length}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && data.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${COLORS.orange}` }}>
            <div className="card-title" style={{ marginBottom: 8 }}>Cómo interpretar la comparación</div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
              Los resultados representan los <strong>totales de los días almacenados</strong> en cada mes.
              Si un mes está incompleto, sus totales no son directamente comparables con los de un mes completo.
              Las variaciones de la tabla describen el cambio del total observado, no una tasa de crecimiento mensual ajustada por días.
            </p>
          </div>

          <div className="grid-4" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Meses con registros</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)' }}>{data.length}</div>
              <div className="kpi-label">meses incluidos en la consulta</div>
            </div>
            <div className="card">
              <div className="card-title">Transacciones registradas</div>
              <div className="kpi-value" style={{ color: 'var(--accent)', fontSize: 22 }}>{fmt(totalTx, 0)}</div>
              <div className="kpi-label">suma de los meses seleccionados</div>
            </div>
            <div className="card">
              <div className="card-title">Volumen de salidas</div>
              <div className="kpi-value" style={{ color: 'var(--blue)', fontSize: 21 }}>{fmt(totalVol, 2)}</div>
              <div className="kpi-label">BTC observados en el período</div>
            </div>
            <div className="card">
              <div className="card-title">Comisión media</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>{fmt(satPromedio, 0)}</div>
              <div className="kpi-label">sat por transacción (ponderada)</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Actividad mensual · Transacciones y volumen</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Dos escalas independientes</span>
            </div>
            <ReactECharts option={optActividad} style={{ height: 340 }} notMerge={true} />
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Comisiones mensuales · Total y promedio</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>BTC total y sat/tx promedio</span>
            </div>
            <ReactECharts option={optComisiones} style={{ height: 320 }} notMerge={true} />
          </div>

          {mesMasActivo && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><span className="card-title">Interpretación analítica</span></div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
                <strong>{nombreMes(mesMasActivo.mes)}</strong> concentra la mayor cantidad de
                transacciones registradas en los meses seleccionados, con{' '}
                <strong>{fmt(mesMasActivo.transacciones, 0)}</strong> operaciones y un volumen de{' '}
                <strong>{fmt(mesMasActivo.volumenBTC, 2)} BTC</strong>.
                Esto identifica el mayor <em>total observado</em>, pero no permite afirmar que
                haya sido el mes de mayor actividad diaria si la cobertura de días es diferente.
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Resumen mensual</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                Variaciones del total observado (no ajustadas por días)
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Transacciones</th>
                    <th>Variación</th>
                    <th>Volumen BTC</th>
                    <th>Comisión total BTC</th>
                    <th>Comisión media sat/tx</th>
                    <th>Tamaño prom. vB</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => {
                    const cambio = variacion(d.transacciones, data[i - 1]?.transacciones);
                    return (
                      <tr key={d.mes}>
                        <td className="mono">{nombreMes(d.mes)}</td>
                        <td className="mono">{fmt(d.transacciones, 0)}</td>
                        <td>
                          {cambio == null ? '—' : (
                            <span
                              className={cambio >= 0 ? 'trend-up' : 'trend-down'}
                              title="Variación del total registrado; no ajustada por cantidad de días"
                            >
                              {cambio > 0 ? '+' : ''}{fmt(cambio, 1)}%
                            </span>
                          )}
                        </td>
                        <td className="mono">{fmt(d.volumenBTC, 2)}</td>
                        <td className="mono">{fmt(d.comisionTotal, 4)}</td>
                        <td className="mono">{fmt(d.comisionPromedio * 1e8, 0)}</td>
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

      {!loading && !error && data.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          No hay información mensual para el rango seleccionado. Prueba con un período más amplio.
        </div>
      )}
    </div>
  );
}
