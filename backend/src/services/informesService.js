const repo = require('../repositories/transaccionesRepository');
const nlService = require('./nlService');

async function indicadores(rango)           { return repo.indicadoresGenerales(rango); }
async function evolucion(rango)             { return repo.evolucionDiaria(rango); }
async function comisiones(rango)            { return repo.comisionesPorHora(rango); }
async function ballenas(rango, minBtc)      { return repo.ballenasHistoricas(rango, minBtc); }
async function ballenasVivo(limite, minBtc) { return repo.ballenasRecientes(limite, minBtc); }
async function fragmentacion(rango)         { return repo.fragmentacion(rango); }
async function concentracion(rango)         { return repo.concentracionDireccion(rango); }
async function distribucion(rango)          { return repo.distribucionSalidas(rango); }
async function mensual(rango)               { return repo.resumenMensual(rango); }
async function topBloques(rango)            { return repo.topBloquesPorComisiones(rango); }
async function ejecutarNL(pipeline)         { return repo.ejecutarPipelineNL(pipeline); }
async function ultimas(opts)                { return repo.ultimasTransacciones(opts); }

/**
 * Lenguaje Natural: recibe una pregunta en texto plano, genera el pipeline con IA,
 * lo valida y ejecuta. Soporta auto-reparación si el primer intento falla.
 */
async function consultaNL(pregunta) {
  // 1. Obtener contexto de datos (fechas disponibles, etc.)
  const contexto = await repo.contextoDatos();
  
  // 2. Generar pipeline con IA
  let resultado = await nlService.generar(pregunta, contexto);
  const { coleccion, pipeline } = resultado;
  
  // 3. Intentar ejecutar
  try {
    const datos = await repo.ejecutarPipelineNL({ coleccion, pipeline });
    return {
      datos,
      pipeline,
      coleccion,
      proveedor: resultado.proveedor,
      modelo: resultado.modelo,
      reparado: false,
    };
  } catch (errorEjecucion) {
    // 4. Auto-reparación: si falla, pedimos a la IA que lo corrija
    console.warn(`⚠ NL: primer intento falló (${errorEjecucion.message}), intentando reparar...`);
    
    resultado = await nlService.generar(pregunta, contexto, {
      anterior: resultado.raw,
      error: errorEjecucion.message,
    });
    
    const datos = await repo.ejecutarPipelineNL({
      coleccion: resultado.coleccion,
      pipeline: resultado.pipeline,
    });
    
    return {
      datos,
      pipeline: resultado.pipeline,
      coleccion: resultado.coleccion,
      proveedor: resultado.proveedor,
      modelo: resultado.modelo,
      reparado: true,
    };
  }
}

module.exports = {
  indicadores, evolucion, comisiones,
  ballenas, ballenasVivo, fragmentacion, concentracion,
  distribucion, mensual, topBloques, ejecutarNL, ultimas,
  consultaNL,
};
