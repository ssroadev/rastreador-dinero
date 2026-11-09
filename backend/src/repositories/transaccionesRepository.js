const { conectar } = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const opts = { maxTimeMS: 90000, allowDiskUse: true };

// Filtro sobre la colección grande `transacciones` (usa idx_coinbase_fecha).
// Sin rango → últimos 30 días.
function matchFecha({ desde, hasta }) {
  const m = { es_coinbase: false };
  if (desde || hasta) {
    m.fecha = {};
    if (desde) m.fecha.$gte = desde;
    if (hasta) m.fecha.$lt  = hasta;
  } else {
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    m.fecha = { $gte: hace30 };
  }
  return m;
}

// Filtro sobre las vistas pre-agregadas (vw_*). Sin rango → todo (son diminutas).
function filtroVw({ desde, hasta }) {
  const f = {};
  if (desde || hasta) {
    f.fecha = {};
    if (desde) f.fecha.$gte = desde;
    if (hasta) f.fecha.$lt  = hasta;
  }
  return f;
}

// ─── Informe 1 · Indicadores Generales ────────────────────────────────────────
async function indicadoresGenerales(rango) {
  const db = await conectar();
  const [r] = await db.collection('vw_diarias').aggregate([
    { $match: filtroVw(rango) },
    { $group: {
        _id: null,
        transacciones:    { $sum: '$tx' },
        volumenBTC:       { $sum: '$volumen' },
        comisionTotalBTC: { $sum: '$comision' },
        tam:              { $sum: '$tam' },
        primera:          { $min: '$fecha' },
        ultima:           { $max: '$fecha' },
    } },
    { $project: {
        _id: 0, transacciones: 1, volumenBTC: 1, comisionTotalBTC: 1, primera: 1, ultima: 1,
        comisionPromedioBTC: { $divide: ['$comisionTotalBTC', '$transacciones'] },
        tamVirtualPromedio:  { $divide: ['$tam', '$transacciones'] },
    } },
  ]).toArray();
  return r || {};
}

// ─── Informe 2 · Evolución Diaria ─────────────────────────────────────────────
async function evolucionDiaria(rango) {
  const db = await conectar();
  return db.collection('vw_diarias').aggregate([
    { $match: filtroVw(rango) },
    { $sort: { fecha: 1 } },
    { $project: {
        _id: 0, dia: '$_id', transacciones: '$tx',
        comisionPromedioBTC: { $divide: ['$comision', '$tx'] },
        tamVirtualPromedio:  { $divide: ['$tam', '$tx'] },
        salidasPromedio:     { $divide: ['$salidas', '$tx'] },
    } },
  ]).toArray();
}

// ─── Informe 3 · Mapa de calor: comisiones por día de semana y hora (Bogotá) ──
async function comisionesPorHora(rango) {
  const db = await conectar();
  const tz = 'America/Bogota';
  return db.collection('vw_horas').aggregate([
    { $match: filtroVw(rango) },
    { $group: {
        _id: { dia:  { $dayOfWeek: { date: '$fecha', timezone: tz } },
               hora: { $hour:      { date: '$fecha', timezone: tz } } },
        tx:      { $sum: '$tx' },
        sumTasa: { $sum: '$sumTasa' },
    } },
    { $project: {
        _id: 0, dia: '$_id.dia', hora: '$_id.hora', transacciones: '$tx',
        tasaPromedioSatVb: { $round: [{ $divide: ['$sumTasa', '$tx'] }, 2] },
    } },
    { $sort: { dia: 1, hora: 1 } },
  ]).toArray();
}

// ─── Comparación mensual (los nombres de campo son los que usa Mensual.jsx) ───
async function resumenMensual(rango) {
  const db = await conectar();
  return db.collection('vw_diarias').aggregate([
    { $match: filtroVw(rango) },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$fecha' } },
        transacciones: { $sum: '$tx' },
        volumenBTC:    { $sum: '$volumen' },
        comisionTotal: { $sum: '$comision' },
        tam:           { $sum: '$tam' },
    } },
    { $sort: { _id: 1 } },
    { $project: {
        _id: 0, mes: '$_id', transacciones: 1, volumenBTC: 1, comisionTotal: 1,
        comisionPromedio: { $divide: ['$comisionTotal', '$transacciones'] },
        tamPromedio:      { $divide: ['$tam', '$transacciones'] },
    } },
  ]).toArray();
}

// ─── Top bloques por comisión (campos de TopBloques.jsx) ──────────────────────
async function topBloquesPorComisiones(rango) {
  const db = await conectar();
  return db.collection('vw_bloques').aggregate([
    { $match: filtroVw(rango) },
    { $sort: { comision: -1 } },
    { $limit: 50 },
    { $project: {
        _id: 0, bloque: '$_id', fecha: 1, txs: '$tx',
        comisionTotal: '$comision', volumenBTC: '$volumen', tamVirtualTotal: '$tam',
        satVbPromedio: { $round: [{ $divide: [{ $multiply: ['$comision', 1e8] }, '$tam'] }, 2] },
    } },
  ]).toArray();
}

// ─── Distribución de salidas por transacción (campos de Distribucion.jsx) ─────
async function distribucionSalidas(rango) {
  const db = await conectar();
  return db.collection('vw_salidas').aggregate([
    { $match: filtroVw(rango) },
    { $group: {
        _id: '$rango', orden: { $first: '$orden' },
        count: { $sum: '$tx' }, comision: { $sum: '$comision' }, volumen: { $sum: '$volumen' },
    } },
    { $sort: { orden: 1 } },
    { $project: {
        _id: 0, rango: '$_id', count: 1,
        comisionPromedio: { $divide: ['$comision', '$count'] },
        volumenPromedio:  { $divide: ['$volumen', '$count'] },
    } },
  ]).toArray();
}

// ═════════════════════════════════════════════════════════════════════════════
//  INFORMES SOBRE `transacciones` (ventana corta + índices parciales)
// ═════════════════════════════════════════════════════════════════════════════

// ─── Ballenas · histórico diario ──────────────────────────────────────────────
// Usa el índice parcial idx_ballenas_fecha ({fecha:1}, total_salida >= 1).
// Sin hint: el planificador elige solo el índice parcial (verifícalo con explain).
async function ballenasHistoricas(rango, minBtc = 10) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: { ...matchFecha(rango), total_salida: { $gte: Number(minBtc) } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
        transacciones: { $sum: 1 },
        volumenTotal:  { $sum: '$total_salida' },
        montoPromedio: { $avg: '$total_salida' },
        montoMaximo:   { $max: '$total_salida' },
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, dia: '$_id', transacciones: 1, volumenTotal: 1, montoPromedio: 1, montoMaximo: 1 } },
  ], opts).toArray();
}

// Ballenas · recientes (mempool vivo)
async function ballenasRecientes(limite = 50, minBtc = 10) {
  const db = await conectar();
  return db.collection('mempool_vivo').aggregate([
    { $match: { total_salida: { $gte: Number(minBtc) } } },
    { $sort: { fecha: -1 } },
    { $limit: Number(limite) },
    { $project: { _id: 0, txid: 1, fecha: 1, bloque: 1, total_salida: 1, comision: 1,
                  n_inputs: 1, n_outputs: 1, tam_virtual: 1 } },
  ], opts).toArray();
}

// ─── Fragmentación (pocas entradas, muchas salidas casi iguales) ──────────────
// Usa idx_fragmentacion_fecha ({fecha:1}, n_outputs >= 10).
// Sin $unwind/$group: $avg y $stdDevPop operan directamente sobre el arreglo.
async function fragmentacion(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: { ...matchFecha(rango), n_inputs: { $lte: 2 }, n_outputs: { $gte: 10 } } },
    { $addFields: {
        valorMedio:  { $avg:       '$outputs.valor' },
        valorStdDev: { $stdDevPop: '$outputs.valor' },
    } },
    { $addFields: {
        coefVariacion: { $cond: [{ $gt: ['$valorMedio', 0] }, { $divide: ['$valorStdDev', '$valorMedio'] }, 1] },
    } },
    { $match: { coefVariacion: { $lt: 0.15 } } },
    { $sort: { n_outputs: -1, total_salida: -1 } },
    { $limit: 100 },
    { $project: {
        _id: 0, txid: 1, fecha: 1, bloque: 1, n_inputs: 1, n_outputs: 1, total_salida: 1, comision: 1,
        valorMedio:    { $round: ['$valorMedio', 8] },
        coefVariacion: { $round: ['$coefVariacion', 4] },
    } },
  ], opts).toArray();
}

// ─── Concentración por dirección ──────────────────────────────────────────────
// Dos pasadas (el controlador limita la ventana a 2 días):
//   1) cuántas direcciones distintas hay y cuánto volumen total
//   2) top 500 + suma exacta del 1 % y del 10 % de las direcciones (por volumen recibido)
async function concentracionDireccion(rango) {
  const db  = await conectar();
  const col = db.collection('transacciones');
  const porDireccion = [
    { $match: matchFecha(rango) },
    { $unwind: '$outputs' },
    { $match: { 'outputs.dir': { $ne: null } } },          // excluye OP_RETURN
    { $group: { _id: '$outputs.dir', total: { $sum: '$outputs.valor' }, nTx: { $sum: 1 } } },
  ];

  const [t] = await col.aggregate([
    ...porDireccion,
    { $group: { _id: null, totalDirecciones: { $sum: 1 }, volumenTotal: { $sum: '$total' } } },
  ], opts).toArray();
  if (!t) return { totalDirecciones: 0, volumenTotal: 0, pctTop1: 0, pctTop10: 0, top: [] };

  const n1  = Math.max(1, Math.ceil(t.totalDirecciones * 0.01));
  const n10 = Math.max(1, Math.ceil(t.totalDirecciones * 0.10));

  const [f] = await col.aggregate([
    ...porDireccion,
    { $facet: {
        top: [
          { $sort: { total: -1 } }, { $limit: 500 },
          { $project: { _id: 0, dir: '$_id', totalRecibido: '$total', nTx: 1 } },
        ],
        top1:  [{ $sort: { total: -1 } }, { $limit: n1  }, { $group: { _id: null, suma: { $sum: '$total' } } }],
        top10: [{ $sort: { total: -1 } }, { $limit: n10 }, { $group: { _id: null, suma: { $sum: '$total' } } }],
    } },
  ], opts).toArray();

  const top = f?.top || [];
  let acumulado = 0;
  top.forEach(d => {
    acumulado += d.totalRecibido;
    d.pctVolumen   = +((d.totalRecibido / t.volumenTotal) * 100).toFixed(4);
    d.pctAcumulado = +((acumulado / t.volumenTotal) * 100).toFixed(2);
  });
  const pct = (x) => +(((x?.[0]?.suma || 0) / t.volumenTotal) * 100).toFixed(2);

  return {
    totalDirecciones: t.totalDirecciones,
    volumenTotal:     t.volumenTotal,
    pctTop1:  pct(f?.top1),
    pctTop10: pct(f?.top10),
    top,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  Lenguaje natural: validación del pipeline generado por la IA
// ═════════════════════════════════════════════════════════════════════════════
const ETAPAS_PERMITIDAS = new Set([
  '$match', '$group', '$sort', '$limit', '$project', '$unwind', '$bucket', '$count',
]);
const OPERADORES_PELIGROSOS = new Set([
  '$function', '$accumulator', '$where', '$merge', '$out',
  '$lookup', '$graphLookup', '$unionWith',
]);
const OPS_COMPARACION = new Set(['$gte', '$gt', '$lt', '$lte', '$eq', '$ne']);
const LIMIT_MAX_NL = 1000;
const VENTANA_NL_DIAS = 7;                       // ventana por defecto si la IA no acota fecha
const optsNL = { maxTimeMS: 20000, allowDiskUse: true };

function bad(msg, status = 400) { const e = new Error(msg); e.status = status; return e; }

function contieneOperadorPeligroso(valor) {
  if (valor === null || typeof valor !== 'object') return false;
  if (Array.isArray(valor)) return valor.some(contieneOperadorPeligroso);
  for (const [clave, v] of Object.entries(valor)) {
    if (OPERADORES_PELIGROSOS.has(clave)) return true;
    if (contieneOperadorPeligroso(v)) return true;
  }
  return false;
}

function convertirFechas(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) { obj.forEach(convertirFechas); return obj; }
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'fecha') {
      if (typeof v === 'string') obj[k] = new Date(v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [op, val] of Object.entries(v))
          if (OPS_COMPARACION.has(op) && typeof val === 'string') v[op] = new Date(val);
      }
    } else convertirFechas(v);
  }
  return obj;
}

// El ÚLTIMO stage siempre es $limit ≤ LIMIT_MAX_NL (también se acotan los intermedios).
function forzarLimit(pipeline) {
  for (const etapa of pipeline)
    if (typeof etapa.$limit === 'number' && etapa.$limit > LIMIT_MAX_NL) etapa.$limit = LIMIT_MAX_NL;
  const ult = pipeline[pipeline.length - 1];
  if (typeof ult.$limit !== 'number') pipeline.push({ $limit: LIMIT_MAX_NL });
  return pipeline;
}

// Si el primer $match no acota `fecha`, se antepone una ventana (evita escanear toda la colección).
function asegurarVentana(pipeline) {
  const primero = pipeline[0]?.$match;
  const acota = primero && JSON.stringify(primero).includes('"fecha"');
  if (!acota) {
    const desde = new Date(Date.now() - VENTANA_NL_DIAS * 864e5);
    pipeline.unshift({ $match: { fecha: { $gte: desde } } });
  }
  return pipeline;
}

async function ejecutarPipelineNL(pipeline) {
  if (!Array.isArray(pipeline) || pipeline.length === 0) throw bad('El pipeline debe ser un array no vacío');
  if (pipeline.length > 10) throw bad('Pipeline demasiado largo (máx. 10 etapas)');

  for (const etapa of pipeline) {
    if (!etapa || typeof etapa !== 'object' || Array.isArray(etapa)) throw bad('Cada etapa debe ser un objeto');
    const claves = Object.keys(etapa);
    if (claves.length !== 1 || !claves[0].startsWith('$')) throw bad('Etapa inválida: debe tener una sola clave con prefijo $');
    if (!ETAPAS_PERMITIDAS.has(claves[0])) throw bad(`Etapa no permitida: ${claves[0]}`);
  }
  if (contieneOperadorPeligroso(pipeline)) throw bad('Pipeline rechazado: contiene operadores no permitidos', 403);

  for (const etapa of pipeline) if (etapa.$match) convertirFechas(etapa.$match);
  asegurarVentana(pipeline);
  forzarLimit(pipeline);

  const { conectarLectura } = require('../config/db');
  const db = await conectarLectura();
  return db.collection('transacciones').aggregate(pipeline, optsNL).toArray();
}

// ─── Informe 10 · Últimas transacciones (mempool vivo) ────────────────────────
async function ultimasTransacciones({ limite = 20 } = {}) {
  const db = await conectar();
  return db.collection('mempool_vivo').aggregate([
    { $sort: { fecha: -1 } },
    { $limit: Number(limite) },
    { $project: { _id: 0, txid: 1, fecha: 1, bloque: 1, total_salida: 1, comision: 1,
                  n_inputs: 1, n_outputs: 1, tam_virtual: 1 } },
  ], opts).toArray();
}

// ─── Change Stream sobre la colección capped mempool_vivo ─────────────────────
async function abrirChangeStream(resumeAfter) {
  const db = await conectar();
  const options = {};
  if (resumeAfter) options.resumeAfter = resumeAfter;
  return db.collection('mempool_vivo').watch(
    [{ $match: { operationType: 'insert' } }],
    options
  );
}

module.exports = {
  indicadoresGenerales, evolucionDiaria, comisionesPorHora,
  resumenMensual, topBloquesPorComisiones, distribucionSalidas,
  ballenasHistoricas, ballenasRecientes, fragmentacion, concentracionDireccion,
  ejecutarPipelineNL, ultimasTransacciones, abrirChangeStream,
};
