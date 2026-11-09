// ═══════════════════════════════════════════════════════════════════════════════
//  ÍNDICES PARA LA COLECCIÓN transacciones (31M+ documentos)
//  Ejecutar con:  mongosh --file database/indexes/crear_indices.js
// ═══════════════════════════════════════════════════════════════════════════════

const rdb = db.getSiblingDB('rastro');

print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('  Creación de índices — rastro.transacciones');
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ─── 1. Índice compuesto: es_coinbase + fecha ─────────────────────────────────
// El filtro más usado en TODOS los informes: { es_coinbase: false, fecha: { $gte, $lt } }
// Orden: es_coinbase (igualdad) primero, fecha (rango) después → óptimo para MongoDB.
print('1/8  idx_coinbase_fecha  { es_coinbase: 1, fecha: 1 }');
rdb.transacciones.createIndex(
  { es_coinbase: 1, fecha: 1 },
  { background: true, name: 'idx_coinbase_fecha' }
);

// ─── 2. Índice individual: fecha (ascendente) ──────────────────────────────────
// Sirve para consultas NL que filtran por fecha sin incluir es_coinbase.
print('2/8  idx_fecha_asc        { fecha: 1 }');
rdb.transacciones.createIndex(
  { fecha: 1 },
  { background: true, name: 'idx_fecha_asc' }
);

// ─── 3. Índice individual: fecha (descendente) ─────────────────────────────────
// Para consultas NL que ordenan por fecha descendente (más recientes primero).
print('3/8  idx_fecha_desc       { fecha: -1 }');
rdb.transacciones.createIndex(
  { fecha: -1 },
  { background: true, name: 'idx_fecha_desc' }
);

// ─── 4. Índice individual: bloque ─────────────────────────────────────────────
// Usado en el $group del informe 4 (Top Bloques) y consultas NL por bloque.
print('4/8  idx_bloque           { bloque: 1 }');
rdb.transacciones.createIndex(
  { bloque: 1 },
  { background: true, name: 'idx_bloque' }
);

// ─── 5. Índice: total_salida descendente ──────────────────────────────────────
// Informe 6 hace $sort { total_salida: -1 } + $limit 200 → el índice evita el
// sort en memoria: MongoDB recorre el índice en orden descendente y detiene
// después de 200 documentos.  También sirve para el benchmark "ballenas"
// ({ total_salida: { $gte: 100 } }).
print('5/8  idx_total_salida_desc { total_salida: -1 }');
rdb.transacciones.createIndex(
  { total_salida: -1 },
  { background: true, name: 'idx_total_salida_desc' }
);

// ─── 6. Índice: comision ─────────────────────────────────────────────────────
// Informe 6 tiene $or: [{ comision: { $gte: umbral } }, ...].  Este índice
// permite que MongoDB use un index scan para esa rama del $or en lugar de un
// collection scan.  También sirve para consultas NL sobre comisiones.
print('6/8  idx_comision          { comision: 1 }');
rdb.transacciones.createIndex(
  { comision: 1 },
  { background: true, name: 'idx_comision' }
);

// ─── 7. Índice multikey: outputs.dir ──────────────────────────────────────────
// El benchmark "historial_direccion" busca { 'outputs.dir': 'bc1q...' }.
// Como outputs es un array, MongoDB crea un índice multikey que indexa cada
// dirección de salida.  Sin este índice, MongoDB debe escanear 31M documentos.
print('7/8  idx_outputs_dir      { "outputs.dir": 1 }');
rdb.transacciones.createIndex(
  { 'outputs.dir': 1 },
  { background: true, name: 'idx_outputs_dir' }
);

// ─── 8. Índice: es_coinbase individual ────────────────────────────────────────
// Consultas NL que filtran solo por es_coinbase sin fecha.
print('8/8  idx_es_coinbase       { es_coinbase: 1 }');
rdb.transacciones.createIndex(
  { es_coinbase: 1 },
  { background: true, name: 'idx_es_coinbase' }
);

// ─── Resumen ──────────────────────────────────────────────────────────────────
print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('  Índices actuales en transacciones:');
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
rdb.transacciones.getIndexes().forEach(i => {
  print(`  ${i.name.padEnd(24)} ${JSON.stringify(i.key)}`);
});
print('');
