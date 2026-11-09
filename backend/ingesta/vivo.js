/**
 * Ingesta en vivo desde blockchain.com WebSocket → MongoDB (mempool_vivo)
 *
 * Uso:  node ingesta/vivo.js
 *
 * Escucha transacciones no confirmadas del mempool de Bitcoin en tiempo real,
 * las transforma al esquema del proyecto y las inserta en la colección capped
 * "mempool_vivo".  El Change Stream del backend vigila esa colección y emite
 * eventos Socket.IO al frontend.
 *
 * La colección es capped (~50K docs): los documentos más antiguos se
 * sobrescriben automáticamente cuando se llena.
 */

require('dotenv').config();
const { conectar, asegurarMempoolVivo } = require('../src/config/db');

const WS_URL = 'wss://ws.blockchain.info/inv';
const SATOSHIS_POR_BTC = 100_000_000;

let ws = null;
let db = null;
let conteo = 0;
let conteoBloque = 0;
let ultimoLog = Date.now();

// ─── Transforma el mensaje de blockchain.com al esquema del proyecto ──────────
function transformarTx(x) {
  const inputs  = x.inputs || [];
  const outputs = x.out || [];

  const totalEntradaSats = inputs.reduce((s, i) => s + (i.prev_out?.value || 0), 0);
  const totalSalidaSats   = outputs.reduce((s, o) => s + (o.value || 0), 0);
  const esCoinbase = !!(inputs[0]?.coinbase);

  return {
    txid:         x.hash,
    fecha:        new Date((x.time || 0) * 1000),
    bloque:       null,                 // sin confirmar
    tam_virtual:  x.size || 0,
    es_coinbase:  esCoinbase,
    n_inputs:     inputs.length,
    n_outputs:    outputs.length,
    comision:     esCoinbase
      ? 0
      : Math.max(0, totalEntradaSats - totalSalidaSats) / SATOSHIS_POR_BTC,
    total_entrada: totalEntradaSats / SATOSHIS_POR_BTC,
    total_salida:  totalSalidaSats / SATOSHIS_POR_BTC,
  };
}

// ─── Conexión WebSocket ──────────────────────────────────────────────────────
function conectarWS() {
  console.log(`Conectando a ${WS_URL} ...`);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('✓ WebSocket conectado. Suscribiendo a transacciones no confirmadas...');
    ws.send(JSON.stringify({ op: 'unconfirmed_sub' }));
  };

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return; // mensaje no-JSON, ignorar
    }

    if (msg.op !== 'utx' || !msg.x) return;

    const doc = transformarTx(msg.x);
    if (!doc.txid || doc.tam_virtual === 0) return;

    try {
      // insertOne en la colección capped — si está llena, sobrescribe el más antiguo
      await db.collection('mempool_vivo').insertOne(doc);
      conteo++;
      conteoBloque++;

      // Log de estadísticas cada ~5 segundos
      const ahora = Date.now();
      if (ahora - ultimoLog >= 5000) {
        const txsPorSeg = (conteoBloque / ((ahora - ultimoLog) / 1000)).toFixed(1);
        console.log(`📊 ${conteo.toLocaleString('es-CO')} txs totales · ${txsPorSeg} txs/s`);
        conteoBloque = 0;
        ultimoLog = ahora;
      }
    } catch (err) {
      // E11000 duplicate key — txid repetido, ignorar silenciosamente
      if (err.code !== 11000) {
        console.error('Insert error:', err.message);
      }
    }
  };

  ws.onerror = (event) => {
    console.error('✗ WebSocket error:', event.message || event);
  };

  ws.onclose = (event) => {
    console.warn(`⚠ WebSocket cerrado (code ${event.code}). Reconectando en 3s...`);
    setTimeout(conectarWS, 3000);
  };
}

// ─── Arranque ────────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Ingesta en vivo · blockchain.com → mempool_vivo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Asegura que la colección capped existe
  await asegurarMempoolVivo();

  // Conecta a la base de datos
  db = await conectar();

  console.log('✓ MongoDB conectado\n');

  // Inicia el WebSocket
  conectarWS();

  // Cierre limpio
  const cerrar = () => {
    console.log('\n\nDeteniendo ingesta...');
    if (ws) ws.close();
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch(err => {
  console.error('✗ Error fatal:', err.message);
  process.exit(1);
});
