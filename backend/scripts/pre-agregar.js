require('dotenv').config();
const { conectar } = require('../src/config/db');

async function preAgregar() {
  try {
    console.log('🔄 Iniciando pre-agregación...\n');
    const db = await conectar();
    
    // Crear colección de agregaciones diarias
    console.log('📊 Creando agregaciones diarias...');
    await db.collection('transacciones').aggregate([
      { $match: { es_coinbase: false } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
          transacciones:       { $sum: 1 },
          volumenBTC:          { $sum: '$total_salida' },
          comisionTotalBTC:    { $sum: '$comision' },
          comisionPromedioBTC: { $avg: '$comision' },
          tamVirtualPromedio:  { $avg: '$tam_virtual' },
          salidasPromedio:     { $avg: '$n_outputs' }
      } },
      { $project: {
          _id: 0,
          fecha: { $toDate: '$_id' },
          dia: '$_id',
          transacciones: 1,
          volumenBTC: 1,
          comisionTotalBTC: 1,
          comisionPromedioBTC: 1,
          tamVirtualPromedio: 1,
          salidasPromedio: 1
      } },
      { $merge: {
          into: 'agregaciones_diarias',
          whenMatched: 'replace',
          whenNotMatched: 'insert'
      } }
    ], { allowDiskUse: true }).toArray();

    // Crear índice
    await db.collection('agregaciones_diarias').createIndex({ fecha: 1 }, { background: true });
    
    const count = await db.collection('agregaciones_diarias').countDocuments();
    console.log(`✅ ${count} días agregados\n`);

    // Mostrar muestra
    const muestra = await db.collection('agregaciones_diarias')
      .find({})
      .sort({ fecha: -1 })
      .limit(5)
      .toArray();

    console.log('📅 Últimos 5 días:');
    muestra.forEach(d => {
      console.log(`   ${d.dia}: ${d.transacciones.toLocaleString()} txs, ${d.volumenBTC.toFixed(2)} BTC`);
    });

    console.log('\n✅ Pre-agregación completa');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

preAgregar();
