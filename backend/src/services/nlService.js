/**
 * Servicio de Lenguaje Natural
 * Convierte una pregunta en texto a un Aggregation Pipeline de MongoDB.
 *
 * Requiere OPENAI_API_KEY en .env  (o ANTHROPIC_API_KEY si se usa Claude).
 * Si la clave no está configurada, lanza un error descriptivo.
 */

const SCHEMA_CONTEXT = `
Colección: transacciones
Campos disponibles:
  - txid: string (hash de la transacción)
  - fecha: Date (timestamp UTC)
  - bloque: number
  - total_salida: number (BTC, suma de outputs)
  - comision: number (BTC)
  - n_inputs: number
  - n_outputs: number
  - tam_virtual: number (vbytes)
  - es_coinbase: boolean
  - inputs: array de { dir: string, valor: number (BTC), tx_prev: string, idx_prev: number }
  - outputs: array de { dir: string, valor: number (BTC), tipo: string, idx: number }

Etapas permitidas: $match, $group, $sort, $limit, $project, $unwind, $bucket, $count
No se permiten: $addFields, $function, $accumulator, $out, $merge, $lookup,
  $graphLookup, $unionWith, $where, ni ninguna etapa de escritura.
IMPORTANTE: En $match, el campo fecha es de tipo Date. Usa fechas ISO 8601
  como strings (ej: "2026-11-01") en $gte/$lt y el servidor las convertirá
  a Date automáticamente.
Acota SIEMPRE el primer $match con un rango de fecha (la colección tiene decenas de
  millones de documentos y la consulta se cancela a los 20 s). Si no lo haces, el servidor
  añade una ventana de los últimos 7 días. Evita $unwind sobre rangos de más de 2 días.
Incluye siempre $limit al final (máx 1000 filas).
Devuelve SÓLO el array JSON del pipeline, sin explicaciones ni código fence.
`.trim();

async function generarPipeline(pregunta) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const e = new Error(
      'OPENAI_API_KEY no configurada. Agrega la clave en backend/.env para usar lenguaje natural.'
    );
    e.status = 503;
    throw e;
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Eres un experto en MongoDB. ' + SCHEMA_CONTEXT +
          '\nResponde ÚNICAMENTE con el JSON array del pipeline. Sin código fence ni explicaciones.'
      },
      { role: 'user', content: pregunta }
    ]
  });

  const raw = completion.choices[0].message.content.trim();

  // Limpia posibles code fences
  const json = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();

  let pipeline;
  try {
    pipeline = JSON.parse(json);
  } catch {
    const e = new Error('La IA devolvió un pipeline inválido. Intenta reformular la pregunta.');
    e.status = 422;
    throw e;
  }

  if (!Array.isArray(pipeline)) {
    const e = new Error('El pipeline generado no es un array válido.');
    e.status = 422;
    throw e;
  }

  return pipeline;
}

module.exports = { generarPipeline };
