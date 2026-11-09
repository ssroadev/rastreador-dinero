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

// Para informes que leen la colección grande: exige desde/hasta y limita los días.
function rangoMax(req, maxDias) {
  const r = rango(req);
  if (!r.desde || !r.hasta) {
    const e = new Error("Indica 'desde' y 'hasta' para este informe"); e.status = 400; throw e;
  }
  const dias = (r.hasta - r.desde) / 864e5;
  if (dias > maxDias) {
    const e = new Error(`Este informe admite como máximo ${maxDias} día(s) de rango`); e.status = 400; throw e;
  }
  return r;
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

const ballenas     = async (req, res, next) => {
  try {
    const minBtc = parseFloat(req.query.minBtc) || 10;
    if (minBtc < 1) {
      const e = new Error("'minBtc' debe ser al menos 1 (índice parcial de ballenas)"); e.status = 400; throw e;
    }
    res.json(await service.ballenas(rangoMax(req, 31), minBtc));
  } catch (e) { next(e); }
};

const ballenasVivo = async (req, res, next) => {
  try {
    const limite = parseInt(req.query.limite) || 50;
    const minBtc = parseFloat(req.query.minBtc) || 10;
    if (limite < 1 || limite > 200) {
      const e = new Error("'limite' debe estar entre 1 y 200"); e.status = 400; throw e;
    }
    res.json(await service.ballenasVivo(limite, minBtc));
  } catch (e) { next(e); }
};

const fragmentacion = async (req, res, next) => {
  try { res.json(await service.fragmentacion(rangoMax(req, 7))); } catch (e) { next(e); }
};

const concentracion = async (req, res, next) => {
  try { res.json(await service.concentracion(rangoMax(req, 2))); } catch (e) { next(e); }
};

const distribucion = async (req, res, next) => {
  try { res.json(await service.distribucion(rango(req))); } catch (e) { next(e); }
};

const mensual = async (req, res, next) => {
  try { res.json(await service.mensual(rango(req))); } catch (e) { next(e); }
};

const topBloques = async (req, res, next) => {
  try { res.json(await service.topBloques(rango(req))); } catch (e) { next(e); }
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
// El frontend manda { pregunta } — el backend llama a la IA para generar el
// pipeline y lo valida antes de ejecutarlo. No se acepta pipeline del cliente.
const consultaNL   = async (req, res, next) => {
  try {
    const { pregunta } = req.body;

    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length < 3) {
      const e = new Error("Se requiere 'pregunta' como texto"); e.status = 400; throw e;
    }

    // Genera pipeline con OpenAI a través del servicio de NL
    const { generarPipeline } = require('../services/nlService');
    const pipelineGenerado = await generarPipeline(pregunta.trim());

    // El repositorio valida, sanitiza y ejecuta el pipeline
    const resultado = await service.ejecutarNL(pipelineGenerado);
    res.json({ pregunta: pregunta.trim(), pipeline: pipelineGenerado, resultado });
  } catch (e) { next(e); }
};

module.exports = {
  indicadores, evolucion, comisiones,
  ballenas, ballenasVivo, fragmentacion,
  concentracion, distribucion,
  mensual, topBloques, ultimas, consultaNL,
};
