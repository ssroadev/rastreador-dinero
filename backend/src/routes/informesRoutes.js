const router = require('express').Router();
const c = require('../controllers/informesController');

// Informes convencionales
router.get('/indicadores',    c.indicadores);    // Informe 1
router.get('/evolucion',      c.evolucion);      // Informe 2
router.get('/comisiones-hora',c.comisiones);     // Informe 3
router.get('/top-bloques',    c.topBloques);     // Informe 4
router.get('/distribucion',   c.distribucion);   // Informe 5
router.get('/atipicas',       c.atipicas);       // Informe 6
router.get('/mensual',        c.mensual);        // Informe 7 (comparación)
router.get('/ultimas',        c.ultimas);        // Informe 10 (tiempo real / polling)

// Lenguaje natural (POST porque manda cuerpo)
router.post('/nl',            c.consultaNL);     // Informes 8 y 9

module.exports = router;
