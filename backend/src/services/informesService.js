const repo = require('../repositories/transaccionesRepository');

async function indicadores(rango)          { return repo.indicadoresGenerales(rango); }
async function evolucion(rango)            { return repo.evolucionDiaria(rango); }
async function comisiones(rango)           { return repo.comisionesPorHora(rango); }
async function ballenas(rango, minBtc)     { return repo.ballenasHistoricas(rango, minBtc); }
async function ballenasVivo(limite, minBtc){ return repo.ballenasRecientes(limite, minBtc); }
async function fragmentacion(rango)        { return repo.fragmentacion(rango); }
async function atipicas(rango)             { return repo.transaccionesAtipicas(rango); }
async function concentracion(rango)        { return repo.concentracionDireccion(rango); }
async function distribucion(rango)         { return repo.distribucionMontos(rango); }
async function mensual(rango)              { return repo.resumenMensual(rango); }
async function topBloques(rango)           { return repo.topBloquesPorComisiones(rango); }
async function ejecutarNL(pipeline)        { return repo.ejecutarPipelineNL(pipeline); }
async function ultimas(opts)               { return repo.ultimasTransacciones(opts); }

module.exports = {
  indicadores, evolucion, comisiones,
  ballenas, ballenasVivo, fragmentacion,
  atipicas, concentracion, distribucion,
  mensual, topBloques, ejecutarNL, ultimas,
};
