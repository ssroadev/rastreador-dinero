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
async function fragmentacionEnVivo(rango) {
  const db = await conectar();
  return conHint(db.collection('transacciones'), [
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
  ], 'idx_fragmentacion_fecha');
}

// ─── Concentración por dirección ──────────────────────────────────────────────
// Dos pasadas (el controlador limita la ventana a 2 días):
//   1) cuántas direcciones distintas hay y cuánto volumen total
//   2) top 500 + suma exacta del 1 % y del 10 % de las direcciones (por volumen recibido)
async function concentracionEnVivo(rango) {
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
//  Fragmentación y Concentración: leen colecciones PRE-CALCULADAS por día
//  (vw_fragmentacion, vw_concentracion). Se llenan con
//  `node scripts/pre-agregar-frag-conc.js` reutilizando las funciones "EnVivo".
//  Si el rango pedido aún no está pre-calculado, se calcula en vivo (lento) solo
//  cuando el rango es corto; si no, se pide ejecutar el script.
// ═════════════════════════════════════════════════════════════════════════════
const MAX_DIAS_EN_VIVO = { fragmentacion: 7, concentracion: 2 };

async function diasEsperados(db, rango) {
  return db.collection('vw_diarias').countDocuments(filtroVw(rango));
}
async function diasPrecalculados(db, tipo, rango) {
  return db.collection('vw_precalculo').countDocuments({ tipo, ...filtroVw(rango) });
}
function sinPrecalculo(tipo, rango) {
  const dias = rango.desde && rango.hasta ? (rango.hasta - rango.desde) / 864e5 : Infinity;
  if (dias > MAX_DIAS_EN_VIVO[tipo]) {
    const e = new Error(
      `Rango no pre-calculado para ${tipo}. Ejecuta "node scripts/pre-agregar-frag-conc.js" ` +
      `o reduce el rango a ${MAX_DIAS_EN_VIVO[tipo]} día(s).`);
    e.status = 400;
    throw e;
  }
}

// ─── Informe · Fragmentación (top 100 del rango, instantáneo) ─────────────────
async function fragmentacion(rango) {
  const db = await conectar();
  const esperados = await diasEsperados(db, rango);
  if (esperados === 0 || (await diasPrecalculados(db, 'fragmentacion', rango)) < esperados) {
    sinPrecalculo('fragmentacion', rango);
    return fragmentacionEnVivo(rango);
  }
  // El top-100 global es el top-100 de la unión de los top-100 diarios (resultado exacto).
  return db.collection('vw_fragmentacion').aggregate([
    { $match: filtroVw(rango) },
    { $sort: { n_outputs: -1, total_salida: -1 } },
    { $limit: 100 },
    { $project: { _id: 0, dia: 0 } },
  ], opts).toArray();
}

// ─── Informe · Concentración por dirección ────────────────────────────────────
// Devuelve el último día del rango (mismo formato de antes) + `serie` con la
// evolución diaria de pctTop1 / pctTop10 para todo el rango.
async function concentracionDireccion(rango) {
  const db = await conectar();
  const esperados = await diasEsperados(db, rango);
  if (esperados === 0 || (await diasPrecalculados(db, 'concentracion', rango)) < esperados) {
    sinPrecalculo('concentracion', rango);
    return concentracionEnVivo(rango);
  }
  const col = db.collection('vw_concentracion');
  const [ultimo] = await col.find(filtroVw(rango)).sort({ fecha: -1 }).limit(1).toArray();
  if (!ultimo) return { totalDirecciones: 0, volumenTotal: 0, pctTop1: 0, pctTop10: 0, top: [], serie: [] };
  const serie = await col.find(filtroVw(rango), {
    projection: { _id: 0, fecha: 1, totalDirecciones: 1, volumenTotal: 1, pctTop1: 1, pctTop10: 1 },
  }).sort({ fecha: 1 }).toArray();
  const { _id, ...resto } = ultimo;
  return { ...resto, diaMostrado: _id, serie };
}

async function conHint(col, pipeline, hint) {
  try {
    return await col.aggregate(pipeline, { ...opts, hint }).toArray();
  } catch (e) {
    if (/hint/i.test(e.message || '')) return col.aggregate(pipeline, opts).toArray(); // el índice no existe
    throw e;
  }
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

// ─── Lenguaje Natural (NL) ─────────────────────────────────────────────────────
/**
 * Contexto de datos para el servicio NL: fechas disponibles, etc.
 */
async function contextoDatos() {
  const db = await conectar();
  const [r] = await db.collection('vw_diarias').aggregate([
    { $group: {
        _id: null,
        primera: { $min: '$fecha' },
        ultima:  { $max: '$fecha' },
    } },
  ], opts).toArray();
  
  if (!r) {
    throw new Error('No hay datos disponibles para generar contexto');
  }
  
  const primera = r.primera.toISOString().split('T')[0];
  const ultima = r.ultima.toISOString().split('T')[0];
  const siguiente = new Date(r.ultima);
  siguiente.setDate(siguiente.getDate() + 1);
  
  return {
    hoy: new Date().toISOString().split('T')[0],
    primera,
    ultima,
    siguiente: siguiente.toISOString().split('T')[0],
  };
}

/**
 * Ejecuta un pipeline generado por IA. Valida que sea de solo lectura.
 * @param {object} params - { coleccion, pipeline }
 */
async function ejecutarPipelineNL({ coleccion, pipeline }) {
  // Validación básica
  if (!coleccion || !Array.isArray(pipeline)) {
    const e = new Error('Se requiere {coleccion, pipeline}');
    e.status = 400;
    throw e;
  }
  
  // Colecciones permitidas
  const permitidas = ['vw_diarias', 'vw_horas', 'vw_bloques', 'vw_salidas', 'transacciones'];
  if (!permitidas.includes(coleccion)) {
    const e = new Error(`Colección no permitida: ${coleccion}`);
    e.status = 400;
    throw e;
  }
  
  // Validar que sean etapas de solo lectura
  const etapasEscritura = ['$out', '$merge', '$function', '$accumulator', '$where', 
                          '$lookup', '$graphLookup', '$unionWith'];
  for (const etapa of pipeline) {
    const nombre = Object.keys(etapa)[0];
    if (etapasEscritura.includes(nombre)) {
      const e = new Error(`Etapa prohibida en pipeline: ${nombre}`);
      e.status = 403;
      throw e;
    }
  }
  
  // Agregar límite de seguridad si no existe
  const tieneLimit = pipeline.some(etapa => '$limit' in etapa);
  if (!tieneLimit) {
    pipeline.push({ $limit: 1000 });
  }
  
  // Ejecutar
  const db = await conectar();
  try {
    return await db.collection(coleccion).aggregate(pipeline, opts).toArray();
  } catch (error) {
    // Errores comunes de MongoDB con mejor mensaje
    if (error.code === 2) {
      throw new Error(`Campo no encontrado: ${error.message}`);
    }
    if (error.code === 16552) {
      throw new Error('Pipeline inválido: límite de memoria excedido');
    }
    throw error;
  }
}

module.exports = {
  indicadoresGenerales, evolucionDiaria, comisionesPorHora,
  resumenMensual, topBloquesPorComisiones, distribucionSalidas,
  ballenasHistoricas, ballenasRecientes, fragmentacion, concentracionDireccion,
  fragmentacionEnVivo, concentracionEnVivo,
  ultimasTransacciones, abrirChangeStream,
  contextoDatos, ejecutarPipelineNL,
};
