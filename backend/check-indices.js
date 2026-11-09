require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkIndices() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB);
    const col = db.collection('transacciones');
    
    console.log('📇 Índices actuales:\n');
    const indexes = await col.indexes();
    indexes.forEach((idx, i) => {
      console.log(`${i + 1}. ${idx.name}`);
      console.log(`   Keys: ${JSON.stringify(idx.key)}`);
      console.log(`   Background: ${idx.background || false}\n`);
    });
    
    // Verificar operaciones en curso
    const admin = db.admin();
    const ops = await admin.command({ currentOp: true, $all: true });
    const indexOps = ops.inprog.filter(op => op.command && op.command.createIndexes);
    
    if (indexOps.length > 0) {
      console.log('⏳ Operaciones de creación de índices en curso:');
      indexOps.forEach(op => {
        console.log(`   - ${op.desc}: ${op.msg || 'en progreso'}`);
      });
    } else {
      console.log('✓ No hay operaciones de índices en curso');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkIndices();
