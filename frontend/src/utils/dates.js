/**
 * Calcula el rango de fechas por defecto para los filtros.
 * @returns {{ desde: string, hasta: string }} — rango de 7 días con datos reales
 */
export function rangoPorDefecto() {
  // La BD tiene datos de Sept 21 - Nov 8, 2026
  // Usar últimos 7 días de datos disponibles
  const hasta = new Date('2026-11-08');
  const desde = new Date('2026-11-01');  // 7 días antes

  // Formato ISO: "2026-11-08"
  const formatear = (d) => d.toISOString().split('T')[0];

  return {
    desde: formatear(desde),
    hasta: formatear(hasta),
  };
}
