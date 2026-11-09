const service = require('../services/informesService');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fecha(v, nombre) {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d)) {
    const e = new Error(`Parámetro '${nombre}' inválido (use AAAA-MM-DD)`);
    e.status = 400;
    throw e;
  }
  return d;
}

function rango(req) {
  const desde = fecha(req.query.desde, 'desde');
  const hasta = fecha(req.query.hasta, 'hasta');
  if (desde && hasta && desde >= hasta) {
    const e = new Error("'desde' debe ser anterior a 'hasta'");
    e.status = 400;
    throw e;
  }
  return { desde, hasta };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
const indicadores  = async (req, res, next) => {
  try { res.json(await service.indicadores(rango(req)));  } catch (e) { next(e); }
};

const evolucion    = async (req, res, next) => {
  try { res.json(await service.evolucion(rango(req)));    } catch (e) { next(e); }
};

const comisiones   = async (req, res, next) => {
  try { res.json(await service.comisiones(rango(req)));   } catch (e) { next(e); }
};

const topBloques   = async (req, res, next) => {
  try { res.json(await service.topBloques(rango(req)));   } catch (e) { next(e); }
};

const distribucion = async (req, res, next) => {
  try { res.json(await service.distribucion(rango(req))); } catch (e) { next(e); }
};

const atipicas     = async (req, res, next) => {
  try { res.json(await service.atipicas(rango(req)));     } catch (e) { next(e); }
};

const mensual      = async (req, res, next) => {
  try { res.json(await service.mensual(rango(req)));      } catch (e) { next(e); }
};

const ultimas      = async (req, res, next) => {
  try {
    const limite = parseInt(req.query.limite) || 20;
    if (limite < 1 || limite > 200) {
      const e = new Error("'limite' debe estar entre 1 y 200");
      e.status = 400;
      throw e;
    }
    res.json(await service.ultimas({ limite }));
  } catch (e) { next(e); }
};

// ─── Lenguaje Natural ─────────────────────────────────────────────────────────
// El frontend manda { pregunta } — el backend llama a la IA para generar el pipeline
const consultaNL   = async (req, res, next) => {
  try {
    const { pregunta, pipeline } = req.body;

    // Si el cliente ya manda el pipeline generado (modo debug) lo ejecutamos directo
    if (pipeline) {
      if (!Array.isArray(pipeline)) {
        const e = new Error("'pipeline' debe ser un array"); e.status = 400; throw e;
      }
      const resultado = await service.ejecutarNL(pipeline);
      return res.json({ pipeline, resultado });
    }

    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length < 3) {
      const e = new Error("Se requiere 'pregunta' como texto"); e.status = 400; throw e;
    }

    // Genera pipeline con OpenAI (o similar) a través de un helper
    const { generarPipeline } = require('../services/nlService');
    const pipelineGenerado = await generarPipeline(pregunta.trim());
    const resultado = await service.ejecutarNL(pipelineGenerado);
    res.json({ pregunta: pregunta.trim(), pipeline: pipelineGenerado, resultado });
  } catch (e) { next(e); }
};

module.exports = {
  indicadores, evolucion, comisiones,
  topBloques, distribucion, atipicas,
  mensual, ultimas, consultaNL,
};
