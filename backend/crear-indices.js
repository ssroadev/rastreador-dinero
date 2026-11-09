// Script para crear índices necesarios en la colección transacciones
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function crearIndices() {
  const client = new MongoClient(process.env.MONGO_URI);
  
  try {
    await client.connect();
    console.log('✓ Conectado a MongoDB\n');
    
    const db = client.db(process.env.MONGO_DB);
    const col = db.collection('transacciones');
    
    console.log('📇 Creando índices necesarios para los informes...\n');
    
    // Índice 1: fecha (usado en casi todos los informes para filtros de rango)
    console.log('⏳ Creando índice: fecha...');
    await col.createIndex({ fecha: 1 }, { background: true });
    console.log('✓ Índice "fecha" creado\n');
    
    // Índice 2: es_coinbase (para filtrar transacciones normales)
    console.log('⏳ Creando índice: es_coinbase...');
    await col.createIndex({ es_coinbase: 1 }, { background: true });
    console.log('✓ Índice "es_coinbase" creado\n');
    
    // Índice 3: bloque (usado en top bloques)
    console.log('⏳ Creando índice: bloque...');
    await col.createIndex({ bloque: 1 }, { background: true });
    console.log('✓ Índice "bloque" creado\n');
    
    // Índice 4: Compuesto fecha + es_coinbase (optimiza filtros comunes)
    console.log('⏳ Creando índice compuesto: fecha + es_coinbase...');
    await col.createIndex({ es_coinbase: 1, fecha: 1 }, { background: true });
    console.log('✓ Índice compuesto creado\n');
    
    // Índice 5: comision (usado en detección de atípicas)
    console.log('⏳ Creando índice: comision...');
    await col.createIndex({ comision: 1 }, { background: true });
    console.log('✓ Índice "comision" creado\n');
    
    // Índice 6: total_salida (usado en detección de atípicas)
    console.log('⏳ Creando índice: total_salida...');
    await col.createIndex({ total_salida: 1 }, { background: true });
    console.log('✓ Índice "total_salida" creado\n');
    
    // Índice 7: fecha descendente (para ultimas transacciones)
    console.log('⏳ Creando índice: fecha DESC...');
    await col.createIndex({ fecha: -1 }, { background: true });
    console.log('✓ Índice "fecha DESC" creado\n');
    
    // Mostrar todos los índices creados
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ÍNDICES FINALES:\n');
    const indexes = await col.indexes();
    indexes.forEach(idx => {
      console.log(`   ${idx.name}`);
      console.log(`   └─ ${JSON.stringify(idx.key)}\n`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Proceso completado. Los informes ahora serán MUCHO más rápidos.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

crearIndices();
