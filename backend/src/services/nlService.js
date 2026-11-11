const EJEMPLOS = (c) => [
`Pregunta: ¿Cuáles son los 5 días con más transacciones?
{"coleccion":"vw_diarias","pipeline":[{"$sort":{"tx":-1}},{"$limit":5},{"$project":{"_id":0,"dia":"$_id","transacciones":"$tx"}}]}`,
`Pregunta: ¿Cuál fue el volumen total en BTC por mes?
{"coleccion":"vw_diarias","pipeline":[{"$group":{"_id":{"$dateToString":{"format":"%Y-%m","date":"$fecha"}},"volumenBTC":{"$sum":"$volumen"}}},{"$sort":{"_id":1}},{"$project":{"_id":0,"mes":"$_id","volumenBTC":1}},{"$limit":1000}]}`,
`Pregunta: ¿Cuáles son los 10 bloques que más comisión pagaron?
{"coleccion":"vw_bloques","pipeline":[{"$sort":{"comision":-1}},{"$limit":10},{"$project":{"_id":0,"bloque":"$_id","comisionBTC":"$comision","transacciones":"$tx"}}]}`,
`Pregunta: ¿A qué hora del día (Bogotá) se pagan las comisiones más altas?
{"coleccion":"vw_horas","pipeline":[{"$group":{"_id":{"$hour":{"date":"$fecha","timezone":"America/Bogota"}},"tx":{"$sum":"$tx"},"sumTasa":{"$sum":"$sumTasa"}}},{"$project":{"_id":0,"hora":"$_id","tasaPromedioSatVb":{"$round":[{"$divide":["$sumTasa","$tx"]},2]}}},{"$sort":{"tasaPromedioSatVb":-1}},{"$limit":24}]}`,
`Pregunta: ¿Cuántas transacciones tuvieron más de 5 salidas en el último día?
{"coleccion":"transacciones","pipeline":[{"$match":{"fecha":{"$gte":"${c.ultima}","$lt":"${c.siguiente}"},"n_outputs":{"$gt":5}}},{"$count":"transacciones"},{"$limit":1}]}`,
`Pregunta: ¿Cuáles son las 10 transacciones de mayor monto del último día?
{"coleccion":"transacciones","pipeline":[{"$match":{"fecha":{"$gte":"${c.ultima}","$lt":"${c.siguiente}"},"es_coinbase":false}},{"$sort":{"total_salida":-1}},{"$limit":10},{"$project":{"_id":0,"txid":1,"fecha":1,"total_salida":1,"comision":1}}]}`,
`Pregunta: ¿Cuál fue el promedio de salidas por transacción en cada día registrado?
{"coleccion":"vw_diarias","pipeline":[{"$sort":{"fecha":1}},{"$project":{"_id":0,"dia":"$_id","promedioSalidas":{"$round":[{"$divide":["$salidas","$tx"]},2]}}},{"$limit":1000}]}`,
`Pregunta: ¿Cuáles son los 10 bloques con mayor tamaño virtual y cuántas transacciones contiene cada uno?
{"coleccion":"vw_bloques","pipeline":[{"$sort":{"tam":-1}},{"$limit":10},{"$project":{"_id":0,"bloque":"$_id","tamanoVirtualBytes":"$tam","transacciones":"$tx"}}]}`,
`Pregunta: ¿Cómo se distribuyen las transacciones por cantidad de salidas el último día?
{"coleccion":"vw_salidas","pipeline":[{"$match":{"fecha":{"$gte":"${c.ultima}","$lt":"${c.siguiente}"}}},{"$group":{"_id":"$rango","transacciones":{"$sum":"$tx"},"orden":{"$first":"$orden"}}},{"$sort":{"orden":1}},{"$project":{"_id":0,"rangoSalidas":"$_id","transacciones":1}},{"$limit":1000}]}`,
];

const ejemplosPara = (c, compacto) => {
  const todos = EJEMPLOS(c);
  const sel = compacto ? [0, 3, 4, 6] : todos.map((_, i) => i);
  return 'EJEMPLOS\n' + sel.map((i) => todos[i]).join('\n\n') + '\n';
};

const ESQUEMA = (c, compacto = false) => `
Eres un experto en MongoDB. Traduce la pregunta del usuario a UN Aggregation Pipeline de solo lectura.
Hoy es ${c.hoy}. Los datos van de ${c.primera} a ${c.ultima} (último día con datos: ${c.ultima}).
"Ayer", "esta semana", "el último mes", etc. deben calcularse respecto a ${c.ultima}, NO respecto a hoy.

COLECCIONES PERMITIDAS (elige UNA). Prefiere SIEMPRE las vw_* (pequeñas, instantáneas) cuando
la pregunta sea sobre totales/promedios por día, hora, bloque o rango de salidas:

1) vw_diarias  — una fila por día.
   _id:"YYYY-MM-DD", fecha:Date, tx:nº de transacciones, volumen:BTC, comision:BTC (suma), tam:vbytes (suma), salidas:nº de outputs (suma)
2) vw_horas    — una fila por hora.
   _id:"YYYY-MM-DDTHH", fecha:Date, tx, volumen, comision, tam, salidas, sumTasa (suma de sat/vB; tasa media = sumTasa/tx)
3) vw_bloques  — una fila por bloque.
   _id:altura del bloque, fecha:Date, tx, comision:BTC, volumen:BTC, tam
4) vw_salidas  — transacciones agrupadas por nº de salidas y día.
   _id:"YYYY-MM-DD|k", fecha:Date, rango:string, orden:number, tx, comision, volumen
5) transacciones — una fila por transacción (decenas de millones; úsala SOLO para preguntas sobre
   transacciones individuales, direcciones o campos que no existan en las vw_*).
   txid:string, fecha:Date, bloque:number, total_salida:BTC, comision:BTC, n_inputs, n_outputs,
   tam_virtual:vbytes, es_coinbase:boolean,
   inputs:[{dir,valor,tx_prev,idx_prev}], outputs:[{dir,valor,tipo,idx}]

REGLAS
- Etapas permitidas: $match, $group, $sort, $limit, $project, $unwind, $bucket, $count, $addFields, $set.
  PROHIBIDO: $function, $accumulator, $where, $out, $merge, $lookup, $graphLookup, $unionWith y cualquier escritura.
- El campo fecha es BSON Date en TODAS las colecciones. En la salida JSON, escribe las fechas
  del $match como cadenas ISO "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ssZ": el backend las convierte
  a Date ANTES de enviarlas a MongoDB. NO compares fechas como strings sin conversión.
- Al filtrar un día UTC usa fecha >= día y fecha < día siguiente. Si la pregunta exige una
  fecha LOCAL de Bogotá (UTC-5), desplaza los límites cinco horas: díaT05:00:00Z y
  díaSiguienteT05:00:00Z. Para agrupar horas locales, usa timezone "America/Bogota".
- Para vw_salidas, usa el campo "rango", agrupa con {$sum:"$tx"}; NO existe un documento
  por transacción en esa colección. Para vw_horas utiliza "tx" (no "transacciones").
- Para promedios a partir de vw_diarias: salidas/tx, comision/tx, volumen/tx.
- No confundas "tam" (suma de bytes virtuales) con comisiones ni "sumTasa" con volumen.
- En "transacciones" el PRIMER $match debe acotar "fecha" con $gte y $lt, y evita $unwind en rangos > 2 días.
- Termina SIEMPRE con $limit (máx. 1000). Da nombres de campo legibles en $project (sin _id).
- Responde SOLO un objeto JSON: {"coleccion":"<nombre>","pipeline":[...]}. Sin explicaciones ni code fences.

${ejemplosPara(c, compacto)}`.trim();

function error(msg, status) { const e = new Error(msg); e.status = status; return e; }

// ─── Proveedores ──────────────────────────────────────────────────────────────
const DEFAULTS = {
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-1.5-flash', timeout: 25000, compacto: false },
  groq:   { baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', timeout: 25000, compacto: false },
  openai: { baseURL: undefined, model: 'gpt-4o-mini', timeout: 25000, compacto: false },
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'qwen2.5-coder:3b', timeout: 120000, compacto: true, apiKey: 'ollama' },
};

function proveedores() {
  const lista = (process.env.LLM_PROVIDERS || 'gemini,ollama').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const out = [];
  for (const nombre of lista) {
    const d = DEFAULTS[nombre];
    if (!d) continue;
    const N = nombre.toUpperCase();
    const apiKey = process.env[`${N}_API_KEY`] || d.apiKey;
    if (!apiKey) continue;                                        // sin clave → se omite
    out.push({
      nombre, apiKey,
      baseURL: process.env[`${N}_BASE_URL`] || d.baseURL,
      model:   process.env[`${N}_MODEL`] || d.model,
      timeout: Number(process.env[`${N}_TIMEOUT_MS`]) || d.timeout,
      compacto: d.compacto,
    });
  }
  return out;
}

const clientes = new Map();
async function getCliente(p) {
  if (!clientes.has(p.nombre)) {
    const { default: OpenAI } = await import('openai');
    clientes.set(p.nombre, new OpenAI({ apiKey: p.apiKey, baseURL: p.baseURL, timeout: p.timeout, maxRetries: 0 }));
  }
  return clientes.get(p.nombre);
}

function extraerJSON(raw) {
  const limpio = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(limpio); } catch { /* intento tolerante */ }
  const i = limpio.search(/[{[]/);
  const j = Math.max(limpio.lastIndexOf('}'), limpio.lastIndexOf(']'));
  if (i >= 0 && j > i) return JSON.parse(limpio.slice(i, j + 1));
  throw new Error('sin JSON');
}

async function pedir(client, params) {
  try {
    return await client.chat.completions.create({ ...params, response_format: { type: 'json_object' } });
  } catch (e) {
    if (e.status === 400) return client.chat.completions.create(params);
    throw e;
  }
}

function describirFallo(e) {
  if (e.status === 429) return 'límite de peticiones alcanzado';
  if (e.status === 401 || e.status === 403) return 'clave inválida o sin permisos';
  if (e.name === 'APIConnectionTimeoutError') return 'tiempo de espera agotado';
  if (e.name === 'APIConnectionError' || /ECONNREFUSED|fetch failed|connection error/i.test(e.message)) return 'no se pudo conectar';
  return e.message;
}

async function intentar(p, pregunta, ctx, repara) {
  const client = await getCliente(p);
  const messages = [
    { role: 'system', content: ESQUEMA(ctx, p.compacto) },
    { role: 'user', content: pregunta },
  ];
  if (repara) {
    messages.push({ role: 'assistant', content: repara.anterior });
    messages.push({ role: 'user', content:
      `Ese pipeline falló: ${repara.error}\nCorrígelo y responde de nuevo SOLO con el JSON {"coleccion":...,"pipeline":[...]}.` });
  }
  const completion = await pedir(client, { model: p.model, temperature: 0, max_tokens: 1600, messages });
  const raw = completion.choices?.[0]?.message?.content ?? '';

  let obj;
  try { obj = extraerJSON(raw); }
  catch { const e = error('La IA devolvió una respuesta que no es JSON válido.', 422); e.raw = raw; throw e; }

  // Tolera que el modelo devuelva solo el array (asume `transacciones`)
  const coleccion = Array.isArray(obj) ? 'transacciones' : obj.coleccion;
  const pipeline  = Array.isArray(obj) ? obj : obj.pipeline;
  if (typeof coleccion !== 'string' || !Array.isArray(pipeline)) {
    const e = error('La IA no devolvió {coleccion, pipeline}.', 422); e.raw = raw; throw e;
  }
  return { coleccion, pipeline, raw };
}

/**
 * @param {string} pregunta
 * @param {object} ctx      salida de nlRepository.contextoDatos()
 * @param {{anterior:string,error:string}} [repara]  si el intento previo falló, se le muestra el error a la IA
 * @returns {{coleccion, pipeline, raw, proveedor, modelo, fallos:[{proveedor,motivo}]}}
 */
async function generar(pregunta, ctx, repara) {
  const lista = proveedores();
  if (!lista.length) {
    throw error('Lenguaje natural sin configurar: define GEMINI_API_KEY (o instala Ollama) y LLM_PROVIDERS en backend/.env', 503);
  }
  const fallos = [];
  let primero;
  for (const p of lista) {
    try {
      const r = await intentar(p, pregunta, ctx, repara);
      return { ...r, proveedor: p.nombre, modelo: p.model, fallos };
    } catch (primerError) {

      let e = primerError;
      if (e.status === 422) {
        try {
          const r = await intentar(p, pregunta, ctx, {
            anterior: String(e.raw || '').slice(0, 2400),
            error: 'La respuesta anterior no fue JSON válido. Devuelve únicamente un objeto JSON completo con coleccion y pipeline. No añadas texto ni bloques Markdown.',
          });
          return { ...r, proveedor: p.nombre, modelo: p.model, fallos };
        } catch (segundoError) {
          e = segundoError;
        }
      }
      primero ??= e;
      fallos.push({ proveedor: p.nombre, motivo: describirFallo(e) });
      console.warn(`⚠ NL: ${p.nombre} falló (${describirFallo(e)})${lista.length > 1 ? ' → probando el siguiente' : ''}`);
    }
  }
  if (primero.status === 429) throw error('Se alcanzó el límite de peticiones de la IA y no hay respaldo disponible. Espera un minuto.', 429);
  if (primero.status === 422) throw primero;
  throw error(`No se pudo obtener respuesta de la IA (${fallos.map((f) => `${f.proveedor}: ${f.motivo}`).join('; ')})`, 502);
}

module.exports = { generar, proveedores };
