require('dotenv').config();

const { conectar } = require('../src/config/db');
const {
  fragmentacionEnVivo
} = require('../src/repositories/transaccionesRepository');

async function main() {
  const dia = process.argv[2];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) {
    throw new Error('Indica una fecha AAAA-MM-DD');
  }

  const desde = new Date(`${dia}T00:00:00.000Z`);
  const hasta = new Date(desde.getTime() + 86400000);

  if (Number.isNaN(desde.getTime())) {
    throw new Error('Fecha inválida');
  }

  const db = await conectar();

  console.log(`Procesando fragmentación: ${dia}`);

  const resultados = await fragmentacionEnVivo({
    desde,
    hasta
  });

  const vista = db.collection('vw_fragmentacion');

  // Invalidar el precálculo anterior antes de reemplazarlo.
  await db.collection('vw_precalculo').deleteOne({
    tipo: 'fragmentacion',
    fecha: desde
  });

  await vista.deleteMany({
    fecha: { $gte: desde, $lt: hasta }
  });

  if (resultados.length > 0) {
    await vista.insertMany(resultados);
  }

  await vista.createIndex({ fecha: 1 });

  // Marcar el día como procesado únicamente al finalizar.
  await db.collection('vw_precalculo').updateOne(
    { tipo: 'fragmentacion', fecha: desde },
    {
      $set: {
        total: resultados.length,
        actualizadoEn: new Date()
      }
    },
    { upsert: true }
  );

  console.log('Registros guardados:', resultados.length);
  console.log('Precálculo completado');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error.message);
    process.exit(1);
  });
