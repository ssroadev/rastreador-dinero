const http = require('http');
function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(130000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  // Ballenas: 6 horas el 8 de nov
  console.log('Ballenas (Nov 8, 00:00-06:00, minBtc=0.5)...');
  const t1 = Date.now();
  try {
    const r = await get('/api/informes/ballenas?desde=2026-11-08&hasta=2026-11-08T06:00:00&minBtc=0.5');
    console.log('  Status:', r.status, '|', (Date.now()-t1)/1000, 's');
    if (Array.isArray(r.body)) console.log('  ✓', r.body.length, 'días |', r.body[0] ? JSON.stringify(r.body[0]) : 'vacío');
    else console.log('  Body:', JSON.stringify(r.body).substring(0, 200));
  } catch (e) { console.log('  ✗', e.message, '|', (Date.now()-t1)/1000, 's'); }

  // Fragmentación: 6 horas el 8 de nov
  console.log('\nFragmentación (Nov 8, 00:00-06:00)...');
  const t2 = Date.now();
  try {
    const r = await get('/api/informes/fragmentacion?desde=2026-11-08&hasta=2026-11-08T06:00:00');
    console.log('  Status:', r.status, '|', (Date.now()-t2)/1000, 's');
    if (Array.isArray(r.body)) {
      console.log('  ✓', r.body.length, 'detectadas');
      if (r.body[0]) console.log('  Ej:', r.body[0].txid?.substring(0,16), r.body[0].n_inputs, '→', r.body[0].n_outputs, 'CV:', r.body[0].coefVariacion);
    } else console.log('  Body:', JSON.stringify(r.body).substring(0, 200));
  } catch (e) { console.log('  ✗', e.message, '|', (Date.now()-t2)/1000, 's'); }

  process.exit(0);
})();
