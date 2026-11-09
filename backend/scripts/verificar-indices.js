require('dotenv').config();
const { conectar } = require('../src/config/db');

async function verificarIndices() {
  try {
    console.log('Conectando a MongoDB...');
    const db = await conectar();
    const col = db.collection('transacciones');

    // Verificar cantidad de documentos
    const count = await col.countDocuments();
    console.log(`\n📊 Total de transacciones: ${count.toLocaleString()}`);

    if (count === 0) {
      console.log('\n⚠️  La colección está vacía. Ejecuta el ETL primero.');
      process.exit(0);
    }

    // Verificar rango de fechas
    const [primera] = await col.find({ es_coinbase: false }).sort({ fecha: 1 }).limit(1).toArray();
    const [ultima] = await col.find({ es_coinbase: false }).sort({ fecha: -1 }).limit(1).toArray();
    
    if (primera && ultima) {
      console.log(`📅 Rango de fechas: ${primera.fecha?.toISOString().split('T')[0]} → ${ultima.fecha?.toISOString().split('T')[0]}`);
    }

    // Verificar índices existentes
    const indices = await col.indexes();
    console.log(`\n🔍 Índices existentes (${indices.length}):`);
    indices.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Crear índices necesarios si no existen
    console.log('\n🔨 Creando índices necesarios...');

    const indicesNecesarios = [
      { key: { es_coinbase: 1, fecha: 1 }, name: 'idx_fecha_coinbase' },
      { key: { fecha: 1 }, name: 'idx_fecha' },
      { key: { bloque: 1 }, name: 'idx_bloque' },
      { key: { total_salida: 1 }, name: 'idx_total_salida' },
      { key: { comision: 1 }, name: 'idx_comision' },
      { key: { n_outputs: 1 }, name: 'idx_n_outputs' },
    ];

    for (const indice of indicesNecesarios) {
      try {
        await col.createIndex(indice.key, { 
          name: indice.name, 
          background: true 
        });
        console.log(`  ✓ ${indice.name}`);
      } catch (e) {
        if (e.code === 85 || e.message.includes('already exists')) {
          console.log(`  → ${indice.name} (ya existe)`);
        } else {
          console.log(`  ✗ ${indice.name}: ${e.message}`);
        }
      }
    }

    // Verificar si hay muchos coinbase que ralenticen las queries
    const coinbaseCount = await col.countDocuments({ es_coinbase: true });
    console.log(`\n💰 Transacciones coinbase: ${coinbaseCount.toLocaleString()} (${(coinbaseCount/count*100).toFixed(2)}%)`);

    // Test de velocidad de una query simple
    console.log('\n⚡ Test de velocidad...');
    const start = Date.now();
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);
    
    const testCount = await col.countDocuments({ 
      es_coinbase: false,
      fecha: { $gte: hace7dias }
    });
    const tiempo = Date.now() - start;
    
    console.log(`  Query "últimos 7 días": ${testCount.toLocaleString()} docs en ${tiempo}ms`);
    
    if (tiempo > 5000) {
      console.log(`  ⚠️  Query muy lenta (>${tiempo/1000}s). Los índices pueden estar construyéndose.`);
    }

    console.log('\n✅ Verificación completa');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarIndices();
