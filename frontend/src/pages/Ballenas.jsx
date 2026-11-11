import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Fish, Wifi, WifiOff, Search } from 'lucide-react';

import { getBallenas, getBallenasVivo } from '../services/api';
import { getSocket } from '../services/socket';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import {
  tooltip,
  grid,
  xAxisCategory,
  yAxis,
  barSeries,
  lineSeries,
  COLORS,
} from '../charts/chartTheme';

const MAX_LIVE = 100;
const MIN_BTC = 1; // El backend requiere minBtc >= 1 para el informe histórico.

const fmt = (n, decimales = 2) =>
  Number(n ?? 0).toLocaleString('es-CO', {
    maximumFractionDigits: decimales,
  });

const truncate = (valor, limite = 20) => {
  const texto = String(valor ?? '');
  return texto ? (texto.length > limite ? `${texto.slice(0, limite)}…` : texto) : '—';
};

const fmtDia = (dia) => {
  if (!dia) return '—';
  const fecha = new Date(`${String(dia).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(fecha.getTime())
    ? String(dia)
    : fecha.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
};

const fmtTs = (valor) => {
  if (!valor) return '—';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? '—'
    : `${fecha.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })} UTC`;
};

// Combina el historial reciente con eventos del socket, sin repetir TxIDs.
function unirTransacciones(actuales, nuevas, umbral) {
  const unicas = new Map();

  for (const tx of [...nuevas, ...actuales]) {
    const monto = Number(tx?.total_salida);
    if (!tx?.txid || !Number.isFinite(monto) || monto < umbral) continue;
    if (!unicas.has(tx.txid)) unicas.set(tx.txid, tx);
  }

  return [...unicas.values()]
    .sort((a, b) => (new Date(b.fecha).getTime() || 0) - (new Date(a.fecha).getTime() || 0))
    .slice(0, MAX_LIVE);
}

export default function Ballenas() {
  const [filtro, setFiltro] = useState(rangoPorDefecto);
  const [minBtcInput, setMinBtcInput] = useState('10');
  const [config, setConfig] = useState(() => ({
    ...rangoPorDefecto(),
    minBtc: 10,
  }));

  const [historico, setHistorico] = useState([]);
  const [vivos, setVivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState('');

  // Histórico: consulta una vez al entrar y cuando se presiona Aplicar.
  useEffect(() => {
    let vigente = true;
    setLoading(true);
    setError(null);

    getBallenas({ desde: config.desde, hasta: config.hasta }, config.minBtc)
      .then((respuesta) => {
        if (vigente) setHistorico(Array.isArray(respuesta) ? respuesta : []);
      })
      .catch((err) => {
        if (vigente) {
          setHistorico([]);
          setError(err);
        }
      })
      .finally(() => {
        if (vigente) setLoading(false);
      });

    return () => {
      vigente = false;
    };
  }, [config]);

  // Datos recientes + Socket.IO: utiliza el umbral efectivamente aplicado.
  useEffect(() => {
    let vigente = true;
    const umbral = config.minBtc;
    const socket = getSocket();

    const alConectar = () => setConnected(true);
    const alDesconectar = () => setConnected(false);
    const alRecibir = (tx) => {
      if (Number(tx?.total_salida) < umbral || !tx?.txid) return;
      setVivos((anteriores) => unirTransacciones(anteriores, [tx], umbral));
    };

    setConnected(socket.connected);
    setVivos([]);
    setLiveError(null);

    socket.on('connect', alConectar);
    socket.on('disconnect', alDesconectar);
    socket.on('nueva-transaccion', alRecibir);

    getBallenasVivo(MAX_LIVE, umbral)
      .then((respuesta) => {
        if (!vigente) return;
        const recientes = Array.isArray(respuesta) ? respuesta : [];
        setVivos((anteriores) => unirTransacciones(anteriores, recientes, umbral));
      })
      .catch(() => {
        if (vigente) setLiveError('No se pudo cargar el historial reciente del mempool. Los eventos en vivo pueden continuar llegando.');
      });

    return () => {
      vigente = false;
      // Se eliminan únicamente los listeners de esta página.
      socket.off('connect', alConectar);
      socket.off('disconnect', alDesconectar);
      socket.off('nueva-transaccion', alRecibir);
    };
  }, [config.minBtc]);

  const aplicar = () => {
    const umbral = Number(minBtcInput);

    if (!Number.isFinite(umbral) || umbral < MIN_BTC) {
      setError(new Error(`El umbral mínimo debe ser de ${MIN_BTC} BTC o más.`));
      return;
    }
    if (!filtro.desde || !filtro.hasta || filtro.desde > filtro.hasta) {
      setError(new Error('Selecciona un rango de fechas válido.'));
      return;
    }

    setConfig({ ...filtro, minBtc: umbral });
  };

  // KPIs: provienen de agregaciones MongoDB sobre el rango seleccionado.
  const totalTxs = historico.reduce((suma, dia) => suma + Number(dia.transacciones || 0), 0);
  const totalVol = historico.reduce((suma, dia) => suma + Number(dia.volumenTotal || 0), 0);
  const montoMax = historico.reduce((maximo, dia) => Math.max(maximo, Number(dia.montoMaximo || 0)), 0);
  const promedio = totalTxs > 0 ? totalVol / totalTxs : 0;
  const diaMayorActividad = historico.reduce(
    (mayor, dia) => !mayor || Number(dia.transacciones) > Number(mayor.transacciones) ? dia : mayor,
    null
  );

  const chartOpt = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: {
      top: 2,
      right: 12,
      textStyle: { color: '#a3b2c3', fontSize: 11 },
    },
    grid: grid({ top: 54, bottom: 70, left: 62, right: 68 }),
    xAxis: xAxisCategory(historico.map((dia) => fmtDia(dia.dia)), {
      axisLabel: {
        color: '#a3b2c3',
        fontSize: 11,
        rotate: historico.length > 9 ? 35 : 0,
        hideOverlap: true,
      },
    }),
    yAxis: [
      yAxis({
        type: 'value',
        name: 'Txs',
        nameTextStyle: { color: '#a3b2c3' },
        axisLabel: { color: '#a3b2c3', fontSize: 11 },
      }),
      yAxis({
        type: 'value',
        name: 'BTC',
        position: 'right',
        nameTextStyle: { color: '#a3b2c3' },
        axisLabel: { color: '#a3b2c3', fontSize: 11 },
        splitLine: { show: false },
      }),
    ],
    series: [
      barSeries('Transacciones', historico.map((dia) => Number(dia.transacciones || 0)), COLORS.orange),
      lineSeries('Volumen BTC', historico.map((dia) => Number(dia.volumenTotal || 0)), COLORS.blue, {
        yAxisIndex: 1,
        areaStyle: { opacity: 0 },
        lineStyle: { color: COLORS.blue, width: 2 },
      }),
    ],
  };

  const vivosFiltrados = search.trim()
    ? vivos.filter((tx) => String(tx.txid).toLowerCase().includes(search.trim().toLowerCase()))
    : vivos;

  return (
    <div>
      <PageHeader
        Icon={Fish}
        title="Ballenas · transacciones de alto valor"
        subtitle="Compara la actividad histórica de transacciones de alto valor y observa nuevas operaciones no confirmadas en el mempool de Bitcoin."
      />

      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="ballenas-min-btc" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Umbral mínimo (BTC)
          </label>
          <input
            id="ballenas-min-btc"
            type="number"
            min={MIN_BTC}
            step="0.1"
            value={minBtcInput}
            onChange={(e) => setMinBtcInput(e.target.value)}
            style={{ width: 92 }}
          />
        </div>
        <button className="btn btn-primary" onClick={aplicar} disabled={loading}>
          {loading ? 'Consultando…' : 'Aplicar'}
        </button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {!loading && !error && historico.length > 0 && (
        <>
          <div className="grid-4" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-title">Transacciones de alto valor</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>{fmt(totalTxs, 0)}</div>
              <div className="kpi-label">operaciones ≥ {fmt(config.minBtc, 2)} BTC en el período</div>
            </div>
            <div className="card">
              <div className="card-title">Volumen de salidas</div>
              <div className="kpi-value" style={{ color: 'var(--blue)' }}>
                {fmt(totalVol, 2)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span>
              </div>
              <div className="kpi-label">suma de salidas de las operaciones seleccionadas</div>
            </div>
            <div className="card">
              <div className="card-title">Monto promedio</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {fmt(promedio, 2)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span>
              </div>

              <div
                className="kpi-value"
                style={{
                  color: 'var(--blue)',
                  fontSize: 'clamp(19px, 1.6vw, 27px)',
                  letterSpacing: '-0.8px',
                  whiteSpace: 'nowrap'
                }}
              >
                {fmt(totalVol, 2)}
                <span
                  style={{
                    fontSize: 12,
                    marginLeft: 6,
                    color: 'var(--text-secondary)'
                  }}
                >
                  BTC
                </span>
              </div>

            </div>
            <div className="card">
              <div className="card-title">Mayor transacción observada</div>
              <div className="kpi-value" style={{ color: 'var(--red)' }}>
                {fmt(montoMax, 2)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span>
              </div>
              <div className="kpi-label">máximo del rango consultado</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Transacciones y volumen diario de alto valor</span>
              <span className="badge badge-orange">Umbral ≥ {fmt(config.minBtc, 2)} BTC</span>
            </div>
            <ReactECharts option={chartOpt} style={{ height: 330 }} notMerge={true} />
          </div>

          {diaMayorActividad && (
            <div className="card" style={{ marginBottom: 12, padding: '16px 20px' }}>
              <div className="card-header">
                <span className="card-title">Interpretación analítica</span>
                <span className="badge badge-neutral">Datos históricos</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginTop: 10 }}>
                Entre los días con operaciones que cumplen el umbral de {fmt(config.minBtc, 2)} BTC,
                el de mayor actividad fue <strong>{fmtDia(diaMayorActividad.dia)}</strong>,
                con <strong> {fmt(diaMayorActividad.transacciones, 0)} transacciones</strong>.
                En el rango seleccionado se registraron <strong> {fmt(totalTxs, 0)} operaciones</strong>
                y un volumen agregado de salidas de <strong> {fmt(totalVol, 2)} BTC</strong>.
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
                “Ballena” aquí significa transacción que supera un umbral de volumen, no una persona
                o dirección identificada. Las salidas pueden incluir cambio y estos datos no demuestran actividad ilícita.
              </p>
            </div>
          )}
        </>
      )}

      {!loading && !error && historico.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 28, marginBottom: 12, color: 'var(--text-secondary)' }}>
          No hay transacciones históricas que superen {fmt(config.minBtc, 2)} BTC en las fechas seleccionadas.
        </div>
      )}

      {/* El listado vivo no depende del rango histórico: muestra transacciones no confirmadas recientes. */}
      <div className="card">
        <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span className="card-title">
            Ballenas en vivo
            <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontWeight: 400 }}>
              mempool · últimas {vivos.length}
            </span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                aria-label="Buscar transacción por TxID"
                placeholder="Buscar TxID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 190, paddingLeft: 28 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: connected ? 'var(--green)' : 'var(--red)', fontSize: 12 }}>
              <span className={`live-dot ${connected ? 'on' : 'off'}`} />
              {connected ? <><Wifi size={14} /> Socket conectado</> : <><WifiOff size={14} /> Sin conexión</>}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 12px', color: 'var(--text-tertiary)', fontSize: 12 }}>
          Transacciones no confirmadas con volumen de salidas ≥ {fmt(config.minBtc, 2)} BTC.
          El estado del socket no garantiza que la fuente externa esté enviando eventos.
          {liveError && <p style={{ marginTop: 6, color: 'var(--red)' }}>{liveError}</p>}
        </div>

        <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>TxID</th>
                <th>Fecha (UTC)</th>
                <th>Volumen salidas (BTC)</th>
                <th>Comisión estimada (BTC)</th>
                <th>Entradas / salidas</th>
                <th>sat/B aprox.</th>
              </tr>
            </thead>
            <tbody>
              {vivosFiltrados.map((tx, i) => {
                // La ingesta actual guarda x.size (bytes) en tam_virtual;
                // por eso NO corresponde etiquetar esta tasa como sat/vB.
                const bytes = Number(tx.tam_virtual);
                const comision = Number(tx.comision);
                const satPorByte = bytes > 0 && Number.isFinite(comision)
                  ? (comision * 1e8) / bytes
                  : null;

                return (
                  <tr key={tx.txid} style={i === 0 ? { background: 'rgba(247,147,26,.05)' } : undefined}>
                    <td>
                      <span className="mono" title={tx.txid} style={{ color: 'var(--accent)' }}>
                        {truncate(tx.txid, 22)}
                      </span>
                    </td>
                    <td className="text-xs mono">{fmtTs(tx.fecha)}</td>
                    <td className="mono font-semibold">{fmt(tx.total_salida, 4)} BTC</td>
                    <td className="mono">{fmt(tx.comision, 8)}</td>
                    <td className="mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {tx.n_inputs ?? '—'} / {tx.n_outputs ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${satPorByte == null ? 'badge-neutral' : satPorByte > 50 ? 'badge-red' : satPorByte > 20 ? 'badge-orange' : 'badge-neutral'}`}>
                        {satPorByte == null ? '—' : fmt(satPorByte, 2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {vivosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>
                    {search.trim()
                      ? 'No hay transacciones que coincidan con el TxID buscado.'
                      : `Sin operaciones recientes ≥ ${fmt(config.minBtc, 2)} BTC. Si no aparecen nuevos datos, verifica npm run ingesta.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
