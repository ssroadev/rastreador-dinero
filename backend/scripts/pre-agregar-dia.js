/**
 * Pre-agregación por día → colecciones vw_* (pequeñas) que usan los informes.
 *
 * Uso:
 *   node scripts/pre-agregar-dia.js                      (todos los días con datos)
 *   node scripts/pre-agregar-dia.js 2026-09-21 2026-11-08 (rango, ambos inclusive)
 *   node scripts/pre-agregar-dia.js --forzar              (recalcula aunque ya existan)
 *
 * Es reanudable: salta los días que ya tienen sus 24 horas en vw_horas.
 * Cada día se procesa con el índice {es_coinbase, fecha} y se lee UNA sola vez.
 * Los cálculos siguen ocurriendo dentro de MongoDB ($match/$group/$bucket/$facet).
 *
 * Colecciones (todas con _id estable, sin duplicados al repetir):
 *   vw_horas    _id "2026-11-08T14"        → tx, volumen, comision, tam, salidas, sumTasa
 *   vw_diarias  _id "2026-11-08"           → derivada de vw_horas
 *   vw_bloques  _id <altura del bloque>    → tx, comision, volumen, tam, fecha
 *   vw_salidas  _id "2026-11-08|5"         → tx, comision, volumen por rango de n_outputs
 */
require('dotenv').config();
const { conectar } = require('../src/config/db');

const DIA = 864e5;
const forzar = process.argv.includes('--forzar');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

const ORDEN_DEFAULT = 1e9; // el bucket '500+' va al final

async function main() {
  const db = await conectar();
  const tx = db.collection('transacciones');

  // Si quedan vistas viejas (creadas con _id ObjectId) se duplicarían filas.
  for (const nombre of ['vw_diarias', 'vw_bloques']) {
    const viejo = await db.collection(nombre).findOne({ _id: { $type: 'objectId' } });
    if (viejo) {
      console.error(`✗ ${nombre} contiene filas de la versión anterior. Bórrala primero:\n  db.${nombre}.drop()`);
      process.exit(1);
    }
  }

  // Rango: argumentos o primer/último día con datos (usa idx_fecha, es instantáneo)
  let ini, fin;
  if (args.length >= 2) {
    ini = new Date(args[0]); fin = new Date(args[1]);
  } else {
    const [a] = await tx.find({}, { projection: { fecha: 1 } }).sort({ fecha: 1 }).limit(1).toArray();
    const [b] = await tx.find({}, { projection: { fecha: 1 } }).sort({ fecha: -1 }).limit(1).toArray();
    ini = new Date(a.fecha.toISOString().slice(0, 10));
    fin = new Date(b.fecha.toISOString().slice(0, 10));
  }
  console.log(`Procesando de ${ini.toISOString().slice(0, 10)} a ${fin.toISOString().slice(0, 10)}\n`);

  for (let d = new Date(ini); d <= fin; d = new Date(+d + DIA)) {
    const sig = new Date(+d + DIA);
    const etiqueta = d.toISOString().slice(0, 10);

    if (!forzar) {
      const horas = await db.collection('vw_horas').countDocuments({ fecha: { $gte: d, $lt: sig } });
      if (horas >= 24) { console.log(`${etiqueta}  ya procesado, salto`); continue; }
    }

    const t0 = Date.now();
    const [f] = await tx.aggregate([
      { $match: { es_coinbase: false, fecha: { $gte: d, $lt: sig } } },
      { $facet: {
          horas: [
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$fecha' } },
                tx:       { $sum: 1 },
                volumen:  { $sum: '$total_salida' },
                comision: { $sum: '$comision' },
                tam:      { $sum: '$tam_virtual' },
                salidas:  { $sum: '$n_outputs' },
                sumTasa:  { $sum: { $cond: [
                  { $and: [{ $gt: ['$tam_virtual', 0] }, { $ne: ['$comision', null] }] },
                  { $divide: [{ $multiply: ['$comision', 1e8] }, '$tam_virtual'] }, 0] } },
            } },
          ],
          bloques: [
            { $match: { bloque: { $ne: null } } },
            { $group: {
                _id: '$bloque',
                tx:       { $sum: 1 },
                comision: { $sum: '$comision' },
                volumen:  { $sum: '$total_salida' },
                tam:      { $sum: '$tam_virtual' },
                fecha:    { $min: '$fecha' },
            } },
          ],
          salidas: [
            { $bucket: {
                groupBy: '$n_outputs',
                boundaries: [1, 2, 3, 5, 10, 20, 50, 100, 500],
                default: '500+',
                output: { tx: { $sum: 1 }, comision: { $sum: '$comision' }, volumen: { $sum: '$total_salida' } },
            } },
          ],
      } },
    ], { allowDiskUse: true }).toArray();

    if (!f) { console.log(`${etiqueta}  sin datos`); continue; }

    const upsert = (docs, mapear) => docs.map(x => {
      const doc = mapear(x);
      return { replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } };
    });

    if (f.horas.length)
      await db.collection('vw_horas').bulkWrite(upsert(f.horas, h => ({ ...h, fecha: new Date(h._id + ':00:00Z') })));
    if (f.bloques.length)
      await db.collection('vw_bloques').bulkWrite(upsert(f.bloques, b => b));
    if (f.salidas.length)
      await db.collection('vw_salidas').bulkWrite(upsert(f.salidas, s => ({
        _id: `${etiqueta}|${s._id}`, fecha: d, rango: s._id,
        orden: typeof s._id === 'number' ? s._id : ORDEN_DEFAULT,
        tx: s.tx, comision: s.comision, volumen: s.volumen,
      })));

    console.log(`${etiqueta}  ok  (${f.horas.length} h, ${f.bloques.length} bloques, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }

  // vw_diarias se deriva de vw_horas (diminuta → instantáneo)
  await db.collection('vw_horas').aggregate([
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
        tx: { $sum: '$tx' }, volumen: { $sum: '$volumen' }, comision: { $sum: '$comision' },
        tam: { $sum: '$tam' }, salidas: { $sum: '$salidas' },
    } },
    { $addFields: { fecha: { $toDate: '$_id' } } },
    { $merge: { into: 'vw_diarias', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } },
  ]).toArray();

  await db.collection('vw_horas').createIndex({ fecha: 1 });
  await db.collection('vw_diarias').createIndex({ fecha: 1 });
  await db.collection('vw_bloques').createIndex({ fecha: 1 });
  await db.collection('vw_bloques').createIndex({ comision: -1 });
  await db.collection('vw_salidas').createIndex({ fecha: 1 });

  for (const c of ['vw_horas', 'vw_diarias', 'vw_bloques', 'vw_salidas'])
    console.log(`${c.padEnd(11)} ${await db.collection(c).countDocuments()} documentos`);
  process.exit(0);
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
