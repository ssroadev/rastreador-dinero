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


function fechaDesdeISO(valor) {
  if (typeof valor !== 'string') return valor;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(valor)) return valor;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha;
}

function convertirFiltro(filtro) {
  if (!filtro || typeof filtro !== 'object' || Array.isArray(filtro)) return filtro;
  const resultado = {};
  for (const [campo, valor] of Object.entries(filtro)) {
    if (campo === 'fecha') {
      if (typeof valor === 'string') {
        resultado[campo] = fechaDesdeISO(valor);
      } else if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        resultado[campo] = Object.fromEntries(
          Object.entries(valor).map(([operador, fecha]) => [operador,
            ['$gte', '$gt', '$lte', '$lt', '$eq', '$ne'].includes(operador)
              ? fechaDesdeISO(fecha) : fecha])
        );
      } else resultado[campo] = valor;
    } else if (['$and', '$or', '$nor'].includes(campo) && Array.isArray(valor)) {
      resultado[campo] = valor.map(convertirFiltro);
    } else {
      resultado[campo] = valor;
    }
  }
  return resultado;
}

function normalizarPipeline(pipeline) {
  return pipeline.map(etapa => ('$match' in etapa)
    ? { ...etapa, $match: convertirFiltro(etapa.$match) }
    : etapa);
}

async function ejecutarRespuestaNL(resultado) {
  return repo.ejecutarPipelineNL({
    coleccion: resultado.coleccion,
    pipeline: normalizarPipeline(resultado.pipeline),
  });
}

function armarRespuesta(resultado, datos, reparado) {
  return {
    datos,
    pipeline: resultado.pipeline,
    coleccion: resultado.coleccion,
    proveedor: resultado.proveedor,
    modelo: resultado.modelo,
    reparado,
  };
}

async function consultaNL(pregunta) {
  const contexto = await repo.contextoDatos();
  let resultado = await nlService.generar(pregunta, contexto);
  let datos;
  let problema;

  try {
    datos = await ejecutarRespuestaNL(resultado);
    if (datos.length > 0) return armarRespuesta(resultado, datos, false);
    problema = 'El pipeline se ejecutó, pero devolvió cero documentos. Revisa la colección, los nombres de campo y los límites de fecha. Mantén exactamente el sentido de la pregunta.';
  } catch (errorEjecucion) {
    problema = errorEjecucion.message;
  }

  console.warn(`⚠ NL: ${problema}; intentando una reparación...`);
  try {
    const corregido = await nlService.generar(pregunta, contexto, {
      anterior: resultado.raw,
      error: problema,
    });
    const nuevosDatos = await ejecutarRespuestaNL(corregido);
    if (nuevosDatos.length > 0 || !datos) {
      return armarRespuesta(corregido, nuevosDatos, true);
    }
  } catch (errorReparacion) {
    if (!datos) throw errorReparacion;
    console.warn(`⚠ NL: reparación no disponible: ${errorReparacion.message}`);
  }

  return armarRespuesta(resultado, datos ?? [], false);
}

module.exports = {
  indicadores, evolucion, comisiones,
  ballenas, ballenasVivo, fragmentacion, concentracion,
  distribucion, mensual, topBloques, ejecutarNL, ultimas,
  consultaNL,
};
