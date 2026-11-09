require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testQuery() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB);
    
    console.log('⏱️  Probando consulta simple con índices...\n');
    
    const start = Date.now();
    const result = await db.collection('transacciones').aggregate([
      { $match: { es_coinbase: false } },
      { $group: {
          _id: null,
          transacciones: { $sum: 1 },
          volumenBTC: { $sum: '$total_salida' },
          comisionTotalBTC: { $sum: '$comision' }
      } }
    ], { maxTimeMS: 30000 }).toArray();
    
    const elapsed = Date.now() - start;
    
    console.log('✅ Resultado:');
    console.log(JSON.stringify(result[0], null, 2));
    console.log(`\n⏱️  Tiempo: ${elapsed}ms`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

testQuery();
