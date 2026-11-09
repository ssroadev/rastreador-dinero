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
  // Concentration timing (full day, known to work)
  console.log('Concentración (Nov 8, full day)...');
  try {
    const r = await get('/api/informes/concentracion?desde=2026-11-08&hasta=2026-11-09');
    console.log('  Status:', r.status, '| Time:', (r.ms/1000).toFixed(1) + 's');
    console.log('  Direcciones:', r.body?.totalDirecciones?.toLocaleString('es-CO'));
  } catch (e) { console.log('  ✗', e.message); }

  // Ballenas with 1-hour window
  console.log('\nBallenas (Nov 8, 00:00-01:00, minBtc=0.1)...');
  try {
    const r = await get('/api/informes/ballenas?desde=2026-11-08&hasta=2026-11-08T01:00:00&minBtc=0.1');
    console.log('  Status:', r.status, '| Time:', (r.ms/1000).toFixed(1) + 's');
    if (Array.isArray(r.body)) console.log('  ✓', r.body.length, 'días');
    else console.log('  Body:', JSON.stringify(r.body).substring(0, 200));
  } catch (e) { console.log('  ✗', e.message); }

  // Fragmentación with 1-hour window
  console.log('\nFragmentación (Nov 8, 00:00-01:00)...');
  try {
    const r = await get('/api/informes/fragmentacion?desde=2026-11-08&hasta=2026-11-08T01:00:00');
    console.log('  Status:', r.status, '| Time:', (r.ms/1000).toFixed(1) + 's');
    if (Array.isArray(r.body)) console.log('  ✓', r.body.length, 'txs');
    else console.log('  Body:', JSON.stringify(r.body).substring(0, 200));
  } catch (e) { console.log('  ✗', e.message); }

  process.exit(0);
})();
