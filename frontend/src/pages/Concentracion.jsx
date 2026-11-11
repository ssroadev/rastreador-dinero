
import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { PieChart } from 'lucide-react';

import { getConcentracion } from '../services/api';
import RangoFechas from '../components/RangoFechas';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader from '../components/PageHeader';
import { rangoUnDia } from '../utils/dates';
import { tooltip, COLORS } from '../charts/chartTheme';

const fmt = (n, d = 4) =>
  Number(n ?? 0).toLocaleString('es-CO', {
    maximumFractionDigits: d
  });

const truncate = (s, n = 16) =>
  s ? (s.length > n ? s.slice(0, n) + '…' : s) : '—';

export default function Concentracion() {
  const [filtro, setFiltro] = useState(rangoUnDia());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Carga de información
  const cargar = async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await getConcentracion(filtro));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // ============================================
  // GRÁFICO 1: CONCENTRACIÓN ACUMULADA
  // ============================================

  const top = data?.top || [];

  const puntosAcumulados = [
    [0, 0],
    ...top.map((d, i) => [
      i + 1,
      Number(d.pctAcumulado ?? 0)
    ])
  ];

  const concentracionOpt = {
    backgroundColor: 'transparent',

    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: ({ data: punto }) => {
        if (!Array.isArray(punto)) return '';

        const [cantidad, porcentaje] = punto;

        return `
          <b>${cantidad} direcciones principales</b>
          <br/>
          ${fmt(porcentaje, 2)}% del volumen total
        `;
      }
    },

    grid: {
      left: 70,
      right: 35,
      top: 35,
      bottom: 65
    },

    xAxis: {
      type: 'value',
      min: 0,
      max: Math.max(top.length, 1),
      name: 'Número de direcciones',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: {
        color: '#a3b2c3'
      },
      axisLabel: {
        color: '#a3b2c3'
      },
      axisLine: {
        lineStyle: {
          color: '#334155'
        }
      },
      splitLine: {
        show: false
      }
    },

    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      name: '% del volumen diario',
      nameTextStyle: {
        color: '#a3b2c3'
      },
      axisLabel: {
        color: '#a3b2c3',
        formatter: '{value}%'
      },
      splitLine: {
        lineStyle: {
          color: '#253244',
          opacity: 0.5
        }
      }
    },

    series: [
      {
        name: 'Volumen acumulado',
        type: 'line',
        data: puntosAcumulados,
        smooth: false,
        showSymbol: false,
        lineStyle: {
          color: COLORS.orange,
          width: 3
        },
        itemStyle: {
          color: COLORS.orange
        },
        areaStyle: {
          color: 'rgba(247, 147, 26, 0.10)'
        }
      }
    ]
  };

  // ============================================
  // GRÁFICO 2: EVOLUCIÓN DE LA CONCENTRACIÓN
  // ============================================

  const serieConcentracion = [...(data?.serie || [])]
    .filter(d =>
      d.fecha &&
      d.pctTop1 != null &&
      d.pctTop10 != null
    )
    .sort(
      (a, b) => new Date(a.fecha) - new Date(b.fecha)
    );

  // Calcular escala vertical automática
  const porcentajes = serieConcentracion
    .flatMap(d => [
      Number(d.pctTop1),
      Number(d.pctTop10)
    ])
    .filter(Number.isFinite);

  const minimoEscala = porcentajes.length
    ? Math.max(
        0,
        Math.floor(Math.min(...porcentajes) - 0.5)
      )
    : 0;

  const evolucionOpt = {
    backgroundColor: 'transparent',

    tooltip: {
      ...tooltip,
      trigger: 'axis'
    },

    legend: {
      top: 5,
      textStyle: {
        color: '#a3b2c3'
      }
    },

    grid: {
      left: 65,
      right: 30,
      top: 55,
      bottom: 65
    },

    xAxis: {
      type: 'category',
      data: serieConcentracion.map(d =>
        new Date(d.fecha).toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'short',
          timeZone: 'UTC'
        })
      ),
      axisLabel: {
        color: '#a3b2c3',
        rotate: serieConcentracion.length > 10 ? 35 : 0
      }
    },

    yAxis: {
      type: 'value',
      min: minimoEscala,
      max: 100,
      axisLabel: {
        color: '#a3b2c3',
        formatter: '{value}%'
      },
      splitLine: {
        lineStyle: {
          color: '#253244'
        }
      }
    },

    series: [
      {
        name: 'Top 1%',
        type: 'line',
        smooth: true,
        data: serieConcentracion.map(
          d => Number(d.pctTop1)
        ),
        lineStyle: {
          width: 3,
          color: COLORS.orange
        },
        itemStyle: {
          color: COLORS.orange
        }
      },
      {
        name: 'Top 10%',
        type: 'line',
        smooth: true,
        data: serieConcentracion.map(
          d => Number(d.pctTop10)
        ),
        lineStyle: {
          width: 3,
          color: '#38bdf8'
        },
        itemStyle: {
          color: '#38bdf8'
        }
      }
    ]
  };

  // ============================================
  // INTERPRETACIÓN ANALÍTICA
  // ============================================

  const primerDia = serieConcentracion[0];

  const ultimoDia =
    serieConcentracion[serieConcentracion.length - 1];

  const variacionTop1 = primerDia && ultimoDia
    ? Number(ultimoDia.pctTop1) -
      Number(primerDia.pctTop1)
    : null;

  const variacionTop10 = primerDia && ultimoDia
    ? Number(ultimoDia.pctTop10) -
      Number(primerDia.pctTop10)
    : null;

  const describirVariacion = (valor) => {
    if (valor == null || !Number.isFinite(valor)) {
      return 'no dispone de datos suficientes';
    }

    if (Math.abs(valor) < 0.005) {
      return 'se mantuvo prácticamente estable';
    }

    const diferencia = Math.abs(valor).toLocaleString(
      'es-CO',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );

    return `${valor > 0 ? 'aumentó' : 'disminuyó'} ${diferencia} puntos porcentuales`;
  };

  // ============================================
  // INTERFAZ DEL DASHBOARD
  // ============================================

  return (
    <div>
      <PageHeader
        Icon={PieChart}
        title="Concentración por dirección"
        subtitle="Analiza cómo se distribuye el volumen de Bitcoin recibido entre las direcciones, identifica niveles de concentración y compara patrones de actividad."
      />

      {/* Filtros */}
      <div className="filter-bar">
        <RangoFechas {...filtro} onChange={setFiltro} />

        <button
          className="btn btn-primary"
          onClick={cargar}
          disabled={loading}
        >
          Aplicar
        </button>
      </div>

      <ErrorBanner error={error} />

      {loading && <div className="spinner" />}

      {!loading && data && data.totalDirecciones > 0 && (
        <>
          {/* Información del período */}
          <div
            className="card"
            style={{
              marginBottom: 12,
              padding: '12px 16px',
              borderLeft: '3px solid var(--accent)'
            }}
          >
            <strong>Período del análisis: </strong>
            {data.diaMostrado || 'Día seleccionado'}

            <p
              style={{
                margin: '6px 0 0',
                color: 'var(--text-secondary)',
                fontSize: 12
              }}
            >
              Los indicadores representan el volumen recibido
              durante el día mostrado, no los saldos acumulados
              de las direcciones.
            </p>
          </div>

          {/* Indicadores principales */}
          <div
            className="grid-4"
            style={{ marginBottom: 12 }}
          >
            <div className="card">
              <div className="card-title">
                Direcciones receptoras
              </div>

              <div
                className="kpi-value"
                style={{ color: 'var(--cyan)' }}
              >
                {data.totalDirecciones.toLocaleString('es-CO')}
              </div>

              <div className="kpi-label">
                en el día analizado
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                Volumen total
              </div>

              <div
                className="kpi-value"
                style={{ color: 'var(--accent)' }}
              >
                {fmt(data.volumenTotal, 2)}
                {' '}
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-tertiary)'
                  }}
                >
                  BTC
                </span>
              </div>

              <div className="kpi-label">
                recibido
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                Concentración · Top 1%
              </div>

              <div
                className="kpi-value"
                style={{ color: 'var(--red)' }}
              >
                {data.pctTop1}%
              </div>

              <div className="kpi-label">
                del volumen recibido
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                Concentración · Top 10%
              </div>

              <div
                className="kpi-value"
                style={{ color: 'var(--orange)' }}
              >
                {data.pctTop10}%
              </div>

              <div className="kpi-label">
                del volumen recibido
              </div>
            </div>
          </div>

          {/* Gráfico 1 */}
          <div
            className="card"
            style={{ marginBottom: 12 }}
          >
            <div className="card-header">
              <span className="card-title">
                Concentración acumulada — {top.length} direcciones principales
              </span>

              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}
              >
                Ordenadas de mayor a menor volumen recibido
              </span>
            </div>

            <ReactECharts
              option={concentracionOpt}
              style={{ height: 350 }}
              notMerge={true}
            />
          </div>

          {/* Gráfico 2 */}
          {serieConcentracion.length > 1 && (
            <div
              className="card"
              style={{ marginBottom: 12 }}
            >
              <div className="card-header">
                <span className="card-title">
                  Evolución de la concentración del volumen
                </span>

                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)'
                  }}
                >
                  Comparación diaria · Eje vertical ampliado
                  (no inicia en 0%)
                </span>
              </div>

              <ReactECharts
                option={evolucionOpt}
                style={{ height: 350 }}
                notMerge={true}
              />
            </div>
          )}

          {/* Interpretación analítica */}
          {serieConcentracion.length > 1 && (
            <div
              className="card"
              style={{
                marginBottom: 12,
                padding: '20px 24px'
              }}
            >
              <div className="card-header">
                <span className="card-title">
                  Interpretación analítica
                </span>

                <span className="badge badge-green">
                  Calculado con datos reales
                </span>
              </div>

              <div
                style={{
                  color: 'var(--text-secondary)',
                  lineHeight: 1.8,
                  marginTop: 12
                }}
              >
                <p>
                  La concentración del volumen recibido por el{' '}
                  <strong>top 1%</strong>{' '}
                  {describirVariacion(variacionTop1)}.
                </p>

                <p style={{ marginTop: 10 }}>
                  En el <strong>top 10%</strong>,
                  la concentración{' '}
                  {describirVariacion(variacionTop10)}.
                </p>

                <p
                  style={{
                    fontSize: 12,
                    marginTop: 12
                  }}
                >
                  La comparación se realiza entre el primer
                  y último día de la serie. Las diferencias
                  se expresan en puntos porcentuales del
                  volumen recibido; no reflejan cambios en
                  la propiedad de Bitcoin ni prueban
                  actividad ilícita.
                </p>
              </div>
            </div>
          )}

          {/* Ranking de direcciones */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                Top 50 direcciones
              </span>

              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)'
                }}
              >
                {top.length} direcciones en el ranking
              </span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Dirección</th>
                    <th>Total recibido (BTC)</th>
                    <th>Nº txs</th>
                    <th>% volumen</th>
                    <th>% acumulado</th>
                  </tr>
                </thead>

                <tbody>
                  {top.slice(0, 50).map((d, i) => (
                    <tr key={i}>
                      <td
                        className="text-xs"
                        style={{
                          color: 'var(--text-tertiary)',
                          width: 40
                        }}
                      >
                        {i + 1}
                      </td>

                      <td>
                        <span
                          className="mono"
                          style={{
                            color: 'var(--accent)',
                            fontSize: 11
                          }}
                        >
                          {truncate(d.dir, 24)}
                        </span>
                      </td>

                      <td className="mono font-semibold">
                        {fmt(d.totalRecibido, 4)}
                      </td>

                      <td className="mono">
                        {d.nTx}
                      </td>

                      <td
                        className="mono"
                        style={{
                          color: 'var(--text-tertiary)'
                        }}
                      >
                        {d.pctVolumen}%
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            d.pctAcumulado > 50
                              ? 'badge-orange'
                              : 'badge-neutral'
                          }`}
                        >
                          {d.pctAcumulado}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading &&
        (!data || data.totalDirecciones === 0) &&
        !error && (
          <div
            className="card"
            style={{
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              padding: 32
            }}
          >
            Sin datos para el rango seleccionado.
            Prueba con fechas más amplias.
          </div>
        )}
    </div>
  );
}
