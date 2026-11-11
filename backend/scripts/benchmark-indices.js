/**
 * Comparación ANTES / DESPUÉS de índices con explain("executionStats").
 * Genera docs/benchmark_indices.md listo para el documento de optimización.
 *
 * Uso (desde backend/ para resolver dotenv/mongodb):
 *   node ../database/scripts/benchmark-indices.js
 *   node ../database/scripts/benchmark-indices.js --sin-collscan   (omite el "antes", que puede tardar minutos)
 *
 * "ANTES"   = hint({$natural:1}) → fuerza COLLSCAN (como si no existiera el índice).
 * "DESPUÉS" = el índice que justifica el informe.
 * Cada consulta se cancela a los 5 min; un "cancelado" también es evidencia.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
const { MongoClient } = require(path.join(__dirname, '../../backend/node_modules/mongodb'));

const MAX_MS = 5 * 60 * 1000;
const sinCollscan = process.argv.includes('--sin-collscan');

function resumen(e) {
  const ex = e.executionStats ?? e.stages?.[0]?.$cursor?.executionStats;
  const qp = e.queryPlanner   ?? e.stages?.[0]?.$cursor?.queryPlanner;
  const plan = JSON.stringify(qp?.winningPlan ?? {});
  return {
    plan: plan.includes('IXSCAN') ? 'IXSCAN' : plan.includes('COLLSCAN') ? 'COLLSCAN' : '?',
    indice: (plan.match(/"indexName":"([^"]+)"/) ?? [])[1] ?? '—',
    ms: ex?.executionTimeMillis, docs: ex?.totalDocsExamined, claves: ex?.totalKeysExamined, devueltos: ex?.nReturned,
  };
}

async function medir(fn) {
  try { return resumen(await fn()); }
  catch (e) { return { plan: e.code === 50 ? 'cancelado (>5 min)' : `error: ${e.message.slice(0, 40)}`, indice: '—', ms: null, docs: null, claves: null, devueltos: null }; }
}

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'rastro');
  const col = db.collection('transacciones');

  const [u] = await db.collection('vw_diarias').find().sort({ fecha: -1 }).limit(1).toArray();
  const ini = u.fecha, fin = new Date(ini.getTime() + 864e5);
  const muestra = await col.findOne({ fecha: { $gte: ini, $lt: fin }, es_coinbase: false, 'outputs.0': { $exists: true } });
  const dir = muestra.outputs.find((o) => o.dir)?.dir;
  const existentes = new Set((await col.indexes()).map((i) => i.name));

  const dia = { es_coinbase: false, fecha: { $gte: ini, $lt: fin } };
  const casos = [
    { nombre: 'Transacciones de un día (informes sobre `transacciones`)', indice: 'idx_coinbase_fecha',
      run: (hint) => col.find(dia).hint(hint).maxTimeMS(MAX_MS).explain('executionStats') },
    { nombre: 'Ballenas ≥ 10 BTC en un día', indice: 'idx_ballenas_fecha',
      run: (hint) => col.find({ fecha: dia.fecha, total_salida: { $gte: 10 } }).hint(hint).maxTimeMS(MAX_MS).explain('executionStats') },
    { nombre: 'Historial de una dirección (multikey outputs.dir)', indice: 'idx_outputs_dir',
      run: (hint) => col.find({ 'outputs.dir': dir }).limit(50).hint(hint).maxTimeMS(MAX_MS).explain('executionStats') },
    { nombre: 'Fragmentación (≤2 entradas, ≥10 salidas) en un día', indice: 'idx_fragmentacion_fecha',
      run: (hint) => col.aggregate([{ $match: { ...dia, n_inputs: { $lte: 2 }, n_outputs: { $gte: 10 } } }, { $limit: 100 }],
        { hint, maxTimeMS: MAX_MS, allowDiskUse: true }).explain('executionStats') },
  ];

  const filas = [];
  for (const c of casos) {
    if (!existentes.has(c.indice)) { console.log(`⚠ falta el índice ${c.indice}; se omite "${c.nombre}"`); continue; }
    console.log(`\n▶ ${c.nombre}`);
    const antes = sinCollscan ? null : await medir(() => c.run({ $natural: 1 }));
    const despues = await medir(() => c.run(c.indice));
    if (antes) console.log('   antes  ', antes);
    console.log('   después', despues);
    filas.push({ ...c, antes, despues });
  }

  const f = (r) => (r ? `${r.plan} · ${r.ms ?? '—'} ms · ${r.docs?.toLocaleString('es-CO') ?? '—'} docs · ${r.claves?.toLocaleString('es-CO') ?? '—'} claves` : 'no medido');
  const md = [
    '# Comparación de rendimiento con índices', '',
    `Día medido: ${ini.toISOString().slice(0, 10)} · documentos en \`transacciones\`: ${(await col.estimatedDocumentCount()).toLocaleString('es-CO')}`, '',
    '| Consulta | Índice | Antes (COLLSCAN) | Después (índice) |', '|---|---|---|---|',
    ...filas.map((r) => `| ${r.nombre} | \`${r.indice}\` | ${f(r.antes)} | ${f(r.despues)} |`), '',
  ].join('\n');
  fs.mkdirSync(path.join(__dirname, '../../docs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../../docs/benchmark_indices.md'), md);
  console.log('\n✓ docs/benchmark_indices.md generado');
  await client.close();
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
