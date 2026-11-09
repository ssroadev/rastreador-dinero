require('dotenv').config();
const { MongoClient } = require('mongodb');
(async () => {
  const c = new MongoClient(process.env.MONGO_URI);
  await c.connect();
  const db = c.db(process.env.MONGO_DB);
  const col = db.collection('transacciones');

  const min = await col.findOne({}, { sort: { fecha: 1 }, projection: { fecha: 1 } });
  const max = await col.findOne({}, { sort: { fecha: -1 }, projection: { fecha: 1 } });
  console.log('Min fecha:', min?.fecha?.toISOString());
  console.log('Max fecha:', max?.fecha?.toISOString());

  // Count docs in a 1-hour window using estimated (fast)
  const start = new Date('2026-11-09T18:00:00Z');
  const end   = new Date('2026-11-09T19:00:00Z');
  const count = await col.countDocuments(
    { fecha: { $gte: start, $lt: end } },
    { maxTimeMS: 15000 }
  );
  console.log('Docs in 1 hour (18:00-19:00):', count.toLocaleString('es-CO'));

  // Count docs in 1 day
  const dayStart = new Date('2026-11-09T00:00:00Z');
  const dayEnd   = new Date('2026-11-10T00:00:00Z');
  const dayCount = await col.countDocuments(
    { fecha: { $gte: dayStart, $lt: dayEnd } },
    { maxTimeMS: 30000 }
  );
  console.log('Docs in Nov 9 (full day):', dayCount.toLocaleString('es-CO'));

  await c.close();
})();
