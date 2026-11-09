require('dotenv').config();
const { conectar } = require('../src/config/db');

async function crearVistas() {
  try {
    console.log('🔄 Creando vistas materializadas...\n');
    const db = await conectar();

    // 1. AGREGACIONES DIARIAS (para Indicadores, Evolución, etc.)
    console.log('📊 Vista 1: Agregaciones diarias...');
    await db.collection('transacciones').aggregate([
      { $match: { es_coinbase: false } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
          transacciones: { $sum: 1 },
          volumenBTC: { $sum: '$total_salida' },
          comisionTotalBTC: { $sum: '$comision' },
          comisionPromedioBTC: { $avg: '$comision' },
          tamVirtualPromedio: { $avg: '$tam_virtual' },
          salidasPromedio: { $avg: '$n_outputs' },
          minFecha: { $min: '$fecha' },
          maxFecha: { $max: '$fecha' }
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
          salidasPromedio: 1,
          minFecha: 1,
          maxFecha: 1
      } },
      { $merge: {
          into: 'vw_diarias',
          whenMatched: 'replace',
          whenNotMatched: 'insert'
      } }
    ], { allowDiskUse: true, maxTimeMS: 180000 }).toArray();

    await db.collection('vw_diarias').createIndex({ fecha: -1 });
    const countDiarias = await db.collection('vw_diarias').countDocuments();
    console.log(`   ✅ ${countDiarias} días agregados\n`);

    // 2. COMISIONES POR HORA (Mapa de calor)
    console.log('🔥 Vista 2: Comisiones por hora/día...');
    await db.collection('transacciones').aggregate([
      { $match: { es_coinbase: false, comision: { $ne: null }, tam_virtual: { $gt: 0 } } },
      { $group: {
          _id: { dia: { $dayOfWeek: '$fecha' }, hora: { $hour: '$fecha' } },
          transacciones: { $sum: 1 },
          tasaPromedioSatVb: { $avg: {
            $divide: [ { $multiply: ['$comision', 100000000] }, '$tam_virtual' ]
          } }
      } },
      { $project: {
          _id: 0,
          dia: '$_id.dia',
          hora: '$_id.hora',
          transacciones: 1,
          tasaPromedioSatVb: { $round: ['$tasaPromedioSatVb', 2] }
      } },
      { $merge: {
          into: 'vw_comisiones_hora',
          whenMatched: 'replace',
          whenNotMatched: 'insert'
      } }
    ], { allowDiskUse: true, maxTimeMS: 180000 }).toArray();

    await db.collection('vw_comisiones_hora').createIndex({ dia: 1, hora: 1 });
    const countHora = await db.collection('vw_comisiones_hora').countDocuments();
    console.log(`   ✅ ${countHora} celdas hora/día\n`);

    // 3. DISTRIBUCIÓN DE MONTOS (por rangos de BTC)
    console.log('💰 Vista 3: Distribución de montos...');
    await db.collection('transacciones').aggregate([
      { $match: { es_coinbase: false } },
      { $bucket: {
          groupBy: '$total_salida',
          boundaries: [0, 0.01, 0.1, 1, 10, 100, 1000, 10000],
          default: '10000+',
          output: {
            transacciones: { $sum: 1 },
            volumenTotal: { $sum: '$total_salida' }
          }
      } },
      { $project: {
          _id: 0,
          rango: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 0] }, then: '0 - 0.01 BTC' },
                { case: { $eq: ['$_id', 0.01] }, then: '0.01 - 0.1 BTC' },
                { case: { $eq: ['$_id', 0.1] }, then: '0.1 - 1 BTC' },
                { case: { $eq: ['$_id', 1] }, then: '1 - 10 BTC' },
                { case: { $eq: ['$_id', 10] }, then: '10 - 100 BTC' },
                { case: { $eq: ['$_id', 100] }, then: '100 - 1000 BTC' },
                { case: { $eq: ['$_id', 1000] }, then: '1000 - 10000 BTC' }
              ],
              default: '10000+ BTC'
            }
          },
          transacciones: 1,
          volumenTotal: 1
      } },
      { $merge: {
          into: 'vw_distribucion',
          whenMatched: 'replace',
          whenNotMatched: 'insert'
      } }
    ], { allowDiskUse: true, maxTimeMS: 180000 }).toArray();

    const countDist = await db.collection('vw_distribucion').countDocuments();
    console.log(`   ✅ ${countDist} rangos de distribución\n`);

    // 4. TOP BLOQUES POR COMISIONES
    console.log('🏗️  Vista 4: Top bloques...');
    await db.collection('transacciones').aggregate([
      { $match: { es_coinbase: false, bloque: { $ne: null } } },
      { $group: {
          _id: '$bloque',
          transacciones: { $sum: 1 },
          comisionTotalBTC: { $sum: '$comision' },
          volumenBTC: { $sum: '$total_salida' },
          fecha: { $min: '$fecha' }
      } },
      { $sort: { comisionTotalBTC: -1 } },
      { $limit: 100 },
      { $project: {
          _id: 0,
          bloque: '$_id',
          transacciones: 1,
          comisionTotalBTC: 1,
          volumenBTC: 1,
          fecha: 1
      } },
      { $merge: {
          into: 'vw_top_bloques',
          whenMatched: 'replace',
          whenNotMatched: 'insert'
      } }
    ], { allowDiskUse: true, maxTimeMS: 180000 }).toArray();

    await db.collection('vw_top_bloques').createIndex({ comisionTotalBTC: -1 });
    const countTop = await db.collection('vw_top_bloques').countDocuments();
    console.log(`   ✅ ${countTop} bloques en top\n`);

    // 5. RESUMEN MENSUAL
    console.log('📅 Vista 5: Resumen mensual...');
    await db.collection('transacciones').aggregate([
      { $match: { es_coinbase: false } },
      { $group: {
          _id: {
            año: { $year: '$fecha' },
            mes: { $month: '$fecha' }
          },
          transacciones: { $sum: 1 },
          volumenBTC: { $sum: '$total_salida' },
          comisionTotalBTC: { $sum: '$comision' },
          comisionPromedioBTC: { $avg: '$comision' }
      } },
      { $sort: { '_id.año': -1, '_id.mes': -1 } },
      { $project: {
          _id: 0,
          mes: {
            $concat: [
              { $toString: '$_id.año' },
              '-',
              { $cond: {
                  if: { $lt: ['$_id.mes', 10] },
                  then: { $concat: ['0', { $toString: '$_id.mes' }] },
                  else: { $toString: '$_id.mes' }
              } }
            ]
          },
          transacciones: 1,
          volumenBTC: 1,
          comisionTotalBTC: 1,
          comisionPromedioBTC: 1
      } },
      { $merge: {
          into: 'vw_mensual',
          whenMatched: 'replace',
          whenNotMatched: 'insert'
      } }
    ], { allowDiskUse: true, maxTimeMS: 180000 }).toArray();

    const countMes = await db.collection('vw_mensual').countDocuments();
    console.log(`   ✅ ${countMes} meses\n`);

    console.log('✅ Todas las vistas creadas correctamente\n');
    console.log('📍 Colecciones creadas:');
    console.log('   - vw_diarias');
    console.log('   - vw_comisiones_hora');
    console.log('   - vw_distribucion');
    console.log('   - vw_top_bloques');
    console.log('   - vw_mensual\n');
    console.log('💡 Las queries ahora serán instantáneas');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

crearVistas();
