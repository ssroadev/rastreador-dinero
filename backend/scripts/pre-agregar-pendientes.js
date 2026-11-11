
require('dotenv').config();

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { conectar } = require('../src/config/db');

async function main() {
  const db = await conectar();

  const disponibles = await db.collection('vw_diarias')
    .find({}, { projection: { _id: 1 } })
    .toArray();

  const procesados = await db.collection('vw_precalculo')
    .find({ tipo: 'fragmentacion' })
    .toArray();

  const completados = new Set(
    procesados.map(r =>
      new Date(r.fecha).toISOString().slice(0, 10)
    )
  );

  const pendientes = disponibles
    .map(d => d._id)
    .filter(d => !completados.has(d))
    .sort();

  console.log('Días pendientes:', pendientes.length);

  const script = path.join(
    __dirname,
    'pre-agregar-fragmentacion.js'
  );

  for (const [indice, dia] of pendientes.entries()) {
    console.log(
      `\n[${indice + 1}/${pendientes.length}] Procesando ${dia}`
    );

    const resultado = spawnSync(
      process.execPath,
      [script, dia],
      { stdio: 'inherit' }
    );

    if (resultado.error || resultado.status !== 0) {
      throw new Error(`Falló el procesamiento de ${dia}`);
    }
  }

  console.log('\nTodos los días pendientes fueron procesados.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error.message);
    process.exit(1);
  });
