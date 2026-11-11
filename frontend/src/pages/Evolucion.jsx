import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp } from 'lucide-react';

import { getEvolucion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, COLORS } from '../charts/chartTheme';

const METRICAS = {
  transacciones: {
    label: 'N.º de transacciones',
    unit: 'tx',
    color: COLORS.orange,
    decimales: 0,
    valor: (fila) => Number(fila.transacciones),
  },
  comisionPromedioBTC: {
    label: 'Comisión promedio',
    unit: 'sat/tx',
    color: COLORS.yellow,
    decimales: 2,
    valor: (fila) => Number(fila.comisionPromedioBTC) * 100_000_000,
  },
  tamVirtualPromedio: {
    label: 'Tamaño virtual promedio',
    unit: 'vB',
    color: COLORS.blue,
    decimales: 1,
    valor: (fila) => Number(fila.tamVirtualPromedio),
  },
  salidasPromedio: {
    label: 'Salidas promedio',
    unit: 'salidas/tx',
    color: COLORS.cyan,
    decimales: 2,
    valor: (fila) => Number(fila.salidasPromedio),
  },
};

const numero = (n, decimales = 2) =>
  Number(n).toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

const diaLegible = (dia) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia ?? ''))) return String(dia ?? '—');
  return new Date(`${dia}T00:00:00.000Z`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
};

const kpiStyle = { marginBottom: 12 };

export default function Evolucion() {
  const [filtro, setFiltro] = useState(rangoPorDefecto());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metrica, setMetrica] = useState('transacciones');

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await getEvolucion(filtro);
      setData(Array.isArray(resultado) ? resultado : []);
    } catch (e) {
      setError(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const cfg = METRICAS[metrica];
  const ordenados = [...data].sort((a, b) => String(a.dia).localeCompare(String(b.dia)));
  const puntos = ordenados.map((fila) => {
    const valor = cfg.valor(fila);
    return { dia: fila.dia, valor: Number.isFinite(valor) ? valor : null };
  });
  const validos = puntos.filter((p) => p.valor !== null);
  const primero = validos[0];
  const ultimo = validos[validos.length - 1];
  const mayor = validos.reduce((mejor, p) => !mejor || p.valor > mejor.valor ? p : mejor, null);
  const menor = validos.reduce((mejor, p) => !mejor || p.valor < mejor.valor ? p : mejor, null);
  const promedio = validos.length
    ? validos.reduce((suma, p) => suma + p.valor, 0) / validos.length
    : null;
  const variacion = primero && ultimo && validos.length > 1 && primero.valor !== 0
    ? ((ultimo.valor - primero.valor) / primero.valor) * 100
    : null;

  const formatoValor = (valor) =>
    valor === null || !Number.isFinite(valor)
      ? '—'
      : numero(valor, cfg.decimales);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      formatter: (params) => {
        const punto = params?.[0];
        if (!punto) return '';
        return `<b>${diaLegible(punto.axisValue)}</b><br/>${cfg.label}: <b>${formatoValor(Number(punto.data))} ${cfg.unit}</b>`;
      },
    },
    grid: {
      left: 76,
      right: 30,
      top: 35,
      bottom: puntos.length > 18 ? 85 : 56,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: puntos.map((p) => p.dia),
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#a3b2c3',
        fontSize: 11,
        rotate: puntos.length > 18 ? 30 : 0,
        interval: puntos.length <= 12 ? 0 : 'auto',
        formatter: diaLegible,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      name: cfg.unit,
      nameTextStyle: { color: '#a3b2c3', fontSize: 11 },
      axisLabel: {
        color: '#a3b2c3',
        fontSize: 11,
        formatter: (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 }),
      },
      splitLine: { lineStyle: { color: '#253244', opacity: 0.7 } },
    },
    dataZoom: puntos.length > 18 ? [
      { type: 'inside', xAxisIndex: 0 },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 16,
        bottom: 8,
        borderColor: '#334155',
        fillerColor: 'rgba(247,147,26,0.15)',
        handleStyle: { color: cfg.color },
        textStyle: { color: '#a3b2c3' },
        showDetail: false,
      },
    ] : [],
    series: [{
      name: cfg.label,
      type: 'line',
      data: puntos.map((p) => p.valor),
      smooth: false, // No inventar curvaturas entre observaciones diarias.
      connectNulls: false,
      showSymbol: puntos.length <= 18,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { color: cfg.color, width: 2.5 },
      itemStyle: { color: cfg.color },
      areaStyle: { color: `${cfg.color}16` },
    }],
  };

  return (
    <div>
      <PageHeader
        Icon={TrendingUp}
        title="Evolución temporal"
        subtitle="Compara la actividad diaria de Bitcoin, las comisiones y las características de las transacciones."
      />

      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <RangoFechas {...filtro} onChange={setFiltro} />
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div className="tabs" style={{ flexWrap: 'wrap' }}>
          {Object.entries(METRICAS).map(([clave, conf]) => (
            <button
              key={clave}
              className={`tab ${metrica === clave ? 'active' : ''}`}
              onClick={() => setMetrica(clave)}
              type="button"
            >
              {conf.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={cargar} disabled={loading} type="button">
          {loading ? 'Cargando…' : 'Aplicar'}
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && validos.length > 0 && (
        <>
          <div className="grid-3" style={kpiStyle}>
            <div className="card">
              <div className="card-title">Máximo diario</div>
              <div className="kpi-value" style={{ color: cfg.color, fontSize: 25 }}>
                {formatoValor(mayor.valor)}
              </div>
              <div className="kpi-label">{cfg.unit} · {diaLegible(mayor.dia)}</div>
            </div>
            <div className="card">
              <div className="card-title">Mínimo diario</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)', fontSize: 25 }}>
                {formatoValor(menor.valor)}
              </div>
              <div className="kpi-label">{cfg.unit} · {diaLegible(menor.dia)}</div>
            </div>
            <div className="card">
              <div className="card-title">Promedio diario</div>
              <div className="kpi-value" style={{ fontSize: 25 }}>
                {formatoValor(promedio)}
              </div>
              <div className="kpi-label">{cfg.unit} · {validos.length} días con datos</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">{cfg.label} por día</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {puntos.length} días · {cfg.unit}
              </span>
            </div>
            <ReactECharts option={option} style={{ height: 370 }} notMerge={true} />
          </div>

          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="card-header">
              <span className="card-title">Interpretación del período</span>
              <span className="badge badge-neutral">Calculado a partir de la serie</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: 12 }}>
              <p>
                El valor máximo de <strong>{cfg.label.toLowerCase()}</strong> se registró el{' '}
                <strong>{diaLegible(mayor.dia)}</strong>, con{' '}
                <strong>{formatoValor(mayor.valor)} {cfg.unit}</strong>.
                El mínimo ocurrió el <strong>{diaLegible(menor.dia)}</strong>, con{' '}
                <strong>{formatoValor(menor.valor)} {cfg.unit}</strong>.
              </p>
              <p style={{ marginTop: 10 }}>
                {variacion === null
                  ? 'No hay datos suficientes para calcular el cambio entre el primer y último día.'
                  : `Entre el primer y el último día observado, el indicador ${variacion > 0 ? 'aumentó' : variacion < 0 ? 'disminuyó' : 'no cambió'} ${numero(Math.abs(variacion), 2)} %.`}
              </p>
              <p style={{ marginTop: 10, fontSize: 12 }}>
                La comparación describe los datos observados. Una mayor cantidad de transacciones
                no demuestra por sí sola congestión de la red y el volumen no implica movimiento
                neto entre propietarios diferentes.
              </p>
            </div>
          </div>
        </>
      )}

      {!loading && validos.length === 0 && !error && (
        <div className="card empty-state">Sin datos para el período seleccionado.</div>
      )}
    </div>
  );
}
