const { MongoClient } = require('mongodb');

let client;
async function conectar() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
  }
  return client.db(process.env.MONGO_DB);
}

/**
 * Crea (si no existe) la colección capped mempool_vivo.
 * Tamaño: ~50 MB · Máx: 50 000 documentos.
 * Los documentos antiguos se sobrescriben automáticamente.
 */
async function asegurarMempoolVivo() {
  const db = await conectar();
  const cols = await db.listCollections({ name: 'mempool_vivo' }).toArray();

  if (cols.length === 0) {
    await db.createCollection('mempool_vivo', {
      capped: true,
      size: 50 * 1024 * 1024, // 50 MB
      max: 50000,
    });
    console.log('✓ Colección capped "mempool_vivo" creada (50 MB / 50K docs)');
  } else if (!cols[0].options?.capped) {
    console.warn('⚠  "mempool_vivo" existe pero NO es capped. Considere eliminarla y recrear.');
  }
  // Índice en fecha para la consulta de últimas transacciones
  await db.collection('mempool_vivo').createIndex({ fecha: -1 }, { background: true });
}

/**
 * Conexión de solo lectura para pipelines generados por IA.
 * Si MONGO_READONLY_URI no está configurada, usa la conexión normal.
 * Crear un usuario de solo lectura en MongoDB:
 *   use admin
 *   db.createUser({ user: "lector", pwd: "...", roles: [{ role: "read", db: "rastro" }] })
 * Luego en .env:  MONGO_READONLY_URI=mongodb://lector:...@localhost:27017/?replicaSet=rs0&directConnection=true
 */
let clientRo;
async function conectarLectura() {
  const uri = process.env.MONGO_READONLY_URI;
  if (!uri) return conectar(); // sin URI de solo lectura, usar conexión normal
  if (!clientRo) {
    clientRo = new MongoClient(uri);
    await clientRo.connect();
  }
  return clientRo.db(process.env.MONGO_DB);
}

module.exports = { conectar, asegurarMempoolVivo, conectarLectura };