import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertCircle, Database, Layers3, Target } from 'lucide-react'
import { Badge, Card, EmptyState, Loader } from '../components/ui.jsx'
import api from '../services/api.js'

const modelColors = ['#17864a', '#d3ae4d', '#498a9d', '#df795f']

function scoreTone(value) {
  if (value >= 0.7) return 'heat-strong'
  if (value >= 0.4) return 'heat-medium'
  if (value >= 0.15) return 'heat-low'
  return 'heat-minimal'
}

export default function Insights() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/model/metrics').then(({ data }) => {
      if (active) setMetrics(data)
    }).catch(() => {
      if (active) setError('Model metrics are unavailable. Confirm the API and trained artifacts are available.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <main className="workspace-page page-width insights-page"><div className="insights-loading"><Loader label="Loading model insights" /></div></main>

  if (error) return <main className="workspace-page page-width insights-page"><EmptyState title="Insights unavailable" description={error} action={<button className="button button-quiet" type="button" onClick={() => { setLoading(true); setError(''); api.get('/model/metrics').then(({ data }) => setMetrics(data)).catch(() => setError('Model metrics are still unavailable.')).finally(() => setLoading(false)) }}>Retry</button>} /></main>

  const classifier = metrics.material_classifier || {}
  const regressor = metrics.shelf_life_regressor || {}
  const dataset = metrics.dataset || {}
  const featureImportance = (metrics.feature_importance || []).slice(0, 12).map((item) => ({
    feature: item.feature.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    importance: Number((item.importance * 100).toFixed(2)),
  }))
  const matrix = metrics.confusion_matrix || { labels: [], values: [] }
  const modelComparison = Object.entries(metrics.comparison?.classification || {}).map(([name, values]) => ({
    name,
    accuracy: values.cv_accuracy_mean * 100,
    macroF1: values.cv_f1_macro_mean * 100,
  }))
  const regressorComparison = Object.entries(metrics.comparison?.regression || {}).map(([name, values]) => ({
    name,
    rmse: values.cv_rmse_mean,
    r2: values.cv_r2_mean * 100,
  }))

  return (
    <main className="workspace-page page-width insights-page">
      <header className="workspace-heading insights-heading">
        <div><p className="section-kicker">Model transparency</p><h1>Performance, <span>in context.</span></h1><p>Evaluation results for the current synthetic-data model build. Use these to understand the system’s limits as well as its strengths.</p></div>
        <Badge tone="amber">Synthetic training data</Badge>
      </header>

      <div className="insights-stat-grid">
        <MetricCard icon={Target} label="Classifier accuracy" value={`${(classifier.holdout_accuracy * 100).toFixed(1)}%`} note={`${classifier.selected_model} · held-out data`} />
        <MetricCard icon={Layers3} label="Top-3 accuracy" value={`${(classifier.holdout_top_3_accuracy * 100).toFixed(1)}%`} note="Correct material appears in shortlist" />
        <MetricCard icon={Activity} label="Shelf-life RMSE" value={`${regressor.holdout_rmse_days.toFixed(1)} d`} note={`${regressor.selected_model} · held-out data`} />
        <MetricCard icon={Database} label="Evaluation rows" value={dataset.rows?.toLocaleString() || '—'} note={`${dataset.cross_validation_folds || 5}-fold cross-validation`} />
      </div>

      <div className="insights-model-strip"><span><strong>Material classifier</strong>{classifier.selected_model}</span><span><strong>Macro F1</strong>{(classifier.holdout_f1_macro * 100).toFixed(1)}%</span><span><strong>Shelf-life R²</strong>{regressor.holdout_r2.toFixed(3)}</span><span><strong>Material classes</strong>{dataset.material_classes?.length || matrix.labels.length}</span></div>

      <section className="insights-chart-grid">
        <Card className="insights-chart-card"><ChartHeading kicker="CLASSIFIER · CROSS-VALIDATION" title="Candidate model comparison" /><div className="insight-chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={modelComparison} margin={{ top: 8, right: 8, bottom: 3, left: -14 }}><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="name" tick={{ fill: 'var(--chart-muted)', fontSize: 8 }} interval={0} /><YAxis domain={[0, 60]} tick={{ fill: 'var(--chart-muted)', fontSize: 8 }} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`]} contentStyle={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', fontSize: 10 }} /><Bar dataKey="accuracy" name="Accuracy" radius={[3, 3, 0, 0]}>{modelComparison.map((item, index) => <Cell key={item.name} fill={modelColors[index % modelColors.length]} />)}</Bar><Bar dataKey="macroF1" name="Macro F1" fill="#a6bd6a" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><p className="insights-caption">Five-fold scores use the training split. Holdout scores shown above are measured on data not used for fitting.</p></Card>

        <Card className="insights-chart-card"><ChartHeading kicker="FEATURE IMPORTANCE" title="What the classifier uses" /><div className="insight-feature-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={featureImportance} layout="vertical" margin={{ top: 2, right: 14, bottom: 2, left: 4 }} barCategoryGap={7}><CartesianGrid horizontal={false} stroke="var(--chart-grid)" /><XAxis type="number" hide /><YAxis dataKey="feature" type="category" width={122} tick={{ fill: 'var(--chart-muted)', fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value}%`, 'Relative importance']} contentStyle={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', fontSize: 10 }} /><Bar dataKey="importance" name="Importance" radius={[0, 3, 3, 0]}>{featureImportance.map((item, index) => <Cell key={item.feature} fill={modelColors[index % modelColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div><p className="insights-caption">Global feature importance describes model behavior overall; it is not a causal explanation for any one recommendation.</p></Card>
      </section>

      <section className="insights-lower-grid">
        <Card className="insights-chart-card"><ChartHeading kicker="REGRESSOR · CROSS-VALIDATION" title="Shelf-life model comparison" /><div className="regressor-list">{regressorComparison.map((item, index) => <div className="regressor-row" key={item.name}><span className="regressor-swatch" style={{ background: modelColors[index] }} /><strong>{item.name}</strong><span>{item.rmse.toFixed(1)} d RMSE</span><Badge tone={item.r2 >= 0.85 ? 'green' : 'amber'}>R² {item.r2.toFixed(1)}%</Badge></div>)}</div><p className="insights-caption">Lower RMSE is better. Synthetic target generation strongly shapes these scores.</p></Card>

        <Card className="insights-chart-card confusion-card"><ChartHeading kicker="HELD-OUT CLASSIFICATION" title="Confusion matrix" /><div className="confusion-wrap"><table className="confusion-table"><caption className="visually-hidden">Confusion matrix for material classifier</caption><thead><tr><th scope="col">Actual ↓ / Predicted →</th>{matrix.labels.map((label) => <th scope="col" key={label} title={label}>{label}</th>)}</tr></thead><tbody>{matrix.values.map((row, rowIndex) => { const max = Math.max(...row, 1); return <tr key={matrix.labels[rowIndex]}><th scope="row" title={matrix.labels[rowIndex]}>{matrix.labels[rowIndex]}</th>{row.map((value, colIndex) => <td key={`${rowIndex}-${colIndex}`} className={rowIndex === colIndex ? 'matrix-diagonal' : ''} style={{ '--cell-opacity': Math.max(0.08, value / max) }} aria-label={`${matrix.labels[rowIndex]} predicted as ${matrix.labels[colIndex]}: ${value}`}>{value}</td>)}</tr> })}</tbody></table></div><p className="insights-caption">Rows are actual classes; columns are predictions. Darker cells indicate higher counts.</p></Card>
      </section>

      <div className="insights-caveat"><AlertCircle size={17} /><p><strong>Read these metrics carefully.</strong> The model was trained on synthetic, rule-generated data. Strong shelf-life scores measure agreement with those generated rules, not real-world or laboratory-validated shelf life.</p></div>
    </main>
  )
}

function MetricCard({ icon: Icon, label, value, note }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><Card className="insight-metric"><span className="insight-metric-icon"><Icon size={17} /></span><span className="insight-metric-label">{label}</span><strong>{value}</strong><small>{note}</small></Card></motion.div>
}

function ChartHeading({ kicker, title }) {
  return <div className="chart-title"><div><span className="chart-overline">{kicker}</span><h3>{title}</h3></div></div>
}
