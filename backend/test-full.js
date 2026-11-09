const http = require('http');
function get(path) {
  return new Promise((resolve, reject) => {
    const t = Date.now();
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), ms: Date.now() - t }); }
        catch { resolve({ status: res.statusCode, body: data, ms: Date.now() - t }); }
      });
    }).on('error', e => reject(e));
  });
}

(async () => {
  // Ballenas: full day
  console.log('Ballenas (Nov 8, full day, minBtc=1)...');
  try {
    const r = await get('/api/informes/ballenas?desde=2026-11-08&hasta=2026-11-09&minBtc=1');
    console.log('  Status:', r.status, '| Time:', (r.ms/1000).toFixed(1) + 's');
    if (Array.isArray(r.body)) {
      console.log('  ✓', r.body.length, 'días');
      r.body.forEach(d => console.log('   ', d.dia, '-', d.transacciones, 'ballenas,', d.volumenTotal.toFixed(2), 'BTC'));
    }
  } catch (e) { console.log('  ✗', e.message); }

  // Ballenas: full week
  console.log('\nBallenas (Nov 2-9, full week, minBtc=10)...');
  try {
    const r = await get('/api/informes/ballenas?desde=2026-11-02&hasta=2026-11-09&minBtc=10');
    console.log('  Status:', r.status, '| Time:', (r.ms/1000).toFixed(1) + 's');
    if (Array.isArray(r.body)) {
      console.log('  ✓', r.body.length, 'días');
      r.body.slice(0, 5).forEach(d => console.log('   ', d.dia, '-', d.transacciones, 'ballenas,', d.volumenTotal.toFixed(2), 'BTC'));
      if (r.body.length > 5) console.log('   ... y', r.body.length - 5, 'más');
    }
  } catch (e) { console.log('  ✗', e.message); }

  // Fragmentación: full day
  console.log('\nFragmentación (Nov 8, full day)...');
  try {
    const r = await get('/api/informes/fragmentacion?desde=2026-11-08&hasta=2026-11-09');
    console.log('  Status:', r.status, '| Time:', (r.ms/1000).toFixed(1) + 's');
    if (Array.isArray(r.body)) {
      console.log('  ✓', r.body.length, 'detectadas');
      if (r.body[0]) console.log('  Ej:', r.body[0].n_inputs, '→', r.body[0].n_outputs, '| CV:', r.body[0].coefVariacion);
    }
  } catch (e) { console.log('  ✗', e.message); }

  process.exit(0);
})();
