const db = db.getSiblingDB('rastro');
const consultas = {
  indicadores_un_dia: () => db.transacciones.find(
    { fecha: { $gte: ISODate('2026-11-08'), $lt: ISODate('2026-11-09') }, es_coinbase: false }),
  historial_direccion: () => db.transacciones.find(
    { 'outputs.dir': 'bc1qqdmn8fxdyualqgqsrvv7n8svjlcrfagfjgaxla' }).limit(50),
  ballenas: () => db.transacciones.find({ total_salida: { $gte: 100 } }),
};
for (const [nombre, q] of Object.entries(consultas)) {
  const e = q().explain('executionStats').executionStats;
  print(`${nombre}: ${e.executionTimeMillis} ms | docs examinados ${e.totalDocsExamined} | claves ${e.totalKeysExamined} | devueltos ${e.nReturned}`);
}