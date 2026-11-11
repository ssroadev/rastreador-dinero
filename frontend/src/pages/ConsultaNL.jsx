import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  BrainCircuit,
  Send,
  ChevronRight,
  Sparkles,
  Database,
  Code2,
  ChartColumnIncreasing,
  Copy,
  Check,
  Download,
  Clock3,
  Layers3,
  Search,
  Lightbulb,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  LoaderCircle,
  Info,
} from 'lucide-react';
import { consultaNL } from '../services/api';
import ErrorBanner from '../components/ErrorBanner';
import { tooltip, grid, xAxisCategory, yAxis, barSeries, COLORS } from '../charts/chartTheme';

// Las preguntas originales se conservan. Las etiquetas solo organizan su presentación.
const SAMPLES = [
  { tema: 'Bloques', titulo: 'Bloques más activos', pregunta: '¿Cuáles son los 10 bloques con más transacciones?' },
  { tema: 'Volumen', titulo: 'Volumen por mes', pregunta: '¿Cuál fue el volumen total en BTC por mes?' },
  { tema: 'Estructura', titulo: 'Salidas por transacción', pregunta: '¿Cuántas transacciones tuvieron más de 5 salidas?' },
  { tema: 'Comisiones', titulo: 'Costos por hora', pregunta: '¿Cuál es la comisión promedio por hora del día?' },
  { tema: 'Bloques', titulo: 'Mayor comisión acumulada', pregunta: '¿Qué bloque tuvo la mayor comisión total?' },
  { tema: 'Actividad', titulo: 'Días con más movimientos', pregunta: '¿Cuáles son los 5 días con mayor número de transacciones?' },
];

const formatNumber = (value, maxDigits = 4) =>
  Number(value).toLocaleString('es-CO', { maximumFractionDigits: maxDigits });

const formatCompact = (value) =>
  new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

function displayValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value, 8) : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getSchema(rows) {
  const first = rows.find((row) => row && typeof row === 'object' && !Array.isArray(row)) ?? {};
  const columns = Object.keys(first);
  const numericColumns = columns.filter((key) =>
    rows.some((row) => typeof row?.[key] === 'number' && Number.isFinite(row[key]))
  );

  // Identifica una dimensión aun cuando el bloque o la altura sean números.
  const preferredLabels = ['dia', 'fecha', 'hora', 'mes', 'bloque', 'altura', 'rangoSalidas', 'rango', 'nombre', 'periodo', '_id'];
  const labelKey = preferredLabels.find((key) => columns.includes(key))
    ?? columns.find((key) => !numericColumns.includes(key))
    ?? (numericColumns.length > 1 ? numericColumns[0] : null);

  const metrics = numericColumns.filter((key) => key !== labelKey);
  return { columns, labelKey, metrics };
}

function labelFor(row, labelKey, index) {
  const raw = labelKey ? row?.[labelKey] : null;
  if (raw === null || raw === undefined) return `Registro ${index + 1}`;
  return String(raw);
}

function shortLabel(label) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return `${label.slice(8, 10)}/${label.slice(5, 7)}`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(label)) return `${label.slice(8, 10)}/${label.slice(5, 7)} ${label.slice(11)}`;
  return label.length > 23 ? `${label.slice(0, 20)}…` : label;
}

function SectionTitle({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="nl-section-head">
      <div className="nl-section-ident">
        <span className="nl-section-icon"><Icon size={17} /></span>
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {right && <div className="nl-section-actions">{right}</div>}
    </div>
  );
}

function Stat({ icon: Icon, title, value, hint, color = 'var(--text-primary)' }) {
  return (
    <div className="nl-stat">
      <div className="nl-stat-top"><span>{title}</span><Icon size={16} /></div>
      <div className="nl-stat-value" style={{ color }}>{value}</div>
      <div className="nl-stat-hint">{hint}</div>
    </div>
  );
}

function AutoViz({ datos, metrica, etiqueta }) {
  if (!datos.length || !metrica) return null;
  const rows = datos.filter((row) => Number.isFinite(row?.[metrica])).slice(0, 60);
  if (!rows.length) return null;

  const names = rows.map((row, i) => labelFor(row, etiqueta, i));
  const values = rows.map((row) => row[metrica]);
  const option = {
    backgroundColor: 'transparent',
    animationDuration: 450,
    tooltip: { ...tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: grid({ left: 68, right: 22, top: 22, bottom: rows.length > 14 ? 90 : 62, containLabel: true }),
    xAxis: xAxisCategory(names, {
      axisLabel: {
        color: '#93a6bb',
        fontSize: 11,
        rotate: rows.length > 10 ? 34 : 0,
        interval: 'auto',
        hideOverlap: true,
        formatter: shortLabel,
      },
      axisTick: { show: false },
    }),
    yAxis: yAxis({
      type: 'value',
      axisLabel: { color: '#93a6bb', fontSize: 11, formatter: formatCompact },
      splitLine: { lineStyle: { color: '#253447', opacity: 0.7 } },
    }),
    dataZoom: rows.length > 14 ? [
      { type: 'inside', xAxisIndex: 0, start: 0, end: Math.min(100, 14 / rows.length * 100) },
      {
        type: 'slider', xAxisIndex: 0, bottom: 12,
        start: 0, end: Math.min(100, 14 / rows.length * 100),
        height: 15, showDetail: false, borderColor: '#223346',
        fillerColor: 'rgba(247,147,26,.15)', backgroundColor: '#101a26',
        handleStyle: { color: COLORS.orange },
        textStyle: { color: '#93a6bb' },
      },
    ] : [],
    series: [barSeries(metrica, values, COLORS.orange, {
      barMaxWidth: 34,
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#ffb34d' }, { offset: 1, color: '#ca7510' }],
        },
        borderRadius: [5, 5, 0, 0],
      },
    })],
  };

  return (
    <section className="nl-panel nl-chart-panel">
      <SectionTitle icon={ChartColumnIncreasing} title="Visualización de resultados"
        subtitle={`Métrica: ${metrica} · ${rows.length} ${rows.length === 1 ? 'registro' : 'registros'} representados`}
        right={<span className="nl-chip">Generada automáticamente</span>}
      />
      <ReactECharts option={option} notMerge style={{ height: 325, width: '100%' }} />
      {datos.length > rows.length && (
        <p className="nl-panel-note">Se grafican los primeros {rows.length} registros. La tabla conserva todos los resultados recibidos.</p>
      )}
    </section>
  );
}

function InterpretacionAnalitica({ datos, metrica, etiqueta }) {
  if (!metrica || datos.length < 2) return null;
  const validos = datos.map((row, index) => ({ row, index }))
    .filter(({ row }) => typeof row?.[metrica] === 'number' && Number.isFinite(row[metrica]));
  if (validos.length < 2) return null;

  const ordenados = [...validos].sort((a, b) => b.row[metrica] - a.row[metrica]);
  const mayor = ordenados[0];
  const menor = ordenados[ordenados.length - 1];
  const diferencia = mayor.row[metrica] - menor.row[metrica];

  return (
    <section className="nl-panel nl-insight-panel">
      <SectionTitle icon={Lightbulb} title="Lectura analítica"
        subtitle="Resumen calculado con los datos recuperados" />
      <div className="nl-insight-intro">¿Qué nos dicen estos resultados sobre <strong>{metrica}</strong>?</div>
      <div className="nl-insight-item">
        <span className="nl-insight-icon good"><ArrowUpRight size={17} /></span>
        <div><span className="nl-insight-label">Valor más alto</span>
          <strong>{formatNumber(mayor.row[metrica], 8)}</strong>
          <small>{labelFor(mayor.row, etiqueta, mayor.index)}</small>
        </div>
      </div>
      <div className="nl-insight-item">
        <span className="nl-insight-icon calm"><ArrowDownRight size={17} /></span>
        <div><span className="nl-insight-label">Valor más bajo</span>
          <strong>{formatNumber(menor.row[metrica], 8)}</strong>
          <small>{labelFor(menor.row, etiqueta, menor.index)}</small>
        </div>
      </div>
      <div className="nl-insight-difference">
        <span>Diferencia entre ambos</span>
        <strong>{formatNumber(diferencia, 8)}</strong>
      </div>
      <p className="nl-disclaimer"><Info size={13} /> Este resumen solo compara los documentos devueltos por la consulta. No describe necesariamente toda la blockchain.</p>
    </section>
  );
}

function csvCell(value) {
  let text = displayValue(value);
  // Evita que hojas de cálculo interpreten valores externos como fórmulas.
  if (/^[\s]*[=+@-]/.test(text) && typeof value !== 'number') text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCSV(rows, columns) {
  const csv = '\uFEFF' + [columns, ...rows.map((row) => columns.map((key) => row?.[key]))]
    .map((line) => line.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'consulta_bitcoin_ia.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ConsultaNL() {
  const [pregunta, setPregunta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [respuesta, setRespuesta] = useState(null);
  const [duration, setDuration] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [visibleRows, setVisibleRows] = useState(15);
  const [copied, setCopied] = useState('');

  const datos = Array.isArray(respuesta?.datos) ? respuesta.datos : [];
  const schema = useMemo(() => getSchema(datos), [respuesta]);
  const metric = schema.metrics.includes(selectedMetric) ? selectedMetric : (schema.metrics[0] ?? '');
  const pipeline = Array.isArray(respuesta?.pipeline) ? respuesta.pipeline : [];
  const provider = respuesta?.proveedor ? String(respuesta.proveedor) : 'IA';

  const consultar = async (q = pregunta) => {
    const clean = String(q ?? '').trim();
    if (!clean || loading) return;
    setPregunta(clean);
    setLoading(true);
    setError(null);
    setRespuesta(null);
    setDuration(null);
    setSelectedMetric('');
    setVisibleRows(15);
    setCopied('');
    const start = performance.now();
    try {
      const result = await consultaNL(clean);
      setDuration((performance.now() - start) / 1000);
      setRespuesta(result);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const copiar = async (texto, id) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(id);
    } catch (_) {
      setCopied('error');
    }
  };

  const resultados = respuesta !== null;

  return (
    <div className="nl-page">
      <style>{STYLES}</style>

      <header className="nl-hero">
        <div className="nl-hero-content">
          <span className="nl-eyebrow"><Sparkles size={13} /> INTELIGENCIA · BITCOIN ANALYTICS</span>
          <div className="nl-hero-heading">
            <span className="nl-hero-icon"><BrainCircuit size={25} strokeWidth={1.8} /></span>
            <h1>Explora los datos con <em>IA</em></h1>
          </div>
          <p>Pregunta en español, revisa el pipeline de MongoDB y analiza resultados reales de la blockchain de Bitcoin.</p>
          <div className="nl-hero-tags">
            <span><Database size={13} /> MongoDB Aggregation</span>
            <span><Code2 size={13} /> Pipeline visible</span>
            <span><ChartColumnIncreasing size={13} /> Análisis visual</span>
          </div>
        </div>
        <div className="nl-flow" aria-hidden="true">
          <div className="nl-flow-node"><span><Search size={18} /></span><strong>Pregunta</strong><small>Lenguaje natural</small></div>
          <ChevronRight size={18} className="nl-flow-arrow" />
          <div className="nl-flow-node nl-flow-active"><span><Sparkles size={18} /></span><strong>IA</strong><small>Genera pipeline</small></div>
          <ChevronRight size={18} className="nl-flow-arrow" />
          <div className="nl-flow-node"><span><Database size={18} /></span><strong>MongoDB</strong><small>Ejecuta consulta</small></div>
        </div>
      </header>

      <section className="nl-panel nl-editor">
        <SectionTitle icon={Search} title="Haz una pregunta"
          subtitle="Escríbela como se la preguntarías a un analista de datos"
          right={<span className="nl-chip nl-chip-orange"><Sparkles size={12} /> Consulta con IA</span>}
        />
        <textarea
          className="nl-textarea"
          rows={3}
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              consultar();
            }
          }}
          disabled={loading}
          aria-label="Escribe una pregunta sobre la blockchain de Bitcoin"
          placeholder="Ej. ¿Cuáles fueron los 10 bloques con mayor tamaño virtual y cuántas transacciones tienen?"
        />
        <div className="nl-editor-footer">
          <div className="nl-editor-tip"><Lightbulb size={14} /> Sé específico con métricas, fechas y cantidades. <kbd>Ctrl</kbd> + <kbd>Enter</kbd> para enviar.</div>
          <div className="nl-editor-buttons">
            {pregunta && !loading && (
              <button className="nl-secondary-button" type="button" onClick={() => { setPregunta(''); setError(null); }}>
                <RotateCcw size={14} /> Limpiar
              </button>
            )}
            <button className="nl-submit" type="button" onClick={() => consultar()} disabled={loading || !pregunta.trim()}>
              {loading ? <LoaderCircle className="nl-spin" size={16} /> : <Send size={16} />}
              {loading ? 'Analizando…' : 'Generar análisis'}
            </button>
          </div>
        </div>
      </section>

      <section className="nl-examples-section">
        <div className="nl-examples-heading">
          <div><span className="nl-minilabel">EMPIEZA POR AQUÍ</span><h2>Preguntas para explorar</h2></div>
          <span className="nl-examples-helper">Selecciona un ejemplo para ejecutarlo</span>
        </div>
        <div className="nl-examples-grid">
          {SAMPLES.map((sample, i) => (
            <button key={sample.pregunta} type="button" className="nl-example" disabled={loading} onClick={() => consultar(sample.pregunta)}>
              <span className="nl-example-top"><span className="nl-example-index">0{i + 1}</span><span className="nl-example-tag">{sample.tema}</span></span>
              <strong>{sample.titulo}</strong>
              <span className="nl-example-question">{sample.pregunta}</span>
              <span className="nl-example-go">Consultar <ChevronRight size={13} /></span>
            </button>
          ))}
        </div>
      </section>

      <ErrorBanner error={error} />

      {loading && (
        <div className="nl-wait" role="status" aria-live="polite">
          <span className="nl-wait-icon"><LoaderCircle size={22} className="nl-spin" /></span>
          <div><strong>Procesando tu pregunta</strong><p>La IA genera el pipeline y el servidor intenta ejecutarlo en MongoDB.</p></div>
        </div>
      )}

      {resultados && (
        <div className="nl-results" aria-live="polite">
          <div className="nl-result-heading">
            <div><span className="nl-minilabel nl-success"><Check size={12} /> CONSULTA COMPLETADA</span><h2>Resultado de tu análisis</h2></div>
            <span className="nl-chip nl-chip-green">Datos devueltos por MongoDB</span>
          </div>

          <div className="nl-stats">
            <Stat icon={Database} title="Documentos" value={formatNumber(datos.length, 0)} hint="Recuperados en esta consulta" color="var(--accent)" />
            <Stat icon={Layers3} title="Etapas del pipeline" value={formatNumber(pipeline.length, 0)} hint="Operaciones de agregación" />
            <Stat icon={Sparkles} title="Proveedor de IA" value={provider} hint={respuesta?.modelo || 'Consulta en lenguaje natural'} />
            <Stat icon={Clock3} title="Respuesta" value={duration == null ? '—' : `${formatNumber(duration, 2)} s`} hint="Tiempo observado en navegador" />
          </div>

          {respuesta?.reparado && (
            <div className="nl-notice"><Info size={16} /> El servidor reparó automáticamente el pipeline antes de ejecutar la consulta.</div>
          )}

          {datos.length ? (
            <>
              {schema.metrics.length > 0 && (
                <div className="nl-metric-row">
                  <div><span className="nl-minilabel">EXPLORAR RESULTADOS</span><h3>Vista gráfica y lectura</h3></div>
                  {schema.metrics.length > 1 && (
                    <label className="nl-metric-picker">Métrica
                      <select value={metric} onChange={(e) => setSelectedMetric(e.target.value)}>
                        {schema.metrics.map((key) => <option key={key} value={key}>{key}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )}

              {metric && (
                <div className="nl-analysis-grid">
                  <AutoViz datos={datos} metrica={metric} etiqueta={schema.labelKey} />
                  <InterpretacionAnalitica datos={datos} metrica={metric} etiqueta={schema.labelKey} />
                </div>
              )}

              <section className="nl-panel nl-table-panel">
                <SectionTitle icon={FileText} title="Resultados de MongoDB"
                  subtitle={`${formatNumber(datos.length, 0)} documentos · ${schema.columns.length} columnas`}
                  right={
                    <button className="nl-outline-button" type="button" onClick={() => downloadCSV(datos, schema.columns)}>
                      <Download size={14} /> Exportar CSV
                    </button>
                  }
                />
                <div className="table-wrap nl-table-wrap">
                  <table className="nl-table">
                    <thead><tr><th>#</th>{schema.columns.map((key) => <th key={key}>{key}</th>)}</tr></thead>
                    <tbody>
                      {datos.slice(0, visibleRows).map((row, i) => (
                        <tr key={i}><td className="nl-row-index">{i + 1}</td>
                          {schema.columns.map((key) => (
                            <td key={key} title={displayValue(row?.[key])} className={typeof row?.[key] === 'number' ? 'nl-number-cell' : ''}>
                              {displayValue(row?.[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="nl-table-footer">
                  <span>Mostrando {formatNumber(Math.min(visibleRows, datos.length), 0)} de {formatNumber(datos.length, 0)} documentos</span>
                  {visibleRows < datos.length && (
                    <button className="nl-link-button" type="button" onClick={() => setVisibleRows((v) => v + 15)}>
                      Mostrar 15 más <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="nl-empty-results"><Search size={28} /><strong>La consulta no devolvió documentos</strong><p>El pipeline se ejecutó, pero no encontró coincidencias. Prueba otro rango de fechas o revisa los campos y filtros generados.</p></div>
          )}

          <section className="nl-panel nl-code-panel">
            <SectionTitle icon={Code2} title="Pipeline generado"
              subtitle="Operaciones de agregación utilizadas en MongoDB"
              right={
                <button className="nl-outline-button" type="button" onClick={() => copiar(JSON.stringify(pipeline, null, 2), 'pipeline')}>
                  {copied === 'pipeline' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'pipeline' ? 'Copiado' : 'Copiar JSON'}
                </button>
              }
            />
            <div className="nl-code-toolbar"><span className="nl-code-dot" /><span className="nl-code-dot" /><span className="nl-code-dot" /><span className="nl-code-filename">aggregation.pipeline.json</span><span className="nl-code-lang">JSON</span></div>
            <pre className="nl-code-content"><code>{JSON.stringify(pipeline, null, 2)}</code></pre>
            <div className="nl-code-footer"><Info size={13} /> La consulta y sus resultados deben validarse antes de sacar conclusiones.</div>
          </section>
        </div>
      )}
      {copied === 'error' && <p className="nl-copy-error">No se pudo copiar automáticamente. Selecciona el texto del pipeline para copiarlo.</p>}
    </div>
  );
}

const STYLES = `
.nl-page{--nl-border:#243449;--nl-muted:#9aacc0;--nl-bright:#edf4fa;max-width:1500px;margin:0 auto;padding-bottom:46px;color:var(--text-primary)}
.nl-page *{box-sizing:border-box}
.nl-hero{display:flex;align-items:center;justify-content:space-between;gap:30px;position:relative;overflow:hidden;padding:29px 32px;margin-bottom:18px;min-height:195px;border-radius:13px;border:1px solid #344052;background:radial-gradient(circle at 83% 17%,rgba(247,147,26,.11),transparent 33%),linear-gradient(110deg,#172535 0%,#111b28 65%,#1c222a 100%)}
.nl-hero:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#ffc36b,#f7931a)}
.nl-hero-content{position:relative;z-index:1;max-width:700px}
.nl-eyebrow,.nl-minilabel{display:inline-flex;align-items:center;gap:7px;color:#f7ac4f;font-size:10px;letter-spacing:.11em;font-weight:800}
.nl-hero-heading{display:flex;align-items:center;gap:13px;margin-top:14px}
.nl-hero-icon{display:grid;place-items:center;width:48px;height:48px;flex-shrink:0;border:1px solid rgba(247,147,26,.35);border-radius:12px;background:rgba(247,147,26,.12);color:#ffb04d}
.nl-hero h1{font-size:clamp(23px,2.1vw,31px);font-weight:750;line-height:1.2;letter-spacing:-.045em;color:var(--nl-bright)}
.nl-hero h1 em{font-style:normal;color:#fca83a}
.nl-hero p{font-size:13px;line-height:1.85;color:#aab9cb;margin-top:13px;max-width:585px}
.nl-hero-tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:17px}
.nl-hero-tags span{display:inline-flex;align-items:center;gap:6px;border:1px solid #324154;border-radius:6px;padding:5px 9px;color:#afbdcc;font-size:10px;background:rgba(13,22,33,.5)}
.nl-hero-tags svg{color:#f7a343}
.nl-flow{display:flex;gap:8px;align-items:center;flex-shrink:0;z-index:1}
.nl-flow-node{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:83px}
.nl-flow-node>span{display:grid;place-items:center;width:42px;height:42px;background:#192b3c;border:1px solid #314457;border-radius:11px;color:#9bb8d6}
.nl-flow-node.nl-flow-active>span{border-color:#b5732f;color:#ffad48;background:rgba(247,147,26,.15);box-shadow:0 0 22px rgba(247,147,26,.09)}
.nl-flow-node strong{font-size:11px;color:#d7e2ed}.nl-flow-node small{font-size:9px;color:#7890a7}.nl-flow-arrow{color:#51667a;margin-bottom:27px}
.nl-panel{background:var(--bg-panel);border:1px solid var(--nl-border);border-radius:11px;padding:19px 21px;min-width:0}
.nl-section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:17px;flex-wrap:wrap}
.nl-section-ident{display:flex;align-items:center;gap:11px;min-width:0}.nl-section-icon{display:grid;place-items:center;width:34px;height:34px;flex-shrink:0;border:1px solid #2d3f52;border-radius:9px;color:#ef9c37;background:#1a2836}
.nl-section-head h3{font-size:13px;color:#edf4fa;font-weight:700;letter-spacing:0}.nl-section-head p{font-size:11px;color:#96a9bd;margin-top:3px;line-height:1.5}
.nl-section-actions{display:flex;align-items:center;gap:8px}
.nl-chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:1px solid #34455a;border-radius:100px;padding:5px 10px;font-size:10px;font-weight:700;color:#afc0d3;background:rgba(41,60,80,.33)}
.nl-chip-orange{color:#ffae4f;border-color:rgba(247,147,26,.25);background:rgba(247,147,26,.08)}
.nl-chip-green{color:#5cdbac;border-color:rgba(0,199,129,.25);background:rgba(0,199,129,.09)}
.nl-editor{margin-bottom:22px}
.nl-textarea{width:100%;resize:vertical;min-height:98px;padding:16px 17px;font-family:inherit;font-size:13px;line-height:1.8;border:1px solid #38506a;border-radius:9px;color:#e6eef7;background:#0c1622;transition:border-color .18s,box-shadow .18s}
.nl-textarea:focus{border-color:#f7931a;box-shadow:0 0 0 3px rgba(247,147,26,.09)}.nl-textarea::placeholder{color:#74899e}
.nl-editor-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:13px}
.nl-editor-tip{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:#9daec1;font-size:11px}.nl-editor-tip>svg{color:#f9aa47}.nl-editor-tip kbd{font:inherit;font-size:10px;padding:1px 5px;border-radius:4px;border:1px solid #3c5063;background:#192736;color:#d9e5f0}
.nl-editor-buttons{display:flex;align-items:center;gap:9px}
.nl-submit,.nl-secondary-button,.nl-outline-button,.nl-link-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:8px;border:1px solid transparent;font-size:11px;font-weight:700;transition:transform .12s,background .12s,border-color .12s}
.nl-submit{padding:11px 16px;color:#16100a;background:linear-gradient(130deg,#ffc16b,#f7931a);box-shadow:0 3px 14px rgba(247,147,26,.15)}.nl-submit:hover:not(:disabled){background:linear-gradient(130deg,#ffd18a,#faa13a);transform:translateY(-1px)}
.nl-submit:disabled,.nl-example:disabled{opacity:.5;cursor:not-allowed}
.nl-secondary-button,.nl-outline-button{padding:9px 12px;background:#172535;color:#b7c6d5;border-color:#34485c}.nl-secondary-button:hover,.nl-outline-button:hover{color:#fff;border-color:#56708c;background:#1b2b3c}
.nl-examples-section{margin:0 0 22px}.nl-examples-heading,.nl-result-heading{display:flex;align-items:end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:13px}
.nl-examples-heading h2,.nl-result-heading h2{font-size:18px;color:#e6eff7;margin-top:5px;font-weight:700;letter-spacing:-.025em}
.nl-examples-helper{font-size:11px;color:#8ca0b5}.nl-examples-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.nl-example{display:flex;flex-direction:column;align-items:stretch;text-align:left;gap:9px;position:relative;padding:15px 16px;border:1px solid #2b3d50;border-radius:10px;min-width:0;background:linear-gradient(145deg,#162331,#111b27);color:#e8f0f7;transition:transform .18s,border-color .18s,background .18s;white-space:normal}
.nl-example:hover:not(:disabled){transform:translateY(-2px);border-color:#a66c36;background:linear-gradient(145deg,#203041,#14202e)}
.nl-example-top{display:flex;justify-content:space-between;align-items:center}.nl-example-index{color:#f8a349;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700}.nl-example-tag{border:1px solid #34485c;border-radius:5px;padding:3px 7px;background:#1c2a3b;color:#a0b4c8;font-size:10px}
.nl-example strong{font-size:13px;font-weight:700;line-height:1.4}.nl-example-question{font-size:11px;color:#98aabd;line-height:1.6;flex:1}.nl-example-go{display:flex;align-items:center;gap:3px;font-size:11px;font-weight:700;color:#f9a64b;margin-top:2px}
.nl-wait{display:flex;align-items:center;gap:15px;border:1px solid #705127;background:rgba(247,147,26,.07);border-radius:11px;padding:22px;margin:20px 0}.nl-wait-icon{color:#f9ac48}.nl-wait strong{font-size:13px;color:#efdbc2}.nl-wait p{color:#ac9d89;font-size:11px;margin-top:4px}
@keyframes nl-spin{to{transform:rotate(360deg)}}.nl-spin{animation:nl-spin .85s linear infinite}
.nl-results{margin-top:24px}.nl-minilabel.nl-success{color:#4ed2a0}.nl-result-heading{margin-bottom:16px}
.nl-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:16px}.nl-stat{min-width:0;min-height:113px;background:linear-gradient(145deg,#162432,#121b27);border:1px solid #2a3b4f;border-radius:10px;padding:15px 16px}
.nl-stat-top{display:flex;justify-content:space-between;align-items:center;gap:7px;font-size:11px;color:#9cb0c6}.nl-stat-top svg{color:#5c7691}.nl-stat-value{margin-top:11px;font-size:clamp(19px,1.7vw,25px);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'JetBrains Mono',monospace;font-weight:700}.nl-stat-hint{font-size:10px;color:#8fa4b9;margin-top:10px;line-height:1.45;overflow:hidden;text-overflow:ellipsis}
.nl-notice{display:flex;align-items:center;gap:9px;background:#162738;border:1px solid #31506c;border-radius:9px;padding:10px 13px;margin-bottom:14px;color:#b0c9e2;font-size:11px}
.nl-metric-row{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:13px}.nl-metric-row h3{font-size:16px;font-weight:700;color:#e6eef7;margin-top:5px}
.nl-metric-picker{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;color:#a3b5c7}.nl-metric-picker select{border-color:#3b4e64;background-color:#152333;color:#e6eff8;padding:7px 24px 7px 10px;max-width:240px}
.nl-analysis-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(265px,1fr);gap:12px;margin-bottom:14px;align-items:stretch}.nl-chart-panel,.nl-insight-panel{min-width:0}
.nl-panel-note{font-size:10px;color:#8299af;margin:2px 0 0}
.nl-insight-intro{padding:13px 14px;border-radius:8px;background:rgba(247,147,26,.065);border:1px solid rgba(247,147,26,.16);color:#adbccd;font-size:11px;line-height:1.7;margin-bottom:12px}.nl-insight-intro strong{color:#ffb44f;overflow-wrap:anywhere}
.nl-insight-item{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid #263549}.nl-insight-item>div{display:flex;flex-direction:column;gap:4px;min-width:0}.nl-insight-icon{display:grid;place-items:center;width:30px;height:30px;flex-shrink:0;border-radius:8px}.nl-insight-icon.good{color:#5ee0ac;background:rgba(0,199,129,.09)}.nl-insight-icon.calm{color:#82baf9;background:rgba(59,130,246,.10)}
.nl-insight-label{font-size:10px;color:#97a9bd}.nl-insight-item strong{font:700 17px 'JetBrains Mono',monospace;color:#e9f2fb;overflow-wrap:anywhere}.nl-insight-item small{color:#a9bdd0;font-size:11px;overflow-wrap:anywhere}
.nl-insight-difference{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:14px;padding:11px;border-radius:8px;background:#182a3c;color:#a5b8cc;font-size:11px}.nl-insight-difference strong{color:#fdb25a;font:700 14px 'JetBrains Mono',monospace}
.nl-disclaimer{display:flex;align-items:flex-start;gap:8px;color:#8fa3b8;font-size:10px;line-height:1.65;margin-top:13px}.nl-disclaimer svg{flex-shrink:0;margin-top:2px}
.nl-table-panel,.nl-code-panel{margin-top:15px}.nl-table-wrap{max-height:525px;border:1px solid #27374a;border-radius:8px;overflow:auto}
.nl-table{min-width:100%;border-collapse:collapse}.nl-table thead th{padding:11px 14px;background:#1a2a3a;color:#afc0d2;font-size:10px;font-weight:700;position:sticky;top:0;z-index:1}.nl-table tbody td{padding:11px 14px;color:#d2deea;font-size:11px;border-bottom:1px solid #273749;max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nl-table tbody tr:nth-child(2n){background:rgba(24,39,54,.43)}.nl-table tbody tr:hover{background:#1d3041}.nl-table .nl-number-cell{font-family:'JetBrains Mono',monospace;color:#f1b15f}.nl-table .nl-row-index{color:#7893aa;font-family:'JetBrains Mono',monospace}
.nl-table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:11px;font-size:11px;color:#91a7bc}.nl-link-button{border:none;background:transparent;color:#f7ad55;padding:4px 0}.nl-link-button:hover{color:#ffd08b}
.nl-code-toolbar{height:34px;border:1px solid #2b3c4f;border-bottom:none;border-radius:8px 8px 0 0;background:#182736;display:flex;align-items:center;gap:6px;padding:0 13px}.nl-code-dot{width:7px;height:7px;border-radius:50%;background:#516477}.nl-code-dot:first-child{background:#a65e5c}.nl-code-dot:nth-child(2){background:#ae8951}.nl-code-dot:nth-child(3){background:#4d8e75}.nl-code-filename{font:10px 'JetBrains Mono',monospace;color:#9fb5ca;margin-left:10px}.nl-code-lang{font:10px 'JetBrains Mono',monospace;color:#7892ab;margin-left:auto}
.nl-code-content{margin:0;background:#091521;border:1px solid #2b3c4f;border-radius:0 0 8px 8px;max-height:470px;overflow:auto;padding:17px 20px;color:#b6d1e6;font:11px/1.9 'JetBrains Mono',monospace;tab-size:2;white-space:pre}.nl-code-footer{display:flex;align-items:center;gap:7px;font-size:10px;color:#8fa5ba;margin-top:10px}
.nl-empty-results{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;background:#141f2b;border:1px dashed #3b4d61;border-radius:11px;padding:37px 18px;color:#839bb2}.nl-empty-results strong{color:#e1eaf4;font-size:14px}.nl-empty-results p{font-size:11px;max-width:460px;line-height:1.7}.nl-copy-error{color:#ff9b9b;font-size:11px;margin-top:9px}
@media(max-width:1180px){.nl-flow{display:none}.nl-analysis-grid{grid-template-columns:minmax(0,1.4fr) minmax(270px,1fr)}}
@media(max-width:900px){.nl-examples-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nl-analysis-grid{grid-template-columns:1fr}.nl-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.nl-hero{padding:23px 19px;min-height:auto}.nl-hero-heading{gap:10px}.nl-hero-icon{width:42px;height:42px}.nl-hero h1{font-size:22px}.nl-panel{padding:16px 13px}.nl-examples-grid{grid-template-columns:1fr}.nl-editor-footer,.nl-editor-buttons{width:100%}.nl-submit{flex:1}.nl-section-head{align-items:flex-start}.nl-section-head h3{font-size:12px}.nl-section-actions{max-width:100%}.nl-hero-tags{gap:6px}.nl-chip{white-space:normal}.nl-stat{padding:12px}.nl-stat-value{font-size:18px}.nl-editor-tip{font-size:10px}.nl-metric-picker{width:100%}.nl-metric-picker select{flex:1;max-width:none}.nl-hero p{font-size:12px}}
`;
