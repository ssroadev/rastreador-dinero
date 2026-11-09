# Rastro del Dinero — Bitcoin Analytics Dashboard

Dashboard de análisis de transacciones Bitcoin sobre datos reales de AWS Public Blockchain Data.

## Arquitectura

```
rastro-del-dinero/
├── backend/              Node.js + Express 5 + MongoDB (driver nativo)
│   ├── src/
│   │   ├── config/       Conexión MongoDB (singleton)
│   │   ├── routes/       Definición de endpoints
│   │   ├── controllers/  Validación de parámetros
│   │   ├── services/     Lógica de negocio
│   │   └── repositories/ Aggregation Pipelines
│   ├── app.js            Express + Socket.IO
│   └── server.js         Arranque + Change Stream
│
├── frontend/             React + Vite + ECharts + Socket.IO client
│   └── src/
│       ├── components/   Navbar, RangoFechas, ErrorBanner
│       ├── pages/        Una página por informe
│       ├── charts/       Tema y helpers de ECharts
│       └── services/     api.js (axios) + socket.js
│
└── data/db/              MongoDB local (replica set rs0)
```

## Requisitos

- Node.js 20+
- MongoDB con replica set (`replicaSet=rs0`) — necesario para Change Streams

## Configuración

### Backend

1. Copia / edita `backend/.env`:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/?replicaSet=rs0&directConnection=true
   MONGO_DB=rastro
   OPENAI_API_KEY=sk-...   # opcional, para informes de lenguaje natural
   ```

2. Instala dependencias:
   ```bash
   cd backend && npm install
   ```

3. Arranca:
   ```bash
   node server.js
   ```

### Frontend

1. Edita `frontend/.env` si el backend corre en otro puerto:
   ```env
   VITE_API_URL=http://localhost:3000/api
   VITE_SOCKET_URL=http://localhost:3000
   ```

2. Instala dependencias:
   ```bash
   cd frontend && npm install
   ```

3. Modo desarrollo:
   ```bash
   npm run dev
   # → http://localhost:5173
   ```

4. Build de producción:
   ```bash
   npm run build
   npm run preview
   ```

## Informes implementados

| # | Ruta | Pregunta |
|---|------|----------|
| 1 | `/` | ¿Cuál es el comportamiento general de los datos? |
| 2 | `/evolucion` | ¿Cómo ha cambiado la actividad día a día? |
| 3 | `/comisiones` | ¿Cuándo conviene enviar una tx para pagar menos? |
| 4 | `/bloques` | ¿Qué bloques generaron más comisión para los mineros? |
| 5 | `/distribucion` | ¿Cuántas salidas tienen las transacciones típicas? |
| 6 | `/atipicas` | ¿Qué transacciones son sospechosas por volumen/comisión? |
| 7 | `/mensual` | ¿Qué diferencias existen entre meses? |
| 8+9 | `/nl` | Preguntas libres en lenguaje natural (IA → pipeline MongoDB) |
| 10 | `/tiempo-real` | ¿Qué cambios están ocurriendo ahora mismo? (Change Stream) |

## Tecnologías

- **Base de datos**: MongoDB (replica set local) — colección `transacciones`
- **Backend**: Express 5, mongodb driver, Socket.IO, OpenAI SDK
- **Frontend**: React 18, Vite 5, Apache ECharts, Socket.IO client, Axios, React Router 6
- **Tiempo real**: Change Streams → Socket.IO → React
