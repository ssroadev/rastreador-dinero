import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Radio, Wifi, WifiOff } from 'lucide-react';
import { getSocket } from '../services/socket';
import { getUltimas } from '../services/api';
import { tooltip, grid, xAxisCategory, yAxis, lineSeries, COLORS } from '../charts/chartTheme';

const MAX_LIVE = 100;
const fmt      = (n, d = 6) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });
const truncate = (s, n = 18) => s ? (s.length > n ? s.slice(0, n) + '…' : s) : '—';
const fmtTs    = (d) => d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

export default function TiempoReal() {
  const [connected, setConnected]     = useState(false);
  const [txs, setTxs]                 = useState([]);
  const [session, setSession]         = useState({ count: 0, volumen: 0, comision: 0 });
  const [rateHistory, setRateHistory] = useState([]);
  const tableRef                      = useRef(null);
  const echartRef                     = useRef(null);

  /* ── Historial inicial ─────────────────────────────────────────────────────── */
  useEffect(() => {
    getUltimas(50)
      .then(hist => setTxs([...hist].reverse()))
      .catch(() => {});
  }, []);

  /* ── Socket.IO ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('nueva-transaccion', (tx) => {
      setTxs(prev => {
        const next = [...prev, tx];
        return next.length > MAX_LIVE ? next.slice(-MAX_LIVE) : next;
      });

      setSession(prev => ({
        count:    prev.count + 1,
        volumen:  prev.volumen  + (tx.total_salida ?? 0),
        comision: prev.comision + (tx.comision ?? 0),
      }));

      if (tx.comision && tx.tam_virtual) {
        const satVb = +((tx.comision * 1e8) / tx.tam_virtual).toFixed(2);
        const label = tx.fecha
          ? new Date(tx.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '—';
        setRateHistory(prev => {
          const next = [...prev, { label, satVb }];
          return next.length > 60 ? next.slice(1) : next;
        });
      }

      // Auto-scroll
      requestAnimationFrame(() => {
        if (tableRef.current) tableRef.current.scrollTop = 0;
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('nueva-transaccion');
    };
  }, []);

  const sparkOption = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: grid({ bottom: 44, top: 16 }),
    xAxis: xAxisCategory(
      rateHistory.map(d => d.label),
      { axisLabel: { rotate: 30, fontSize: 10, interval: Math.floor(rateHistory.length / 8) } }
    ),
    yAxis: yAxis({ name: 'sat/vb' }),
    series: [lineSeries('sat/vbyte', rateHistory.map(d => d.satVb), COLORS.green)],
  };

  return (
    <div>
      {/* Header with live indicator */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon">
            <Radio size={15} strokeWidth={1.8} />
          </div>
          <div>
            <div className="page-title">Monitor en Tiempo Real</div>
            <div className="page-subtitle">Change Streams → Socket.IO → React. Actualización automática sin recargar.</div>
          </div>
        </div>
        <div className="live-indicator" style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
          <div className={`live-dot ${connected ? 'on' : 'off'}`} />
          {connected
            ? <><Wifi size={12} /> Conectado</>
            : <><WifiOff size={12} /> Sin conexión</>
          }
        </div>
      </div>

      {/* Session KPIs */}
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="card-title">Txs en esta sesión</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>
            {session.count.toLocaleString('es-CO')}
          </div>
          <div className="kpi-label">desde que abriste esta página</div>
        </div>
        <div className="card">
          <div className="card-title">Volumen acumulado</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>
            {fmt(session.volumen, 4)}
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 6 }}>BTC</span>
          </div>
          <div className="kpi-label">suma de outputs</div>
        </div>
        <div className="card">
          <div className="card-title">Comisión acumulada</div>
          <div className="kpi-value" style={{ color: 'var(--yellow)' }}>
            {fmt(session.comision, 8)}
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 6 }}>BTC</span>
          </div>
          <div className="kpi-label">ingresos para mineros</div>
        </div>
      </div>

      {/* sat/vb sparkline */}
      {rateHistory.length > 3 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <span className="card-title">Tasa sat / vbyte en tiempo real</span>
            <span className="badge badge-green">
              último: {rateHistory[rateHistory.length - 1]?.satVb} sat/vb
            </span>
          </div>
          <ReactECharts ref={echartRef} option={sparkOption} style={{ height: 200 }} />
        </div>
      )}

      {/* Live table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Transacciones recientes
            <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontWeight: 400 }}>
              (últimas {txs.length})
            </span>
          </span>
          <span className="badge badge-orange">Change Stream</span>
        </div>

        <div
          ref={tableRef}
          className="table-wrap"
          style={{ maxHeight: 440, overflowY: 'auto' }}
        >
          <table>
            <thead>
              <tr>
                <th>TxID</th>
                <th>Timestamp</th>
                <th>Bloque</th>
                <th>Volumen (BTC)</th>
                <th>Comisión (BTC)</th>
                <th>In / Out</th>
                <th>Tamaño</th>
              </tr>
            </thead>
            <tbody>
              {[...txs].reverse().map((tx, i) => (
                <tr
                  key={i}
                  style={i === 0 ? {
                    background: 'rgba(0, 199, 129, .05)',
                    borderLeft: '2px solid var(--green)',
                  } : {}}
                >
                  <td>
                    <span className="mono" style={{ color: 'var(--accent)' }}>
                      {truncate(tx.txid, 20)}
                    </span>
                  </td>
                  <td className="text-xs mono">{fmtTs(tx.fecha)}</td>
                  <td className="mono">#{fmt(tx.bloque, 0)}</td>
                  <td className="mono font-semibold">{fmt(tx.total_salida, 6)} ₿</td>
                  <td className="mono">{fmt(tx.comision, 8)}</td>
                  <td className="mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {tx.n_inputs} / {tx.n_outputs}
                  </td>
                  <td className="mono text-xs">{fmt(tx.tam_virtual, 0)} vb</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
