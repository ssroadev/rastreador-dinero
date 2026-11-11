import { useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Radio, Wifi, WifiOff } from 'lucide-react';
import { getSocket } from '../services/socket';
import { getUltimas } from '../services/api';
import {
  tooltip,
  grid,
  xAxisCategory,
  yAxis,
  lineSeries,
  barSeries,
  COLORS,
} from '../charts/chartTheme';

const MAX_LIVE = 100;
const MAX_INTERVALOS = 60; // 10 minutos en intervalos de 10 segundos
const MAX_TASAS = 60;
const INTERVALO_MS = 10_000;
const REFRESCO_MS = 1_000;

const fmt = (n, d = 6) =>
  Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });

const truncate = (s, n = 18) =>
  s ? (s.length > n ? `${s.slice(0, n)}…` : s) : '—';

const fmtTs = (d) => {
  if (!d || Number.isNaN(new Date(d).getTime())) return '—';
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const fmtHora = (d) =>
  new Date(d).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const numeroPositivo = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
};

const loteVacio = () => ({
  count: 0,
  volumen: 0,
  comision: 0,
  txs: [],
  ultimaTasa: null,
});

// Combina historial inicial y transacciones recibidas sin duplicar TxID.
function unirTransacciones(historial, recientes) {
  const porId = new Map();
  [...historial, ...recientes].forEach((tx) => {
    if (tx?.txid) porId.set(tx.txid, tx);
  });
  return [...porId.values()]
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .slice(-MAX_LIVE);
}

function opcionesIntervalo(nombre, datos, etiquetas, color, unidad) {
  return {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: grid({ left: 65, right: 25, top: 25, bottom: 45 }),
    xAxis: xAxisCategory(etiquetas, {
      axisLabel: { color: '#a3b2c3', fontSize: 11, hideOverlap: true },
    }),
    yAxis: yAxis({
      type: 'value',
      min: 0,
      name: unidad,
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3', fontSize: 11 },
    }),
    series: [barSeries(nombre, datos, color)],
  };
}

export default function TiempoReal() {
  const [connected, setConnected] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(false);
  const [live, setLive] = useState({
    txs: [],
    count: 0,
    volumen: 0,
    comision: 0,
    intervalos: [],
    tasas: [],
  });
  const pendientes = useRef(loteVacio());

  // Historial de referencia: NO se suma a los acumulados de esta sesión.
  useEffect(() => {
    let activo = true;
    getUltimas(50)
      .then((historial) => {
        if (!activo || !Array.isArray(historial)) return;
        setLive((anterior) => ({
          ...anterior,
          txs: unirTransacciones([...historial].reverse(), anterior.txs),
        }));
      })
      .catch(() => {
        if (activo) setErrorHistorial(true);
      });
    return () => { activo = false; };
  }, []);

  // Agrupa los eventos en memoria y actualiza React una vez por segundo.
  // Cada evento suma al contador, al volumen y a las comisiones.
  useEffect(() => {
    const socket = getSocket();
    const conectar = () => setConnected(true);
    const desconectar = () => setConnected(false);

    setConnected(socket.connected);

    const recibir = (tx) => {
      if (!tx?.txid) return;

      const lote = pendientes.current;
      lote.count += 1;
      lote.volumen += numeroPositivo(tx.total_salida);
      lote.comision += numeroPositivo(tx.comision);
      lote.txs.push(tx);
      if (lote.txs.length > MAX_LIVE) lote.txs.shift();

      // El backend actualmente recibe x.size (bytes), NO vbytes calculados
      // con weight. Esta tasa es una aproximación en sat/byte.
      const comision = numeroPositivo(tx.comision);
      const tamano = numeroPositivo(tx.tam_virtual);
      if (comision > 0 && tamano > 0) {
        lote.ultimaTasa = +((comision * 100_000_000) / tamano).toFixed(2);
      }
    };

    const vaciar = () => {
      const lote = pendientes.current;
      pendientes.current = loteVacio();

      const ahora = Date.now();
      const inicioIntervalo = Math.floor(ahora / INTERVALO_MS) * INTERVALO_MS;

      setLive((anterior) => {
        const tieneEventos = lote.count > 0;
        const ultimo = anterior.intervalos[anterior.intervalos.length - 1];

        // No renderizar nuevamente cuando no cambia nada.
        if (!tieneEventos && ultimo?.inicio === inicioIntervalo) {
          return anterior;
        }
        if (!tieneEventos && !ultimo) return anterior;

        let intervalos = [...anterior.intervalos];
        if (ultimo?.inicio === inicioIntervalo) {
          intervalos[intervalos.length - 1] = {
            ...ultimo,
            count: ultimo.count + lote.count,
            volumen: ultimo.volumen + lote.volumen,
            comision: ultimo.comision + lote.comision,
          };
        } else {
          intervalos.push({
            inicio: inicioIntervalo,
            count: lote.count,
            volumen: lote.volumen,
            comision: lote.comision,
          });
          intervalos = intervalos.slice(-MAX_INTERVALOS);
        }

        return {
          txs: tieneEventos
            ? unirTransacciones(anterior.txs, lote.txs)
            : anterior.txs,
          count: anterior.count + lote.count,
          volumen: anterior.volumen + lote.volumen,
          comision: anterior.comision + lote.comision,
          intervalos,
          tasas: lote.ultimaTasa !== null
            ? [...anterior.tasas, { tiempo: ahora, valor: lote.ultimaTasa }].slice(-MAX_TASAS)
            : anterior.tasas,
        };
      });
    };

    socket.on('connect', conectar);
    socket.on('disconnect', desconectar);
    socket.on('nueva-transaccion', recibir);
    const intervalo = setInterval(vaciar, REFRESCO_MS);

    return () => {
      clearInterval(intervalo);
      socket.off('connect', conectar);
      socket.off('disconnect', desconectar);
      socket.off('nueva-transaccion', recibir);
      pendientes.current = loteVacio();
    };
  }, []);

  const etiquetas = live.intervalos.map((p) => fmtHora(p.inicio));
  const actividadOpt = opcionesIntervalo(
    'Transacciones recibidas',
    live.intervalos.map((p) => p.count),
    etiquetas,
    COLORS.cyan,
    'tx / 10 s'
  );
  const volumenOpt = opcionesIntervalo(
    'Volumen de salidas (BTC)',
    live.intervalos.map((p) => +p.volumen.toFixed(6)),
    etiquetas,
    COLORS.orange,
    'BTC / 10 s'
  );
  const tasasOpt = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: grid({ left: 65, right: 25, top: 24, bottom: 48 }),
    xAxis: xAxisCategory(live.tasas.map((p) => fmtHora(p.tiempo)), {
      axisLabel: {
        color: '#a3b2c3',
        fontSize: 11,
        hideOverlap: true,
        interval: Math.max(0, Math.floor(live.tasas.length / 7)),
      },
    }),
    yAxis: yAxis({
      type: 'value',
      min: 0,
      name: 'sat/byte',
      nameTextStyle: { color: '#a3b2c3' },
      axisLabel: { color: '#a3b2c3', fontSize: 11 },
    }),
    series: [lineSeries('Tasa estimada', live.tasas.map((p) => p.valor), COLORS.green)],
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon"><Radio size={15} strokeWidth={1.8} /></div>
          <div>
            <div className="page-title">Monitor en Tiempo Real</div>
            <div className="page-subtitle">
              Bitcoin sin confirmar · Change Streams → Socket.IO → React
            </div>
          </div>
        </div>
        <div className="live-indicator" style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
          <div className={`live-dot ${connected ? 'on' : 'off'}`} />
          {connected
            ? <><Wifi size={12} /> Socket conectado</>
            : <><WifiOff size={12} /> Sin conexión con la API</>}
        </div>
      </div>

      {errorHistorial && (
        <div className="card" style={{ padding: 12, marginBottom: 12, color: 'var(--yellow)' }}>
          No se pudo cargar el historial inicial; los nuevos eventos seguirán apareciendo en vivo.
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="card-title">Txs recibidas en esta sesión</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>
            {live.count.toLocaleString('es-CO')}
          </div>
          <div className="kpi-label">desde que abriste esta página</div>
        </div>
        <div className="card">
          <div className="card-title">Volumen de salidas observado</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>
            {fmt(live.volumen, 4)}
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 6 }}>BTC</span>
          </div>
          <div className="kpi-label">suma de salidas; puede incluir cambio</div>
        </div>
        <div className="card">
          <div className="card-title">Comisiones estimadas acumuladas</div>
          <div className="kpi-value" style={{ color: 'var(--yellow)' }}>
            {fmt(live.comision, 8)}
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 6 }}>BTC</span>
          </div>
          <div className="kpi-label">no son ingresos mineros confirmados</div>
        </div>
      </div>

      {/* Informe en vivo 1: actividad por intervalos */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Informe 1 · Actividad de transacciones</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Transacciones recibidas por intervalo de 10 s</span>
        </div>
        {live.intervalos.length ? (
          <ReactECharts option={actividadOpt} style={{ height: 235 }} notMerge />
        ) : (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
            Esperando transacciones en vivo…
          </div>
        )}
      </div>

      {/* Informe en vivo 2: volumen de outputs */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Informe 2 · Volumen de salidas observado</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>BTC por intervalo de 10 s</span>
        </div>
        {live.intervalos.length ? (
          <ReactECharts option={volumenOpt} style={{ height: 235 }} notMerge />
        ) : (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
            Esperando transacciones en vivo…
          </div>
        )}
      </div>

      {/* Informe en vivo 3: tasa estimada de comisión */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Informe 3 · Tasa de comisión estimada</span>
          {live.tasas.length > 0 && (
            <span className="badge badge-green">
              Última muestra: {fmt(live.tasas[live.tasas.length - 1].valor, 2)} sat/byte
            </span>
          )}
        </div>
        {live.tasas.length > 0 ? (
          <ReactECharts option={tasasOpt} style={{ height: 235 }} notMerge />
        ) : (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
            Esperando transacciones con datos de comisión y tamaño…
          </div>
        )}
        <p style={{ margin: '0 16px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
          Se muestra una muestra por segundo como máximo. El tamaño que proporciona la ingesta es
          el tamaño en bytes reportado por la fuente; por tanto, no es una medición exacta en sat/vB.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Transacciones recientes
            <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontWeight: 400 }}>
              (últimas {live.txs.length})
            </span>
          </span>
          <span className="badge badge-orange">Change Stream</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>TxID</th>
                <th>Timestamp</th>
                <th>Estado</th>
                <th>Salidas (BTC)</th>
                <th>Comisión estimada (BTC)</th>
                <th>In / Out</th>
                <th>Tamaño reportado</th>
              </tr>
            </thead>
            <tbody>
              {[...live.txs].reverse().map((tx, i) => (
                <tr
                  key={tx.txid || i}
                  style={i === 0 ? {
                    background: 'rgba(0, 199, 129, .05)',
                    borderLeft: '2px solid var(--green)',
                  } : {}}
                >
                  <td>
                    <span className="mono" style={{ color: 'var(--accent)' }} title={tx.txid}>
                      {truncate(tx.txid, 20)}
                    </span>
                  </td>
                  <td className="text-xs mono">{fmtTs(tx.fecha)}</td>
                  <td className="mono text-xs">
                    {tx.bloque == null ? 'Sin confirmar' : `#${fmt(tx.bloque, 0)}`}
                  </td>
                  <td className="mono font-semibold">{fmt(tx.total_salida, 6)} ₿</td>
                  <td className="mono">{fmt(tx.comision, 8)}</td>
                  <td className="mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {tx.n_inputs ?? '—'} / {tx.n_outputs ?? '—'}
                  </td>
                  <td className="mono text-xs">{fmt(tx.tam_virtual, 0)} bytes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
