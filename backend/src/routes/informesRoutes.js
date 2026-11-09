const router = require('express').Router();
const c = require('../controllers/informesController');

// Informes sobre vistas pre-agregadas (rápidos)
router.get('/indicadores',     c.indicadores);
router.get('/evolucion',       c.evolucion);
router.get('/comisiones-hora', c.comisiones);
router.get('/mensual',         c.mensual);
router.get('/top-bloques',     c.topBloques);
router.get('/distribucion',    c.distribucion);

// Informes sobre `transacciones` (ventana acotada + índices parciales)
router.get('/ballenas',        c.ballenas);
router.get('/ballenas/vivo',   c.ballenasVivo);
router.get('/fragmentacion',   c.fragmentacion);
router.get('/concentracion',   c.concentracion);

// Tiempo real (mempool vivo)
router.get('/ultimas',         c.ultimas);

// Lenguaje natural (POST porque manda cuerpo)
router.post('/nl',             c.consultaNL);

module.exports = router;
