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
  - bloque_height: number
  - total_salida: number (BTC, suma de outputs)
  - comision: number (BTC)
  - n_inputs: number
  - n_outputs: number
  - tam_virtual: number (vbytes)
  - es_coinbase: boolean

Etapas permitidas: $match, $group, $sort, $limit, $project, $unwind, $bucket, $addFields, $count
No se permiten: $out, $merge, $lookup, $graphLookup, $unionWith, ni operaciones de escritura.
Devuelve SÓLO el array JSON del pipeline, sin explicaciones.
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
