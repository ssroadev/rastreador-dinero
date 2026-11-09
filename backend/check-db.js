// Script para verificar el estado de la base de datos
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkDB() {
  const client = new MongoClient(process.env.MONGO_URI);
  
  try {
    await client.connect();
    console.log('✓ Conexión exitosa a MongoDB');
    
    const db = client.db(process.env.MONGO_DB);
    console.log(`\n📊 Base de datos: ${process.env.MONGO_DB}`);
    
    // Listar colecciones
    const collections = await db.listCollections().toArray();
    console.log(`\n📁 Colecciones encontradas: ${collections.length}`);
    collections.forEach(c => console.log(`   - ${c.name}`));
    
    // Verificar colección 'transacciones'
    const colExists = collections.some(c => c.name === 'transacciones');
    
    if (colExists) {
      // Usar estimatedDocumentCount que es mucho más rápido
      console.log('\n🔍 Contando documentos (estimado)...');
      const count = await db.collection('transacciones').estimatedDocumentCount();
      console.log(`💰 Documentos en 'transacciones': ${count.toLocaleString()}`);
      
      if (count > 0) {
        // Mostrar una muestra SIN filtros (más rápido)
        console.log('\n🔍 Buscando documento de muestra...');
        const sample = await db.collection('transacciones').findOne({}, { maxTimeMS: 5000 });
        console.log('\n📄 Documento de muestra:');
        console.log(JSON.stringify(sample, null, 2));
        
        // Verificar índices
        console.log('\n📇 Índices en la colección:');
        const indexes = await db.collection('transacciones').indexes();
        indexes.forEach(idx => {
          console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
      } else {
        console.log('\n⚠️  La colección existe pero está VACÍA');
      }
    } else {
      console.log('\n❌ La colección "transacciones" NO EXISTE');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkDB();
