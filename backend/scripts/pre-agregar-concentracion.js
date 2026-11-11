require('dotenv').config();

const { conectar } = require('../src/config/db');
const {
  concentracionEnVivo
} = require('../src/repositories/transaccionesRepository');

async function main() {
  const dia = process.argv[2];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) {
    throw new Error('Indica una fecha AAAA-MM-DD');
  }

  const desde = new Date(`${dia}T00:00:00.000Z`);

  if (Number.isNaN(desde.getTime()) ||
      desde.toISOString().slice(0, 10) !== dia) {
    throw new Error('Fecha inválida');
  }

  const hasta = new Date(desde.getTime() + 86400000);
  const db = await conectar();

  console.log(`Procesando concentración: ${dia}`);

  const resultado = await concentracionEnVivo({
    desde,
    hasta
  });

  if (!resultado.totalDirecciones ||
      !Array.isArray(resultado.top)) {
    throw new Error('El cálculo no devolvió resultados válidos');
  }

  // Guardar el resultado completo del día.
  await db.collection('vw_concentracion').replaceOne(
    { _id: dia },
    {
      _id: dia,
      fecha: desde,
      ...resultado,
      actualizadoEn: new Date()
    },
    { upsert: true }
  );

  // Marcar el día como completado después de guardar.
  await db.collection('vw_precalculo').updateOne(
    { tipo: 'concentracion', fecha: desde },
    {
      $set: {
        totalDirecciones: resultado.totalDirecciones,
        actualizadoEn: new Date()
      }
    },
    { upsert: true }
  );

  console.log('Direcciones:', resultado.totalDirecciones);
  console.log('Concentración top 1%:', resultado.pctTop1);
  console.log('Ranking guardado:', resultado.top.length);
  console.log('Precálculo completado');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
