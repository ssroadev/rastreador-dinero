const repo = require('../repositories/transaccionesRepository');

async function indicadores(rango)          { return repo.indicadoresGenerales(rango); }
async function evolucion(rango)            { return repo.evolucionDiaria(rango); }
async function comisiones(rango)           { return repo.comisionesPorHora(rango); }
async function topBloques(rango)           { return repo.topBloquesPorComision(rango); }
async function distribucion(rango)         { return repo.distribucionSalidas(rango); }
async function atipicas(rango)             { return repo.transaccionesAtipicas(rango); }
async function mensual(rango)              { return repo.comparacionMensual(rango); }
async function ejecutarNL(pipeline)        { return repo.ejecutarPipelineNL(pipeline); }
async function ultimas(opts)               { return repo.ultimasTransacciones(opts); }

module.exports = {
  indicadores, evolucion, comisiones,
  topBloques, distribucion, atipicas,
  mensual, ejecutarNL, ultimas,
};
