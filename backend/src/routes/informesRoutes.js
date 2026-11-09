const router = require('express').Router();
const c = require('../controllers/informesController');

// Informes convencionales
router.get('/indicadores',    c.indicadores);    // Informe 1
router.get('/evolucion',      c.evolucion);      // Informe 2
router.get('/comisiones-hora',c.comisiones);     // Informe 3
router.get('/ballenas',       c.ballenas);       // Informe 4 — histórico
router.get('/ballenas/vivo',  c.ballenasVivo);   // Informe 4 — tiempo real
router.get('/fragmentacion',  c.fragmentacion);   // Informe 5
router.get('/atipicas',       c.atipicas);       // Informe 6
router.get('/concentracion',  c.concentracion);   // Informe 7
router.get('/distribucion',   c.distribucion);    // Distribución de montos
router.get('/mensual',        c.mensual);         // Resumen mensual
router.get('/top-bloques',    c.topBloques);      // Top bloques por comisiones
router.get('/ultimas',        c.ultimas);        // Informe 10 (tiempo real / polling)

// Lenguaje natural (POST porque manda cuerpo)
router.post('/nl',            c.consultaNL);     // Informes 8 y 9

module.exports = router;
