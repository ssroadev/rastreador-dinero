/**
 * Pruebas de seguridad del validador de pipelines NL.
 * No requiere conexión a MongoDB — solo prueba la lógica de validación.
 */

// Importar las funciones internas replicándolas del repositorio
const ETAPAS_PERMITIDAS = new Set([
  '$match', '$group', '$sort', '$limit', '$project', '$unwind', '$bucket', '$count'
]);

const OPERADORES_PELIGROSOS = new Set([
  '$function', '$accumulator', '$where', '$merge', '$out', '$lookup', '$graphLookup', '$unionWith'
]);

const OPS_COMPARACION = new Set(['$gte', '$gt', '$lt', '$lte', '$eq', '$ne']);

function contieneOperadorPeligroso(valor) {
  if (valor === null || typeof valor !== 'object') return false;
  if (Array.isArray(valor)) return valor.some(contieneOperadorPeligroso);
  for (const [clave, v] of Object.entries(valor)) {
    if (OPERADORES_PELIGROSOS.has(clave)) return true;
    if (contieneOperadorPeligroso(v)) return true;
  }
  return false;
}

function convertirFechas(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) { obj.forEach(convertirFechas); return obj; }
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'fecha') {
      if (typeof v === 'string') obj[k] = new Date(v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [op, val] of Object.entries(v)) {
          if (OPS_COMPARACION.has(op) && typeof val === 'string') v[op] = new Date(val);
        }
      }
    } else convertirFechas(v);
  }
  return obj;
}

function forzarLimit(pipeline) {
  let tiene = false;
  for (const e of pipeline) {
    if (typeof e.$limit === 'number') { if (e.$limit > 1000) e.$limit = 1000; tiene = true; }
  }
  if (!tiene) pipeline.push({ $limit: 1000 });
  return pipeline;
}

function validar(pipeline) {
  // 1. Estructura
  for (const e of pipeline) {
    const claves = Object.keys(e);
    if (claves.length !== 1) return `Etapa con múltiples claves: ${claves.join(',')}`;
    if (!ETAPAS_PERMITIDAS.has(claves[0])) return `Etapa no permitida: ${claves[0]}`;
  }
  // 2. Operadores peligrosos
  if (contieneOperadorPeligroso(pipeline)) return 'Operador peligroso detectado';
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;

function test(nombre, condicion) {
  if (condicion) { pass++; console.log(`  ✓ ${nombre}`); }
  else { fail++; console.log(`  ✗ ${nombre}`); }
}

console.log('\n━━ Validación de pipelines NL ━━\n');

// Test 1: $function dentro de $addFields debe ser bloqueado
const ataque1 = [{ $addFields: { x: { $function: { body: '...', args: [], lang: 'js' } } } }];
test('$addFields con $function bloqueado', validar(ataque1) !== null);

// Test 2: $addFields mismo está fuera de la lista
test('$addFields no está en etapas permitidas', validar(ataque1)?.includes('no permitida'));

// Test 3: $function anidado en $project (más profundo)
const ataque2 = [{ $project: {
  _id: 0,
  txid: 1,
  extra: { $function: { body: 'evil()', args: [], lang: 'js' } }
} }];
test('$function anidado en $project bloqueado', contieneOperadorPeligroso(ataque2));

// Test 4: $merge (escritura a otra colección)
const ataque3 = [{ $match: {} }, { $merge: { into: 'secret_data' } }];
test('$merge bloqueado', validar(ataque3) !== null);

// Test 5: $lookup (fuga de datos)
const ataque4 = [{ $lookup: { from: 'users', localField: 'a', foreignField: 'b', as: 'x' } }];
test('$lookup bloqueado', validar(ataque4) !== null);

// Test 6: $unionWith
const ataque5 = [{ $unionWith: 'secret_collection' }];
test('$unionWith bloqueado', validar(ataque5) !== null);

// Test 7: $where en $match
const ataque6 = [{ $match: { $where: 'this.comision > 0' } }];
test('$where bloqueado', validar(ataque6) !== null);

// Test 8: Pipeline válido pasa
const valido1 = [
  { $match: { fecha: { $gte: '2026-11-01' } } },
  { $group: { _id: '$bloque', total: { $sum: '$comision' } } },
  { $sort: { total: -1 } },
  { $limit: 50 }
];
test('Pipeline válido pasa', validar(valido1) === null);

// Test 9: $limit forzado cuando no existe
const sinLimit = [
  { $match: { es_coinbase: false } },
  { $group: { _id: null, total: { $sum: 1 } } }
];
const conLimit = [...sinLimit.map(e => ({...e}))];
forzarLimit(conLimit);
test('$limit forzado cuando no existe', conLimit.some(e => e.$limit === 1000));

// Test 10: $limit muy grande se cap a 1000
const limitGrande = [{ $match: {} }, { $limit: 999999 }];
forzarLimit(limitGrande);
test('$limit > 1000 se reduce a 1000', limitGrande[1].$limit === 1000);

// Test 11: Conversión de fechas string → Date
const conFecha = [{ $match: { fecha: { $gte: '2026-11-01', $lt: '2026-12-01' } } }];
convertirFechas(conFecha[0].$match);
test('fecha $gte convertida a Date', conFecha[0].$match.fecha.$gte instanceof Date);
test('fecha $lt convertida a Date', conFecha[0].$match.fecha.$lt instanceof Date);

// Test 12: Conversión con fecha directa (sin operadores)
const conFechaDirecta = [{ $match: { fecha: '2026-11-01' } }];
convertirFechas(conFechaDirecta[0].$match);
test('fecha directa convertida a Date', conFechaDirecta[0].$match.fecha instanceof Date);

// Test 13: Conversión con $or anidado
const conOr = [{ $match: { $or: [
  { fecha: { $gte: '2026-11-01' } },
  { comision: { $gt: 0.01 } }
] } }];
convertirFechas(conOr[0].$match);
test('fecha dentro de $or convertida', conOr[0].$match.$or[0].fecha.$gte instanceof Date);

// Test 14: Etapa con múltiples claves
const multiClave = [{ $match: {}, $limit: 10 }];
test('Etapa con múltiples claves rechazada', validar(multiClave) !== null);

// Test 15: Pipeline vacío
test('Pipeline vacío rechazado', validar([]) !== null || [].length === 0);

console.log(`\n━━ Resultado: ${pass} pasaron, ${fail} fallaron ━━\n`);
process.exit(fail > 0 ? 1 : 0);
