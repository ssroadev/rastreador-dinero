const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const informes   = require('./src/routes/informesRoutes');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/informes', informes);

app.use((err, req, res, next) => {
  const timeout = err.code === 50;
  const status  = timeout ? 504 : (err.status || 500);
  const msg = timeout
    ? 'La consulta tardó demasiado. Reduce el rango de fechas e inténtalo de nuevo.'
    : (status === 500 ? 'Error interno' : err.message);
  res.status(status).json({ error: msg });
  if (status === 500) console.error(err);
});


async function iniciarChangeStream() {
  const { abrirChangeStream } = require('./src/repositories/transaccionesRepository');
  let resumeToken = null;

  (async () => {
    for (;;) {
      let stream;
      try {
        stream = await abrirChangeStream(resumeToken);
        console.log('✓ Change Stream activo — emitiendo eventos en tiempo real');

        for await (const cambio of stream) {
          resumeToken = cambio._id ?? resumeToken;
          const doc = cambio.fullDocument || cambio.documentKey;
          if (doc) {
            io.emit('nueva-transaccion', {
              txid:          doc.txid,
              fecha:         doc.fecha,
              bloque:        doc.bloque,
              total_salida:  doc.total_salida,
              comision:      doc.comision,
              n_inputs:      doc.n_inputs,
              n_outputs:     doc.n_outputs,
              tam_virtual:   doc.tam_virtual,
            });
          }
        }
      } catch (err) {
        try { await stream?.close(); } catch {}

        // Resume token obsoleto: reiniciar desde ahora
        if (/resume of change stream was not possible/i.test(err.message || '')) {
          console.warn('⚠ Change Stream: resume token obsoleto, reiniciando desde ahora.');
          resumeToken = null;
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        // Code 50 (MaxTimeMSExpired) es normal — el cursor expira si no hay actividad
        if (err?.code === 50) {
          // Silencioso: reintenta sin log (es esperado en bases de datos sin tráfico nuevo)
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        // Otros errores transitorios: log + backoff
        console.warn(
          `⚠ Change Stream error (code ${err?.code ?? 'n/a'}): ${err.message}. Reintentando en 5s…`
        );
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })().catch(err => {
    console.error('✗ Change Stream fatal:', err.message);
  });

  // Retorna inmediatamente para no bloquear el arranque
  return Promise.resolve();
}

module.exports = { app, server, io, iniciarChangeStream };
