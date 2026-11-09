const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const informes   = require('./src/routes/informesRoutes');

// ─── Express ──────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/informes', informes);

// ─── Manejo de errores ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Error interno' : err.message });
  if (status === 500) console.error(err);
});

// ─── Change Stream → Socket.IO ────────────────────────────────────────────────
async function iniciarChangeStream() {
  try {
    const { abrirChangeStream } = require('./src/repositories/transaccionesRepository');
    const stream = await abrirChangeStream();
    console.log('Change Stream activo — emitiendo eventos en tiempo real');

    stream.on('change', (cambio) => {
      const doc = cambio.fullDocument || cambio.documentKey;
      if (doc) {
        io.emit('nueva-transaccion', {
          txid:          doc.txid,
          fecha:         doc.fecha,
          bloque_height: doc.bloque_height,
          total_salida:  doc.total_salida,
          comision:      doc.comision,
          n_inputs:      doc.n_inputs,
          n_outputs:     doc.n_outputs,
          tam_virtual:   doc.tam_virtual,
        });
      }
    });

    stream.on('error', (err) => {
      console.error('Change Stream error:', err.message);
    });
  } catch (err) {
    // Change Streams requieren replica set; si falla, el resto de la app sigue
    console.warn(
      'Change Stream no disponible (¿replica set configurado?):', err.message
    );
  }
}

module.exports = { app, server, io, iniciarChangeStream };
