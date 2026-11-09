import { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { BrainCircuit, Send, ChevronRight } from 'lucide-react';
import { consultaNL } from '../services/api';
import ErrorBanner from '../components/ErrorBanner';
import PageHeader  from '../components/PageHeader';
import { tooltip, grid, xAxisCategory, yAxis, barSeries, COLORS } from '../charts/chartTheme';

const SAMPLES = [
  '¿Cuáles son los 10 bloques con más transacciones?',
  '¿Cuál fue el volumen total en BTC por mes?',
  '¿Cuántas transacciones tuvieron más de 5 salidas?',
  '¿Cuál es la comisión promedio por hora del día?',
  '¿Qué bloque tuvo la mayor comisión total?',
  '¿Cuáles son los 5 días con mayor número de transacciones?',
];

function AutoViz({ resultado }) {
  if (!resultado?.length) return null;
  const keys      = Object.keys(resultado[0]);
  const numKey    = keys.find(k => typeof resultado[0][k] === 'number');
  const labelKey  = keys.find(k => k !== numKey);
  if (!numKey || resultado.length < 2) return null;

  const option = {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: grid({ bottom: 56 }),
    xAxis: xAxisCategory(resultado.map(r => String(r[labelKey] ?? '').slice(0, 18)), {
      axisLabel: { rotate: 30, fontSize: 10 },
    }),
    yAxis: yAxis(),
    series: [barSeries(numKey, resultado.map(r => r[numKey]), COLORS.orange)],
  };

  return (
    <div className="card mt-4">
      <div className="card-header">
        <span className="card-title">Visualización — {numKey}</span>
        <span className="badge badge-neutral">auto-generada</span>
      </div>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}

export default function ConsultaNL() {
  const [pregunta, setPregunta]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [respuesta, setRespuesta] = useState(null);

  const consultar = async (q = pregunta) => {
    if (!q?.trim()) return;
    setPregunta(q);
    setLoading(true); setError(null); setRespuesta(null);
    try { setRespuesta(await consultaNL(q)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <PageHeader
        Icon={BrainCircuit}
        title="Consultas en Lenguaje Natural"
        subtitle="Formula preguntas en español. El sistema genera un Aggregation Pipeline de MongoDB, lo ejecuta y presenta el resultado."
      />

      {/* Sample queries */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Consultas de ejemplo</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Click para ejecutar</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              className="btn btn-ghost"
              style={{ justifyContent: 'flex-start', textAlign: 'left', gap: 8, fontSize: 12, padding: '8px 12px' }}
              onClick={() => consultar(s)}
            >
              <ChevronRight size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Formulación libre</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Requiere <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>OPENAI_API_KEY</span>
          </span>
        </div>
        <div className="flex gap-3" style={{ alignItems: 'flex-end' }}>
          <textarea
            rows={3}
            placeholder="Ej: ¿Qué días de la semana tienen mayor volumen transaccional?"
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
            style={{ flex: 1, resize: 'vertical', minWidth: 0 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) consultar(); }}
          />
          <button
            className="btn btn-primary"
            onClick={() => consultar()}
            disabled={loading || !pregunta.trim()}
            style={{ alignSelf: 'flex-end', gap: 6 }}
          >
            <Send size={13} />
            {loading ? 'Procesando…' : 'Consultar'}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>
          Ctrl + Enter para enviar
        </p>
      </div>

      <ErrorBanner error={error} />
      {loading && <div className="spinner" />}

      {respuesta && (
        <>
          {/* Pipeline generated */}
          <div className="card mt-4">
            <div className="card-header">
              <span className="card-title">Pipeline generado</span>
              <span className="badge badge-blue">MongoDB Aggregation</span>
            </div>
            <pre className="code-block">{JSON.stringify(respuesta.pipeline, null, 2)}</pre>
          </div>

          {/* Results table */}
          <div className="card mt-4">
            <div className="card-header">
              <span className="card-title">
                Resultado — {respuesta.resultado?.length ?? 0} documentos
              </span>
              <span className="badge badge-green">Ejecutado en MongoDB</span>
            </div>

            {respuesta.resultado?.length > 0 ? (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(respuesta.resultado[0]).map(k => (
                          <th key={k}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {respuesta.resultado.slice(0, 50).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="mono">
                              {typeof v === 'number'
                                ? v.toLocaleString('es-CO', { maximumFractionDigits: 8 })
                                : String(v ?? '—').slice(0, 40)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {respuesta.resultado.length > 50 && (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', padding: '8px 0' }}>
                    Mostrando 50 de {respuesta.resultado.length} resultados.
                  </p>
                )}
              </>
            ) : (
              <div className="empty-state">La consulta no retornó resultados.</div>
            )}
          </div>

          <AutoViz resultado={respuesta.resultado} />
        </>
      )}
    </div>
  );
}
