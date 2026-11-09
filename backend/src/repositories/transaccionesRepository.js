const { conectar } = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const opts = { maxTimeMS: 120000, allowDiskUse: true };

function matchFecha({ desde, hasta }) {
  const m = { es_coinbase: false };
  if (desde || hasta) {
    m.fecha = {};
    if (desde) m.fecha.$gte = desde;
    if (hasta) m.fecha.$lt  = hasta;
  }
  return m;
}

// ─── Informe 1 · Indicadores Generales ────────────────────────────────────────
async function indicadoresGenerales(rango) {
  const db = await conectar();
  const [r] = await db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
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
  ], opts).toArray();
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
  ], opts).toArray();
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

// ─── Informe 4 · Top Bloques por Comisión ─────────────────────────────────────
async function topBloquesPorComision(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $group: {
        _id:          '$bloque_height',
        fecha:        { $first: '$fecha' },
        txs:          { $sum: 1 },
        comisionTotal: { $sum: '$comision' },
        volumenBTC:   { $sum: '$total_salida' },
        tamVirtualTotal: { $sum: '$tam_virtual' }
    } },
    { $sort: { comisionTotal: -1 } },
    { $limit: 50 },
    { $project: { _id: 0, bloque: '$_id', fecha: 1, txs: 1,
                  comisionTotal: 1, volumenBTC: 1, tamVirtualTotal: 1,
                  satVbPromedio: { $round: [
                    { $divide: [ { $multiply: ['$comisionTotal', 100000000] }, '$tamVirtualTotal' ] }, 2
                  ] } } }
  ], opts).toArray();
}

// ─── Informe 5 · Distribución de Salidas por Transacción ──────────────────────
async function distribucionSalidas(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $bucket: {
        groupBy: '$n_outputs',
        boundaries: [1, 2, 3, 5, 10, 20, 50, 100, 500],
        default: '500+',
        output: {
          count:           { $sum: 1 },
          comisionPromedio: { $avg: '$comision' },
          volumenPromedio:  { $avg: '$total_salida' }
        }
    } },
    { $project: { _id: 0, rango: '$_id', count: 1,
                  comisionPromedio: 1, volumenPromedio: 1 } }
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
        _id: 0, txid: 1, fecha: 1, bloque_height: 1,
        total_salida: 1, comision: 1, n_inputs: 1, n_outputs: 1, tam_virtual: 1,
        satVb: { $round: [
          { $divide: [ { $multiply: ['$comision', 100000000] }, '$tam_virtual' ] }, 2
        ] }
    } }
  ], opts).toArray();
}

// ─── Informe 7 · Comparación Mensual ──────────────────────────────────────────
async function comparacionMensual(rango) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: matchFecha(rango) },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$fecha' } },
        transacciones:    { $sum: 1 },
        volumenBTC:       { $sum: '$total_salida' },
        comisionTotal:    { $sum: '$comision' },
        comisionPromedio: { $avg: '$comision' },
        tamPromedio:      { $avg: '$tam_virtual' }
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, mes: '$_id', transacciones: 1, volumenBTC: 1,
                  comisionTotal: 1, comisionPromedio: 1, tamPromedio: 1 } }
  ], opts).toArray();
}

// ─── Informe 8 · Consulta Lenguaje Natural (resultado pasa como parámetro) ────
// La generación del pipeline se hace en el controller/service; aquí solo ejecutamos.
async function ejecutarPipelineNL(pipeline) {
  const db = await conectar();
  // Seguridad: permitir sólo $match, $group, $sort, $limit, $project, $unwind, $bucket
  const etapasPermitidas = new Set([
    '$match','$group','$sort','$limit','$project','$unwind','$bucket','$addFields','$count'
  ]);
  for (const etapa of pipeline) {
    const clave = Object.keys(etapa)[0];
    if (!etapasPermitidas.has(clave)) {
      const e = new Error(`Etapa no permitida: ${clave}`);
      e.status = 400;
      throw e;
    }
  }
  return db.collection('transacciones').aggregate(pipeline, opts).toArray();
}

// ─── Informe 10 · Últimas transacciones (tiempo real / polling) ───────────────
async function ultimasTransacciones({ limite = 20 } = {}) {
  const db = await conectar();
  return db.collection('transacciones').aggregate([
    { $match: { es_coinbase: false } },
    { $sort: { fecha: -1 } },
    { $limit: Number(limite) },
    { $project: {
        _id: 0, txid: 1, fecha: 1, bloque_height: 1,
        total_salida: 1, comision: 1, n_inputs: 1, n_outputs: 1, tam_virtual: 1
    } }
  ], opts).toArray();
}

// ─── Change Stream helper (usado por socket.io en app.js) ─────────────────────
async function abrirChangeStream() {
  const db = await conectar();
  return db.collection('transacciones').watch(
    [{ $match: { operationType: { $in: ['insert', 'update'] } } }],
    { fullDocument: 'updateLookup' }
  );
}

module.exports = {
  indicadoresGenerales,
  evolucionDiaria,
  comisionesPorHora,
  topBloquesPorComision,
  distribucionSalidas,
  transaccionesAtipicas,
  comparacionMensual,
  ejecutarPipelineNL,
  ultimasTransacciones,
  abrirChangeStream,
};
