import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Search, Split } from 'lucide-react';
import { getFragmentacion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, COLORS } from '../charts/chartTheme';

const fmt = (n, digitos = 4) =>
  Number(n ?? 0).toLocaleString('es-CO', {
    maximumFractionDigits: digitos,
  });

const truncate = (valor, max = 18) => {
  const texto = String(valor ?? '');
  return texto ? (texto.length > max ? `${texto.slice(0, max)}…` : texto) : '—';
};

const fmtTs = (valor) =>
  valor
    ? new Date(valor).toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : '—';

const gruposSalidas = [
  { nombre: '10–19', minimo: 10, maximo: 19 },
  { nombre: '20–49', minimo: 20, maximo: 49 },
  { nombre: '50–99', minimo: 50, maximo: 99 },
  { nombre: '100 o más', minimo: 100, maximo: Infinity },
];

export default function Fragmentacion() {
  const [filtro, setFiltro] = useState(rangoPorDefecto());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await getFragmentacion(filtro);
      if (!Array.isArray(resultado)) {
        throw new Error('La API no devolvió una lista de transacciones.');
      }
      setData(resultado);
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

  // La API entrega un conjunto limitado de resultados, no el universo completo.
  const muestra = data.filter(
    (d) => Number.isFinite(Number(d.n_outputs)) && Number.isFinite(Number(d.coefVariacion))
  );
  const textoBusqueda = search.trim().toLowerCase();
  const filtradas = textoBusqueda
    ? data.filter((d) => String(d.txid ?? '').toLowerCase().includes(textoBusqueda))
    : data;

  const totalVolumen = data.reduce((total, d) => total + (Number(d.total_salida) || 0), 0);
  const promedioSalidas = data.length
    ? data.reduce((total, d) => total + (Number(d.n_outputs) || 0), 0) / data.length
    : 0;
  const maximaSalidas = data.length
    ? Math.max(...data.map((d) => Number(d.n_outputs) || 0))
    : 0;

  const conteos = gruposSalidas.map((grupo) =>
    data.filter((d) => {
      const salidas = Number(d.n_outputs);
      return salidas >= grupo.minimo && salidas <= grupo.maximo;
    }).length
  );
  const grupoPrincipal = conteos.length
    ? conteos.indexOf(Math.max(...conteos))
    : 0;

  const dispersionOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: ({ data: punto }) => {
        if (!punto) return '';
        return `Salidas: <b>${fmt(punto[0], 0)}</b><br/>` +
          `Coef. de variación: <b>${fmt(punto[1], 4)}</b><br/>` +
          `Volumen: <b>${fmt(punto[2], 4)} BTC</b>`;
      },
    },
    grid: { left: 72, right: 30, top: 36, bottom: 60 },
    xAxis: {
      type: 'value',
      name: 'Número de salidas',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3' },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#253244', opacity: 0.5 } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      name: 'Coeficiente de variación',
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3' },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#253244', opacity: 0.5 } },
    },
    series: [{
      type: 'scatter',
      data: muestra.map((d) => [
        Number(d.n_outputs),
        Number(d.coefVariacion),
        Number(d.total_salida) || 0,
      ]),
      symbolSize: 10,
      itemStyle: { color: COLORS.purple, opacity: 0.75 },
      emphasis: { itemStyle: { color: COLORS.orange, opacity: 1 } },
    }],
  };

  const distribucionOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 55, right: 24, top: 30, bottom: 48 },
    xAxis: {
      type: 'category',
      data: gruposSalidas.map((grupo) => grupo.nombre),
      axisLabel: { color: '#a3b2c3' },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLabel: { color: '#a3b2c3' },
      splitLine: { lineStyle: { color: '#253244' } },
    },
    series: [{
      name: 'Transacciones mostradas',
      type: 'bar',
      data: conteos,
      barMaxWidth: 55,
      itemStyle: { color: COLORS.orange, borderRadius: [5, 5, 0, 0] },
      label: { show: true, position: 'top', color: '#cbd5e1' },
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={Split}
        title="Fragmentación de transacciones"
        subtitle="Explora transacciones de Bitcoin con múltiples salidas y compara su distribución y la variación de sus montos."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          {loading ? 'Consultando...' : 'Aplicar'}
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && data.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 12, padding: '12px 16px', borderLeft: '3px solid var(--accent)' }}>
            <strong>Alcance del análisis:</strong> resultados priorizados devueltos por la API para el período seleccionado.
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>
              El servicio devuelve hasta 100 transacciones. Las métricas siguientes describen únicamente esa muestra, no todas las transacciones del período.
            </p>
          </div>

          <div className="grid-3" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Transacciones mostradas</div>
              <div className="kpi-value" style={{ color: 'var(--purple)' }}>{fmt(data.length, 0)}</div>
              <div className="kpi-label">coincidencias devueltas por la API</div>
            </div>
            <div className="card">
              <div className="card-title">Volumen de la muestra</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {fmt(totalVolumen, 4)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span>
              </div>
              <div className="kpi-label">suma de las salidas mostradas</div>
            </div>
            <div className="card">
              <div className="card-title">Salidas promedio</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)' }}>{fmt(promedioSalidas, 1)}</div>
              <div className="kpi-label">máximo observado: {fmt(maximaSalidas, 0)} salidas</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Dispersión · Número de salidas y variabilidad</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>CV menor = montos más similares</span>
            </div>
            <ReactECharts option={dispersionOpt} style={{ height: 340 }} notMerge={true} />
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Distribución por cantidad de salidas</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Transacciones dentro de la muestra</span>
            </div>
            <ReactECharts option={distribucionOpt} style={{ height: 300 }} notMerge={true} />
          </div>

          <div className="card" style={{ marginBottom: 12, padding: '20px 24px' }}>
            <div className="card-header">
              <span className="card-title">Interpretación analítica</span>
              <span className="badge badge-neutral">Basada en la muestra</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: 12 }}>
              <p>
                Entre las <strong>{fmt(data.length, 0)} transacciones mostradas</strong>,
                el grupo con mayor número de registros es el de <strong>{gruposSalidas[grupoPrincipal].nombre} salidas</strong>
                {' '}({fmt(conteos[grupoPrincipal], 0)} transacciones).
              </p>
              <p style={{ marginTop: 10 }}>
                El promedio es de <strong>{fmt(promedioSalidas, 1)} salidas</strong> por transacción.
                El coeficiente de variación ayuda a distinguir repartos de montos similares de otros más heterogéneos.
              </p>
              <p style={{ marginTop: 10, fontSize: 12 }}>
                Estos patrones pueden tener usos legítimos, como pagos por lotes. No constituyen por sí mismos evidencia de lavado de dinero.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Transacciones analizadas</span>
              <div className="flex items-center gap-2">
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    placeholder="Buscar TxID..."
                    aria-label="Buscar transacción por TxID"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: 26, width: 200 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{filtradas.length} resultados</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TxID</th>
                    <th>Fecha (UTC)</th>
                    <th>Bloque</th>
                    <th>Entradas / salidas</th>
                    <th>Volumen (BTC)</th>
                    <th>Valor medio (BTC)</th>
                    <th>CV</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((d, i) => (
                    <tr key={d.txid || i}>
                      <td><span className="mono" style={{ color: 'var(--accent)' }} title={d.txid}>{truncate(d.txid, 18)}</span></td>
                      <td className="text-xs">{fmtTs(d.fecha)}</td>
                      <td className="mono">#{fmt(d.bloque, 0)}</td>
                      <td className="mono" style={{ color: 'var(--text-secondary)' }}>{d.n_inputs} → {d.n_outputs}</td>
                      <td className="mono font-semibold">{fmt(d.total_salida, 4)}</td>
                      <td className="mono">{fmt(d.valorMedio, 8)}</td>
                      <td><span className="badge badge-neutral">{fmt(d.coefVariacion, 4)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtradas.length === 0 && (
              <p style={{ padding: 16, color: 'var(--text-secondary)' }}>No hay coincidencias para ese TxID en los resultados cargados.</p>
            )}
          </div>
        </>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
          No se encontraron transacciones con los criterios de fragmentación para el período seleccionado.
        </div>
      )}
    </div>
  );
}
