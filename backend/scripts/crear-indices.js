require('dotenv').config();
const { MongoClient } = require('mongodb');

async function crearIndices() {
  const client = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  try {
    console.log('🔌 Conectando a MongoDB...');
    await client.connect();
    console.log('✅ Conectado');

    const db = client.db(process.env.MONGO_DB);
    const col = db.collection('transacciones');

    // Verificar cantidad
    console.log('\n📊 Contando documentos...');
    const count = await col.estimatedDocumentCount();
    console.log(`   Total (estimado): ${count.toLocaleString()}`);

    // Crear índices básicos
    console.log('\n🔨 Creando índices...');
    
    const indices = [
      { key: { es_coinbase: 1, fecha: 1 }, name: 'idx_coinbase_fecha' },
      { key: { fecha: -1 }, name: 'idx_fecha_desc' },
      { key: { bloque: 1 }, name: 'idx_bloque' },
    ];

    for (const idx of indices) {
      try {
        await col.createIndex(idx.key, { name: idx.name, background: true });
        console.log(`  ✓ ${idx.name}`);
      } catch (e) {
        console.log(`  → ${idx.name} (${e.codeName || 'ya existe'})`);
      }
    }

    console.log('\n✅ Completado');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Solución: Asegúrate de que MongoDB esté corriendo:');
      console.log('   mongod --replSet rs0 --dbpath ./data/db');
    }
  } finally {
    await client.close();
  }
}

crearIndices();
