import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Fish, Wifi, WifiOff } from 'lucide-react';
import { getBallenas, getBallenasVivo } from '../services/api';
import { getSocket } from '../services/socket';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoPorDefecto } from '../utils/dates';
import { tooltip, grid, xAxisCategory, yAxis, barSeries, lineSeries, COLORS } from '../charts/chartTheme';

const MAX_LIVE = 100;
const fmt      = (n, d = 4) => Number(n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: d });
const truncate = (s, n = 16) => s ? (s.length > n ? s.slice(0, n) + '…' : s) : '—';
const fmtTs    = (d) => d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Ballenas() {
  const [filtro, setFiltro]     = useState(rangoPorDefecto());
  const [minBtc, setMinBtc]     = useState(10);
  const [historico, setHistorico] = useState([]);
  const [vivos, setVivos]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]      = useState(null);
  const [connected, setConnected] = useState(false);
  const tableRef = useRef(null);

  // ── Cargar histórico ─────────────────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true); setError(null);
    try { setHistorico(await getBallenas(filtro, minBtc)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  // ── Cargar ballenas recientes del mempool ─────────────────────────────────────
  useEffect(() => {
    getBallenasVivo(50, minBtc)
      .then(data => setVivos(data))
      .catch(() => {});
  }, [minBtc]);

  // ── Socket.IO: filtrar ballenas en vivo ────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('nueva-transaccion', (tx) => {
      if ((tx.total_salida ?? 0) < minBtc) return;
      setVivos(prev => {
        const next = [tx, ...prev];
        return next.length > MAX_LIVE ? next.slice(0, MAX_LIVE) : next;
      });
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('nueva-transaccion');
    };
  }, [minBtc]);

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const totalTxs   = historico.reduce((s, d) => s + d.transacciones, 0);
  const totalVol   = historico.reduce((s, d) => s + d.volumenTotal, 0);
  const montoMax   = historico.reduce((m, d) => Math.max(m, d.montoMaximo ?? 0), 0);
  const promedio   = totalTxs ? totalVol / totalTxs : 0;

  const chartOpt = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: { top: 0, right: 8, textStyle: { color: '#7d8fa3', fontSize: 11 } },
    grid: grid({ top: 32 }),
    xAxis: xAxisCategory(historico.map(d => d.dia), { axisLabel: { rotate: 30, fontSize: 10 } }),
    yAxis: [
      yAxis({ name: 'Txs' }),
      yAxis({ name: 'BTC', position: 'right' }),
    ],
    series: [
      barSeries('Ballenas', historico.map(d => d.transacciones), COLORS.orange),
      lineSeries('Volumen BTC', historico.map(d => +d.volumenTotal.toFixed(2)), COLORS.blue, { yAxisIndex: 1 }),
    ],
  };

  return (
    <div>
      <PageHeader
        Icon={Fish}
        title="Ballenas"
        subtitle="Transacciones de alto valor en el mempool. Segundo monitor en tiempo real: filtra ballenas que entran al mempool de Bitcoin."
      />

      {/* Controls */}
      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Mín BTC</label>
          <input
            type="number"
            value={minBtc}
            min="0.001"
            step="0.1"
            onChange={e => setMinBtc(parseFloat(e.target.value) || 10)}
            style={{ width: 80 }}
          />
        </div>
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>Aplicar</button>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {/* KPIs */}
      {!loading && historico.length > 0 && (
        <div className="grid-4" style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="card-title">Total ballenas</div>
            <div className="kpi-value" style={{ color: 'var(--accent)' }}>{totalTxs.toLocaleString('es-CO')}</div>
            <div className="kpi-label">transacciones</div>
          </div>
          <div className="card">
            <div className="card-title">Volumen total</div>
            <div className="kpi-value" style={{ color: 'var(--blue)' }}>{fmt(totalVol)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span></div>
            <div className="kpi-label">acumulado</div>
          </div>
          <div className="card">
            <div className="card-title">Monto promedio</div>
            <div className="kpi-value" style={{ color: 'var(--green)' }}>{fmt(promedio)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span></div>
            <div className="kpi-label">por ballena</div>
          </div>
          <div className="card">
            <div className="card-title">Ballena más grande</div>
            <div className="kpi-value" style={{ color: 'var(--red)' }}>{fmt(montoMax)} <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>BTC</span></div>
            <div className="kpi-label">máximo histórico</div>
          </div>
        </div>
      )}

      {/* Historical chart */}
      {!loading && historico.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <span className="card-title">Ballenas por día</span>
            <span className="badge badge-orange">umbral ≥ {minBtc} BTC</span>
          </div>
          <ReactECharts option={chartOpt} style={{ height: 280 }} />
        </div>
      )}

      {/* Live table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Ballenas en vivo
            <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontWeight: 400 }}>(mempool, últimas {vivos.length})</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: connected ? 'var(--green)' : 'var(--red)' }}>
            <div className={`live-dot ${connected ? 'on' : 'off'}`} />
            {connected ? <><Wifi size={12} /> Live</> : <><WifiOff size={12} /> Offline</>}
          </div>
        </div>
        <div ref={tableRef} className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>TxID</th>
                <th>Timestamp</th>
                <th>Volumen (BTC)</th>
                <th>Comisión (BTC)</th>
                <th>In / Out</th>
                <th>sat / vb</th>
              </tr>
            </thead>
            <tbody>
              {vivos.map((tx, i) => {
                const satVb = tx.tam_virtual ? +((tx.comision * 1e8) / tx.tam_virtual).toFixed(2) : 0;
                return (
                  <tr key={i} style={i === 0 ? { background: 'rgba(247,147,26,.05)', borderLeft: '2px solid var(--accent)' } : {}}>
                    <td><span className="mono" style={{ color: 'var(--accent)' }}>{truncate(tx.txid, 18)}</span></td>
                    <td className="text-xs mono">{fmtTs(tx.fecha)}</td>
                    <td className="mono font-semibold" style={{ color: 'var(--orange)' }}>{fmt(tx.total_salida, 4)} ₿</td>
                    <td className="mono">{fmt(tx.comision, 8)}</td>
                    <td className="mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{tx.n_inputs} / {tx.n_outputs}</td>
                    <td><span className={`badge ${satVb > 50 ? 'badge-red' : satVb > 20 ? 'badge-orange' : 'badge-neutral'}`}>{satVb}</span></td>
                  </tr>
                );
              })}
              {vivos.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>
                  Sin ballenas en el mempool. Esperando transacciones ≥ {minBtc} BTC...
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
