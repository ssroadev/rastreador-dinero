import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

const http = axios.create({ baseURL: BASE });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildParams({ desde, hasta, limite } = {}) {
  const p = {};
  if (desde)  p.desde  = desde;
  if (hasta)  p.hasta  = hasta;
  if (limite) p.limite = limite;
  return p;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────
export const getIndicadores      = (filtro) => http.get('/informes/indicadores',    { params: buildParams(filtro) }).then(r => r.data);
export const getEvolucion        = (filtro) => http.get('/informes/evolucion',      { params: buildParams(filtro) }).then(r => r.data);
export const getComisionesHora   = (filtro) => http.get('/informes/comisiones-hora',{ params: buildParams(filtro) }).then(r => r.data);
export const getBallenas         = (filtro, minBtc) => http.get('/informes/ballenas',  { params: { ...buildParams(filtro), minBtc } }).then(r => r.data);
export const getBallenasVivo     = (limite, minBtc) => http.get('/informes/ballenas/vivo', { params: { limite, minBtc } }).then(r => r.data);
export const getFragmentacion    = (filtro) => http.get('/informes/fragmentacion',   { params: buildParams(filtro) }).then(r => r.data);
export const getAtipicas         = (filtro) => http.get('/informes/atipicas',       { params: buildParams(filtro) }).then(r => r.data);
export const getConcentracion    = (filtro) => http.get('/informes/concentracion',   { params: buildParams(filtro) }).then(r => r.data);
export const getDistribucion     = (filtro) => http.get('/informes/distribucion',    { params: buildParams(filtro) }).then(r => r.data);
export const getMensual          = (filtro) => http.get('/informes/mensual',         { params: buildParams(filtro) }).then(r => r.data);
export const getTopBloques       = (filtro) => http.get('/informes/top-bloques',     { params: buildParams(filtro) }).then(r => r.data);
export const getUltimas          = (limite) => http.get('/informes/ultimas',        { params: { limite } }).then(r => r.data);

export const consultaNL = (pregunta) =>
  http.post('/informes/nl', { pregunta }).then(r => r.data);

export const getSalud = () => http.get('/salud').then(r => r.data);
