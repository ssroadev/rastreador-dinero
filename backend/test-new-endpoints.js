require('dotenv').config();
const { MongoClient } = require('mongodb');
const http = require('http');

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}

(async () => {
  // 1. Ballenas vivas (mempool_vivo, debería ser rápido)
  console.log('1. Ballenas vivas...');
  try {
    const vivas = await get('/api/informes/ballenas/vivo?limite=3&minBtc=0.001');
    console.log('   ✓', vivas.length, 'ballenas vivas');
    if (vivas[0]) console.log('   Ejemplo:', vivas[0].txid?.substring(0, 16), '...', vivas[0].total_salida, 'BTC');
  } catch (e) { console.log('   ✗', e.message); }

  // 2. Ballenas históricas (1 día: Nov 8)
  console.log('\n2. Ballenas históricas (Nov 8, minBtc=1)...');
  try {
    const hist = await get('/api/informes/ballenas?desde=2026-11-08&hasta=2026-11-09&minBtc=1');
    console.log('   ✓', hist.length, 'días con ballenas');
    if (hist[0]) console.log('   Ejemplo:', hist[0].dia, '-', hist[0].transacciones, 'txs,', hist[0].volumenTotal.toFixed(2), 'BTC');
  } catch (e) { console.log('   ✗', e.message); }

  // 3. Fragmentación (1 día: Nov 8)
  console.log('\n3. Fragmentación (Nov 8)...');
  try {
    const frag = await get('/api/informes/fragmentacion?desde=2026-11-08&hasta=2026-11-09');
    console.log('   ✓', frag.length, 'transacciones de fragmentación detectadas');
    if (frag[0]) console.log('   Ejemplo:', frag[0].txid?.substring(0, 16), '-', frag[0].n_inputs, '→', frag[0].n_outputs, 'CV:', frag[0].coefVariacion);
  } catch (e) { console.log('   ✗', e.message); }

  // 4. Concentración (1 día: Nov 8)
  console.log('\n4. Concentración (Nov 8)...');
  try {
    const conc = await get('/api/informes/concentracion?desde=2026-11-08&hasta=2026-11-09');
    console.log('   ✓ Direcciones:', conc.totalDirecciones?.toLocaleString('es-CO'));
    console.log('   ✓ Volumen total:', conc.volumenTotal?.toFixed(2), 'BTC');
    console.log('   ✓ Top 1% controla:', conc.pctTop1, '%');
    console.log('   ✓ Top 10% controla:', conc.pctTop10, '%');
    console.log('   ✓ Top direcciones:', conc.top?.length);
    if (conc.top?.[0]) console.log('   #1:', conc.top[0].dir?.substring(0, 20), '-', conc.top[0].totalRecibido?.toFixed(4), 'BTC');
  } catch (e) { console.log('   ✗', e.message); }

  process.exit(0);
})();
