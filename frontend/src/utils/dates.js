/**
 * Calcula el rango de fechas por defecto para los filtros.
 * @returns {{ desde: string, hasta: string }} — últimos 7 días en formato ISO
 */
export function rangoPorDefecto() {
  const ahora = new Date();
  const hace7 = new Date(ahora);
  hace7.setDate(ahora.getDate() - 7);

  // Formato ISO sin milisegundos: "2026-11-08"
  const formatear = (d) => d.toISOString().split('T')[0];

  return {
    desde: formatear(hace7),
    hasta: formatear(ahora),
  };
}
