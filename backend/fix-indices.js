// Elimina el índice incorrecto (bloque_height) y crea el correcto (bloque)
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fixIndices() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db(process.env.MONGO_DB).collection('transacciones');

    // Borrar índice incorrecto si existe
    const indexes = await col.indexes();
    const bad = indexes.find(i => i.name === 'bloque_height_1');
    if (bad) {
      console.log('🗑  Eliminando índice incorrecto "bloque_height_1"...');
      await col.dropIndex('bloque_height_1');
      console.log('✓ Eliminado\n');
    } else {
      console.log('ℹ️  No se encontró "bloque_height_1", nada que eliminar\n');
    }

    // Crear índice correcto si no existe
    const hasBloque = indexes.find(i => i.name === 'bloque_1');
    if (!hasBloque) {
      console.log('⏳ Creando índice "bloque_1"...');
      await col.createIndex({ bloque: 1 }, { background: true });
      console.log('✓ Índice "bloque_1" creado\n');
    } else {
      console.log('✓ Índice "bloque_1" ya existe\n');
    }

    console.log('📇 Índices actuales:');
    const final = await col.indexes();
    final.forEach(i => console.log(`   ${i.name}: ${JSON.stringify(i.key)}`));

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
  }
}

fixIndices();
