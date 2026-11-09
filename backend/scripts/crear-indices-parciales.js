/**
 * Índices nuevos para los informes que leen `transacciones`.
 *
 * Uso (desde la carpeta backend):
 *   node scripts/crear-indices-parciales.js            crea los índices parciales
 *   node scripts/crear-indices-parciales.js --limpiar  además borra índices redundantes
 *
 * Índices parciales: solo indexan los documentos relevantes → ocupan una fracción
 * del tamaño y las consultas que los usan examinan muchos menos documentos.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const NUEVOS = [
  { key: { fecha: 1 }, name: 'idx_ballenas_fecha',
    partialFilterExpression: { total_salida: { $gte: 1 } },
    para: 'Ballenas: monto >= 1 BTC en un rango de fechas' },
  { key: { fecha: 1 }, name: 'idx_fragmentacion_fecha',
    partialFilterExpression: { n_outputs: { $gte: 10 } },
    para: 'Fragmentación: transacciones con >= 10 salidas en un rango de fechas' },
];

// Redundantes: idx_fecha_desc (idx_fecha_asc sirve en ambos sentidos) e idx_es_coinbase
// (es prefijo de idx_coinbase_fecha). Los de comision/total_salida no los usa ningún informe.
const REDUNDANTES = ['idx_fecha_desc', 'idx_es_coinbase', 'idx_comision', 'idx_total_salida_desc'];

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const col = client.db(process.env.MONGO_DB).collection('transacciones');

  for (const { para, ...idx } of NUEVOS) {
    const { key, ...resto } = idx;
    const t0 = Date.now();
    console.log(`Creando ${idx.name}  (${para}) ...`);
    try {
      await col.createIndex(key, resto);
      console.log(`  ✓ listo en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    } catch (e) { console.log(`  ⚠ ${e.message}`); }
  }

  if (process.argv.includes('--limpiar')) {
    for (const nombre of REDUNDANTES) {
      try { await col.dropIndex(nombre); console.log(`  ✓ borrado ${nombre}`); }
      catch (e) { console.log(`  - ${nombre}: ${e.message}`); }
    }
  }

  console.log('\nÍndices actuales:');
  (await col.indexes()).forEach(i => console.log(`  ${i.name.padEnd(26)} ${JSON.stringify(i.key)}${i.partialFilterExpression ? '  parcial ' + JSON.stringify(i.partialFilterExpression) : ''}`));
  await client.close();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
