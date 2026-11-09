// Versión Node.js de crear_indices.js — para sistemas sin mongosh en el PATH.
// Uso: node database/indexes/crear_indices_node.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.MONGO_DB);
  const col = db.collection('transacciones');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Creación de índices — rastro.transacciones');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const indices = [
    { key: { es_coinbase: 1, fecha: 1 }, name: 'idx_coinbase_fecha',      label: '1/8' },
    { key: { fecha: 1 },                name: 'idx_fecha_asc',            label: '2/8' },
    { key: { fecha: -1 },               name: 'idx_fecha_desc',          label: '3/8' },
    { key: { bloque: 1 },               name: 'idx_bloque',              label: '4/8' },
    { key: { total_salida: -1 },        name: 'idx_total_salida_desc',   label: '5/8' },
    { key: { comision: 1 },             name: 'idx_comision',            label: '6/8' },
    { key: { 'outputs.dir': 1 },        name: 'idx_outputs_dir',          label: '7/8' },
    { key: { es_coinbase: 1 },          name: 'idx_es_coinbase',         label: '8/8' },
  ];

  for (const idx of indices) {
    const existentes = await col.indexExists(idx.name).catch(() => false);
    if (existentes) {
      console.log(`${idx.label}  ${idx.name.padEnd(24)} ya existe — saltando`);
      continue;
    }
    console.log(`${idx.label}  ${idx.name.padEnd(24)} creando...`);
    try {
      await col.createIndex(idx.key, { background: true, name: idx.name });
      console.log(`     ✓ ${idx.name} creado`);
    } catch (e) {
      console.log(`     ⚠ ${e.message}`);
    }
  }

  // mempool_vivo (capped)
  const vivo = db.collection('mempool_vivo');
  const vivoIdx = await vivo.indexExists('idx_vivo_fecha_desc').catch(() => false);
  if (!vivoIdx) {
    console.log('\n  idx_vivo_fecha_desc      creando en mempool_vivo...');
    await vivo.createIndex({ fecha: -1 }, { name: 'idx_vivo_fecha_desc' });
    console.log('     ✓ creado');
  } else {
    console.log('\n  idx_vivo_fecha_desc      ya existe en mempool_vivo');
  }

  // Resumen
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Índices finales:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const allIdx = await col.indexes();
  allIdx.forEach(i => console.log(`  ${i.name.padEnd(28)} ${JSON.stringify(i.key)}`));
  console.log('\n  mempool_vivo:');
  (await vivo.indexes()).forEach(i => console.log(`  ${i.name.padEnd(28)} ${JSON.stringify(i.key)}`));

  await client.close();
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
