require('dotenv').config();
const { MongoClient } = require('mongodb');

async function verificarFechas() {
  const client = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB);
    const col = db.collection('transacciones');

    console.log('📅 Verificando rango de fechas...\n');

    // Fecha más antigua
    const [primera] = await col.find({ es_coinbase: false })
      .sort({ fecha: 1 })
      .limit(1)
      .project({ fecha: 1, bloque: 1, txid: 1 })
      .toArray();

    // Fecha más reciente
    const [ultima] = await col.find({ es_coinbase: false })
      .sort({ fecha: -1 })
      .limit(1)
      .project({ fecha: 1, bloque: 1, txid: 1 })
      .toArray();

    if (primera) {
      console.log('🕐 Primera transacción:');
      console.log(`   Fecha: ${primera.fecha}`);
      console.log(`   Bloque: ${primera.bloque}`);
      console.log(`   TXID: ${primera.txid}\n`);
    }

    if (ultima) {
      console.log('🕐 Última transacción:');
      console.log(`   Fecha: ${ultima.fecha}`);
      console.log(`   Bloque: ${ultima.bloque}`);
      console.log(`   TXID: ${ultima.txid}\n`);
    }

    // Contar por año
    console.log('📊 Transacciones por año:');
    const porAno = await col.aggregate([
      { $match: { es_coinbase: false } },
      { $group: {
          _id: { $year: '$fecha' },
          count: { $sum: 1 }
      } },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ]).toArray();

    porAno.forEach(({ _id, count }) => {
      console.log(`   ${_id}: ${count.toLocaleString()}`);
    });

    // Test: últimos 7 días
    console.log('\n⚡ Test: Últimos 7 días desde HOY...');
    const hace7 = new Date();
    hace7.setDate(hace7.getDate() - 7);
    
    const start = Date.now();
    const count7dias = await col.countDocuments({
      es_coinbase: false,
      fecha: { $gte: hace7 }
    });
    const tiempo = Date.now() - start;

    console.log(`   Encontradas: ${count7dias.toLocaleString()}`);
    console.log(`   Tiempo: ${tiempo}ms`);

    if (count7dias === 0) {
      console.log('\n⚠️  No hay datos recientes. La BD contiene datos históricos antiguos.');
      console.log('💡 Intenta con un rango del pasado basado en las fechas mostradas arriba.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

verificarFechas();
