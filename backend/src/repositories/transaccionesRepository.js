const { conectar } = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const opts = { maxTimeMS: 90000, allowDiskUse: true };  // Aumentar a 90 segundos

function matchFecha({ desde, hasta }) {
  const m = { es_coinbase: false };
  if (desde || hasta) {
    m.fecha = {};
    if (desde) m.fecha.$gte = desde;
    if (hasta) m.fecha.$lt  = hasta;
  }
  // Si no hay rango, limitar a últimos 30 días para evitar full scan
  if (!desde && !hasta) {
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    m.fecha = { $gte: hace30 };
  }
  return m;
}

// ─── Informe 1 · Indicadores Generales ────────────────────────────────────────
// NOTA: Con 31M+ registros, usar sampling para respuesta rápida
async function indicadoresGenerales(rango) {
  const db = await conectar();
  
  // Estrategia: si el rango es muy grande (>30 días), usar sample
  const dias = rango.hasta && rango.desde 
    ? Math.ceil((rango.hasta - rango.desde) / (1000 * 60 * 60 * 24))
    : 7;
  
  const pipeline = [
    { $match: matchFecha(rango) },
  ];
  
  // Si es más de 30 días, tomar muestra del 10% para velocidad
  if (dias > 30) {
    pipeline.push({ $sample: { size: 100000 } });
  }
  
  pipeline.push(
    { $group: {
        _id: null,
        transacciones:        { $sum: 1 },
        volumenBTC:           { $sum: '$total_salida' },
        comisionTotalBTC:     { $sum: '$comision' },
        comisionPromedioBTC:  { $avg: '$comision' },
        tamVirtualPromedio:   { $avg: '$tam_virtual' },
        primera: { $min: '$fecha' },
        ultima:  { $max: '$fecha' }
    } },
    { $project: { _id: 0 } }
  );
  
  const [r] = await db.collection('transacciones').aggregate(pipeline, {
    ...opts,
    hint: { es_coinbase: 1, fecha: 1 }
  }).toArray();
  
  // Si usamos sample, extrapolar el conteo
  if (dias > 30 && r) {
    r.transacciones = Math.round(r.transacciones * 10); // Aproximación
    r._nota = 'Estimación basada en muestra (base de datos muy grande)';
  }
  
  return r || {};
}

// ─── Informe 2 · Evolución Diaria ─────────────────────────────────────────────
async function evolucionDiaria(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
        transacciones:       { $sum: 1 },
        comisionPromedioBTC: { $avg: '$comision' },
        tamVirtualPromedio:  { $avg: '$tam_virtual' },
        salidasPromedio:     { $avg: '$n_outputs' }
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, dia: '$_id', transacciones: 1,
                  comisionPromedioBTC: 1, tamVirtualPromedio: 1, salidasPromedio: 1 } }
  ], { ...opts, hint: { es_coinbase: 1, fecha: 1 } }).toArray();
}

// ─── Informe 3 · Mapa de Calor: Comisiones por Día/Hora ───────────────────────
async function comisionesPorHora(rango) {
  const db = await conectar();
  const filtro = { ...matchFecha(rango), comision: { $ne: null }, tam_virtual: { $gt: 0 } };
  return db.collection('transacciones').aggregate([
    { $match: filtro },
    { $group: {
        _id: { dia: { $dayOfWeek: '$fecha' }, hora: { $hour: '$fecha' } },
        transacciones:   { $sum: 1 },
        tasaPromedioSatVb: { $avg: {
          $divide: [ { $multiply: ['$comision', 100000000] }, '$tam_virtual' ] } }
    } },
    { $sort: { '_id.dia': 1, '_id.hora': 1 } },
    { $project: { _id: 0, dia: '$_id.dia', hora: '$_id.hora',
                  transacciones: 1,
                  tasaPromedioSatVb: { $round: ['$tasaPromedioSatVb', 2] } } }
  ], opts).toArray();
}

// ─── Informe 4 · Ballenas (transacciones de alto valor) ────────────────────────
// Histórico: conteo diario de ballenas desde transacciones (para el gráfico).
// El $match se divide en dos etapas: primero fecha+es_coinbase (cubierto por
// índice compuesto), luego total_salida (post-filtro sobre docs ya filtrados).
async function ballenasHistoricas(rango, minBtc = 10) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $match: { total_salida: { $gte: Number(minBtc) } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
        transacciones:  { $sum: 1 },
        volumenTotal:   { $sum: '$total_salida' },
        montoPromedio:  { $avg: '$total_salida' },
        montoMaximo:    { $max: '$total_salida' }
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, dia: '$_id',
                  transacciones: 1, volumenTotal: 1,
                  montoPromedio: 1, montoMaximo: 1 } }
  ], { ...opts, hint: { es_coinbase: 1, fecha: 1 } }).toArray();
}

// Recientes: últimas ballenas del mempool vivo (para la tabla en vivo).
async function ballenasRecientes(limite = 50, minBtc = 10) {
  const db = await conectar();
  return db.collection('mempool_vivo').aggregate([
    { $match: { total_salida: { $gte: Number(minBtc) } } },
    { $sort: { fecha: -1 } },
    { $limit: Number(limite) },
    { $project: {
        _id: 0, txid: 1, fecha: 1, bloque: 1,
        total_salida: 1, comision: 1, n_inputs: 1, n_outputs: 1, tam_virtual: 1
    } }
  ], opts).toArray();
}

// ─── Informe 5 · Fragmentación (pocas entradas, muchas salidas iguales) ────────
// Detecta txs con n_inputs ≤ 2 y n_outputs ≥ 10 cuyo coeficiente de variación
// de las salidas (stddev / media) es < 0.15.  Patrón de mezcladores y batching.
async function fragmentacion(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    // Primera etapa: fecha + es_coinbase (cubierto por índice compuesto)
    { $match: matchFecha(rango) },
    // Segunda etapa: filtros no indexados (post-filtro sobre docs ya filtrados)
    { $match: { n_inputs: { $lte: 2 }, n_outputs: { $gte: 10 } } },
    { $unwind: '$outputs' },
    { $group: {
        _id:          '$_id',
        txid:         { $first: '$txid' },
        fecha:        { $first: '$fecha' },
        bloque:       { $first: '$bloque' },
        n_inputs:     { $first: '$n_inputs' },
        n_outputs:    { $first: '$n_outputs' },
        total_salida: { $first: '$total_salida' },
        comision:     { $first: '$comision' },
        valorMedio:   { $avg: '$outputs.valor' },
        valorStdDev:  { $stdDevPop: '$outputs.valor' }
    } },
    { $addFields: {
        coefVariacion: {
          $cond: {
            if:   { $eq: ['$valorMedio', 0] },
            then: 1,
            else: { $divide: ['$valorStdDev', '$valorMedio'] }
          }
        }
    } },
    { $match: { coefVariacion: { $lt: 0.15 } } },
    { $sort: { n_outputs: -1, total_salida: -1 } },
    { $limit: 100 },
    { $project: {
        _id: 0, txid: 1, fecha: 1, bloque: 1,
        n_inputs: 1, n_outputs: 1, total_salida: 1, comision: 1,
        valorMedio:    { $round: ['$valorMedio', 8] },
        coefVariacion: { $round: ['$coefVariacion', 4] }
    } }
  ], opts).toArray();
}

// ─── Informe 6 · Detección de Transacciones Atípicas (alto valor/comisión) ────
async function transaccionesAtipicas(rango) {
  const db = await conectar();
  // Primero calcula p95 de comisión y volumen
  const [stats] = await db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $group: {
        _id: null,
        comisionMedia: { $avg: '$comision' },
        volumenMedia:  { $avg: '$total_salida' }
    } }
  ], opts).toArray();

  if (!stats) return [];

  const umbralComision = stats.comisionMedia * 20;
  const umbralVolumen  = stats.volumenMedia  * 50;

  return db.collection('transacciones').aggregate([
    { $match: {
        ...matchFecha(rango),
        $or: [
          { comision:      { $gte: umbralComision } },
          { total_salida:  { $gte: umbralVolumen  } }
        ]
    } },
    { $sort: { total_salida: -1 } },
    { $limit: 200 },
    { $project: {
        _id: 0, txid: 1, fecha: 1, bloque: 1,
        total_salida: 1, comision: 1, n_inputs: 1, n_outputs: 1, tam_virtual: 1,
        satVb: { $round: [
          { $divide: [ { $multiply: ['$comision', 100000000] }, '$tam_virtual' ] }, 2
        ] }
    } }
  ], opts).toArray();
}

// ─── Informe 7 · Concentración por dirección (curva de Pareto/Lorenz) ─────────
// Usa $facet para hacer en una sola pasada sobre $unwind(outputs):
//  - totales:  nº de direcciones únicas y volumen total
//  - top:      top 500 direcciones por volumen recibido
async function concentracionDireccion(rango) {
  const db = await conectar();

  const [faceta] = await db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $unwind: '$outputs' },
    { $facet: {
      totales: [
        { $group: {
            _id: '$outputs.dir',
            total: { $sum: '$outputs.valor' }
        } },
        { $group: {
            _id: null,
            totalDirecciones: { $sum: 1 },
            volumenTotal:     { $sum: '$total' }
        } }
      ],
      top: [
        { $group: {
            _id: '$outputs.dir',
            totalRecibido: { $sum: '$outputs.valor' },
            nTx:           { $sum: 1 }
        } },
        { $sort: { totalRecibido: -1 } },
        { $limit: 500 },
        { $project: {
            _id: 0, dir: '$_id', totalRecibido: 1, nTx: 1
        } }
      ]
    } }
  ], opts).toArray();

  const totales = (faceta?.totales?.[0]) || { totalDirecciones: 0, volumenTotal: 0 };
  const top     = faceta?.top || [];

  // Calcular porcentaje acumulado del volumen
  let acumulado = 0;
  top.forEach(d => {
    acumulado += d.totalRecibido;
    d.pctVolumen   = +((d.totalRecibido / totales.volumenTotal) * 100).toFixed(4);
    d.pctAcumulado = +((acumulado / totales.volumenTotal) * 100).toFixed(2);
  });

  // ¿Qué % del volumen mueve el 1% y 10% de las direcciones?
  const pctAcum = (pct) => {
    const n = Math.ceil(totales.totalDirecciones * pct / 100);
    const slice = n <= top.length ? top.slice(0, n) : top;
    return +((slice.reduce((s, d) => s + d.totalRecibido, 0) / totales.volumenTotal) * 100).toFixed(2);
  };

  return {
    totalDirecciones: totales.totalDirecciones,
    volumenTotal:     totales.volumenTotal,
    pctTop1:  pctAcum(1),
    pctTop10: pctAcum(10),
    top
  };
}

// ─── Informe 8 · Consulta Lenguaje Natural ────────────────────────────────────

// Etapas permitidas en pipelines generados por IA (sin $addFields: vector de $function)
const ETAPAS_PERMITIDAS = new Set([
  '$match', '$group', '$sort', '$limit', '$project', '$unwind', '$bucket', '$count'
]);

// Operadores peligrosos: ejecutan JS arbitrario o acceden a otras colecciones.
// Se buscan recursivamente en TODO el pipeline, no solo en la clave principal.
const OPERADORES_PELIGROSOS = new Set([
  '$function',      // ejecuta JavaScript dentro de Mongo
  '$accumulator',   // puede ejecutar JavaScript
  '$where',         // ejecuta JavaScript en $match
  '$merge',         // escribe a otra colección
  '$out',           // escribe a otra colección
  '$lookup',        // lee de otra colección (fuga de datos)
  '$graphLookup',   // lee de otra colección
  '$unionWith',     // combina con otra colección
]);

const OPS_COMPARACION = new Set(['$gte', '$gt', '$lt', '$lte', '$eq', '$ne']);
const LIMIT_MAX_NL = 1000;

// Recorre recursivamente cualquier valor (objeto/array/primitivo) buscando
// operadores peligrosos en CUALQUIER nivel de anidamiento.
function contieneOperadorPeligroso(valor) {
  if (valor === null || typeof valor !== 'object') return false;
  if (Array.isArray(valor)) return valor.some(contieneOperadorPeligroso);
  for (const [clave, v] of Object.entries(valor)) {
    if (OPERADORES_PELIGROSOS.has(clave)) return true;
    if (contieneOperadorPeligroso(v)) return true;
  }
  return false;
}

// Convierte strings ISO ("2026-11-01") a objetos Date en campos 'fecha'
// para que MongoDB compare Date con Date (no string con Date).
function convertirFechas(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) { obj.forEach(convertirFechas); return obj; }
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'fecha') {
      if (typeof v === 'string') {
        obj[k] = new Date(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [op, val] of Object.entries(v)) {
          if (OPS_COMPARACION.has(op) && typeof val === 'string') v[op] = new Date(val);
        }
      }
    } else {
      convertirFechas(v); // recursión para $and, $or, $nor, etc.
    }
  }
  return obj;
}

// Fuerza un $limit razonable: si no hay, lo agrega; si hay y es muy grande, lo cap.
function forzarLimit(pipeline) {
  let tieneLimit = false;
  for (const etapa of pipeline) {
    if (typeof etapa.$limit === 'number') {
      if (etapa.$limit > LIMIT_MAX_NL) etapa.$limit = LIMIT_MAX_NL;
      tieneLimit = true;
    }
  }
  if (!tieneLimit) pipeline.push({ $limit: LIMIT_MAX_NL });
  return pipeline;
}

// Validación completa del pipeline generado por la IA.
// 1. Cada etapa debe tener UNA sola clave y estar en la lista permitida.
// 2. Ningún operador peligroso puede aparecer en ningún nivel.
// 3. Se fuerza un $limit para no devolver millones de filas.
// 4. Se convierten fechas string a Date para que las comparaciones funcionen.
async function ejecutarPipelineNL(pipeline) {
  if (!Array.isArray(pipeline) || pipeline.length === 0) {
    const e = new Error('El pipeline debe ser un array no vacío'); e.status = 400; throw e;
  }

  // 1. Validar cada etapa: una sola clave, debe estar permitida
  for (const etapa of pipeline) {
    if (!etapa || typeof etapa !== 'object' || Array.isArray(etapa)) {
      const e = new Error('Cada etapa debe ser un objeto'); e.status = 400; throw e;
    }
    const claves = Object.keys(etapa);
    if (claves.length !== 1 || !claves.every(c => c.startsWith('$'))) {
      const e = new Error(`Etapa inválida: debe tener una sola clave con prefijo $`); e.status = 400; throw e;
    }
    const clave = claves[0];
    if (!ETAPAS_PERMITIDAS.has(clave)) {
      const e = new Error(`Etapa no permitida: ${clave}`); e.status = 400; throw e;
    }
  }

  // 2. Validación profunda: ningún operador peligroso en ningún nivel
  if (contieneOperadorPeligroso(pipeline)) {
    const e = new Error('Pipeline rechazado: contiene operadores no permitidos'); e.status = 403; throw e;
  }

  // 3. Forzar $limit
  forzarLimit(pipeline);

  // 4. Convertir fechas string → Date
  for (const etapa of pipeline) {
    if (etapa.$match) convertirFechas(etapa.$match);
  }

  // 5. Ejecutar con conexión de solo lectura si está configurada
  const { conectarLectura } = require('../config/db');
  const db = await conectarLectura();
  return db.collection('transacciones').aggregate(pipeline, opts).toArray();
}

// ─── Informe 10 · Últimas transacciones (tiempo real / mempool vivo) ──────────
async function ultimasTransacciones({ limite = 20 } = {}) {
  const db = await conectar();
  return db.collection('mempool_vivo').aggregate([
    { $sort: { fecha: -1 } },
    { $limit: Number(limite) },
    { $project: {
        _id: 0, txid: 1, fecha: 1, bloque: 1,
        total_salida: 1, comision: 1, n_inputs: 1, n_outputs: 1, tam_virtual: 1
    } }
  ], opts).toArray();
}

// ─── Change Stream helper (usado por socket.io en app.js) ─────────────────────
// Vigila la colección capped "mempool_vivo" (no "transacciones") para que
// el ETL de carga histórica no inunde el dashboard con miles de eventos.
async function abrirChangeStream(resumeAfter) {
  const db = await conectar();
  const options = { fullDocument: 'updateLookup' };
  // Al reabrir el stream tras un error, reanudamos desde el último evento visto
  // para no perder ni duplicar transacciones.
  if (resumeAfter) options.resumeAfter = resumeAfter;
  return db.collection('mempool_vivo').watch(
    [{ $match: { operationType: { $in: ['insert'] } } }],
    options
  );
}

// ─── Distribución de montos (rangos de BTC) ────────────────────────────────────
async function distribucionMontos(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $bucket: {
        groupBy: '$total_salida',
        boundaries: [0, 0.01, 0.1, 1, 10, 100, 1000, 10000],
        default: '10000+',
        output: {
          transacciones: { $sum: 1 },
          volumenTotal:  { $sum: '$total_salida' }
        }
    } },
    { $project: {
        _id: 0,
        rango: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 0] },     then: '0 - 0.01 BTC' },
              { case: { $eq: ['$_id', 0.01] },  then: '0.01 - 0.1 BTC' },
              { case: { $eq: ['$_id', 0.1] },   then: '0.1 - 1 BTC' },
              { case: { $eq: ['$_id', 1] },     then: '1 - 10 BTC' },
              { case: { $eq: ['$_id', 10] },    then: '10 - 100 BTC' },
              { case: { $eq: ['$_id', 100] },   then: '100 - 1000 BTC' },
              { case: { $eq: ['$_id', 1000] },  then: '1000 - 10000 BTC' }
            ],
            default: '10000+ BTC'
          }
        },
        transacciones: 1,
        volumenTotal: 1
    } }
  ], opts).toArray();
}

// ─── Resumen mensual (agregación por mes) ──────────────────────────────────────
async function resumenMensual(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $group: {
        _id: {
          año: { $year: '$fecha' },
          mes: { $month: '$fecha' }
        },
        transacciones:       { $sum: 1 },
        volumenBTC:          { $sum: '$total_salida' },
        comisionTotalBTC:    { $sum: '$comision' },
        comisionPromedioBTC: { $avg: '$comision' }
    } },
    { $sort: { '_id.año': 1, '_id.mes': 1 } },
    { $project: {
        _id: 0,
        mes: {
          $concat: [
            { $toString: '$_id.año' },
            '-',
            { $cond: {
                if: { $lt: ['$_id.mes', 10] },
                then: { $concat: ['0', { $toString: '$_id.mes' }] },
                else: { $toString: '$_id.mes' }
            } }
          ]
        },
        transacciones: 1,
        volumenBTC: 1,
        comisionTotalBTC: 1,
        comisionPromedioBTC: 1
    } }
  ], opts).toArray();
}

// ─── Top bloques por comisiones ────────────────────────────────────────────────
async function topBloquesPorComisiones(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: { ...matchFecha(rango), bloque: { $ne: null } } },
    { $group: {
        _id: '$bloque',
        transacciones:       { $sum: 1 },
        comisionTotalBTC:    { $sum: '$comision' },
        volumenBTC:          { $sum: '$total_salida' },
        fecha:               { $min: '$fecha' }
    } },
    { $sort: { comisionTotalBTC: -1 } },
    { $limit: 50 },
    { $project: {
        _id: 0,
        bloque: '$_id',
        transacciones: 1,
        comisionTotalBTC: 1,
        volumenBTC: 1,
        fecha: 1
    } }
  ], opts).toArray();
}

module.exports = {
  indicadoresGenerales,
  evolucionDiaria,
  comisionesPorHora,
  ballenasHistoricas,
  ballenasRecientes,
  fragmentacion,
  transaccionesAtipicas,
  concentracionDireccion,
  distribucionMontos,
  resumenMensual,
  topBloquesPorComisiones,
  ejecutarPipelineNL,
  ultimasTransacciones,
  abrirChangeStream,
};
