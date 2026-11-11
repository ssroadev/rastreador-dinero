# Rastro del Dinero — Bitcoin Analytics Dashboard

Dashboard de análisis de transacciones Bitcoin (AWS Public Blockchain Data) sobre MongoDB.
Proyecto parcial de Bases de Datos II.

## Caso de estudio
- **Problema:** entender cómo se mueve el dinero en Bitcoin: actividad, comisiones, ballenas, fragmentación y concentración.
- **Usuarios:** analistas, mineros y usuarios que quieren pagar menos comisión.
- **Datos:** transacciones reales (`transacciones`, una fila por tx, con `inputs[]` y `outputs[]`) de 2026-09-21 a 2026-11-08.
- **Decisiones:** cuándo enviar una tx para pagar menos, detectar patrones sospechosos, medir qué tan concentrada está la riqueza.
- **Por qué es big data:** decenas de millones de documentos; sin índices ni pre-agregación los informes tardan minutos.

## Arquitectura
```
Dashboard (React + ECharts) ──HTTP/JSON──▶ API (Express) ──▶ MongoDB (replica set rs0)
        ▲                                     │  routes → controllers → services → repositories
        └──── Socket.IO ◀── Change Stream ◀───┘            ▲
                                  ingesta/vivo.js (WebSocket blockchain.com) ──insert──▶ mempool_vivo (capped)
```
| Capa | Responsabilidad |
|---|---|
| `routes/` | Endpoints `/api/informes/*` |
| `controllers/` | Validar y normalizar parámetros, manejo de errores HTTP |
| `services/` | Lógica de negocio. `nlService` (IA → pipeline) y `informesService` (orquesta NL + reintento) |
| `repositories/` | TODAS las consultas a MongoDB (`$match/$group/$sort` en el motor). `nlRepository` valida y ejecuta el pipeline de la IA en solo lectura |
| `scripts/`, `etl/`, `database/` | Carga, índices, pre-agregación, benchmark |

El dashboard solo habla con la API; nunca con la base de datos.

## Requisitos
- Node.js **22+** (la ingesta usa `WebSocket` nativo), Docker, Python 3.11+ (ETL)

## Puesta en marcha
```bash
# 1. MongoDB como replica set (necesario para Change Streams)
docker compose up -d

# 2. Datos (ETL: descarga Parquet de AWS y carga a MongoDB; reanudable)
cd etl && pip install -r requirements.txt && python 05_tandas.py && cd ..

# 3. Backend
cd backend && cp .env.example .env      # editar MONGO_DB y la clave de IA (ver abajo)
npm install
node ../database/indexes/crear_indices_node.js   # índices base (idx_coinbase_fecha, idx_outputs_dir multikey…)
npm run indices                          # índices parciales + borra los redundantes
npm run vistas                           # vw_diarias / vw_horas / vw_bloques / vw_salidas
npm run precalcular                      # vw_fragmentacion / vw_concentracion
npm start                                # API en :3000 + Change Stream

# 4. Tiempo real (otra terminal)
cd backend && npm run ingesta            # blockchain.com → mempool_vivo → Change Stream → Socket.IO

# 5. Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

### Lenguaje natural (gratis, con respaldo local)
`LLM_PROVIDERS=gemini,ollama` en `backend/.env`: se usa Gemini (clave gratuita de Google AI Studio) y, si falla
por límite, red o respuesta inválida, cae automáticamente a Ollama (local, sin límites, prompt compacto).
La respuesta de `/api/informes/nl` indica `proveedor`, `modelo` y si se usó `respaldo`. Ver `.env.example`.
Recomendado: crear un usuario de solo lectura (`node scripts/crear-usuario-lector.js <clave>`) y poner `MONGO_READONLY_URI`.

### Evidencia del volumen (≥ 20 GB)
```js
db.stats(1024*1024*1024)   // dataSize = datos · storageSize = disco · indexSize = índices (se reportan por separado)
```

## Informes
| # | Ruta | Pregunta | Fuente |
|---|---|---|---|
| 1 | `/` | ¿Cuál es el comportamiento general? | `vw_diarias` |
| 2 | `/evolucion` | ¿Cómo cambió la actividad día a día? | `vw_diarias` |
| 3 | `/comisiones` | ¿Cuándo conviene enviar una tx para pagar menos? | `vw_horas` |
| 4 | `/bloques` | ¿Qué bloques dieron más comisión a los mineros? | `vw_bloques` |
| 5 | `/distribucion` | ¿Cuántas salidas tienen las txs típicas? | `vw_salidas` |
| 6 | `/mensual` | ¿Qué diferencias hay entre meses? | `vw_diarias` |
| 7 | `/ballenas` | ¿Dónde se mueven los montos grandes? | `transacciones` + índice parcial |
| 8 | `/fragmentacion` | ¿Qué txs reparten fondos en muchas salidas casi iguales? | `vw_fragmentacion` |
| 9 | `/concentracion` | ¿Qué tan concentrado está el volumen en pocas direcciones? | `vw_concentracion` |
| 10 | `/nl` | Preguntas libres en español (IA → pipeline MongoDB) | `vw_*` / `transacciones` |
| 11 | `/tiempo-real` | ¿Qué está pasando ahora mismo? (Change Stream) | `mempool_vivo` |

Cada informe documenta pregunta, consulta, visualización e interpretación en `docs/informes.md`.

## Índices y optimización
Ver `docs/benchmark_indices.md` (generado con `npm run benchmark`: explain `executionStats`, COLLSCAN vs IXSCAN).
