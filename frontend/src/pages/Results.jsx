import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ArrowRight, BadgeCheck, CircleAlert, FileDown, Leaf, PackageCheck, RotateCcw, Sparkles } from 'lucide-react'
import { Badge, Card, EmptyState, Loader, Toast } from '../components/ui.jsx'
import api from '../services/api.js'

const materialColors = ['#17864a', '#e1944f', '#498a9d']
const metricLabels = ['Suitability', 'Shelf life', 'Sustainability', 'Recyclability', 'Model confidence']
const chartMargin = { top: 12, right: 42, bottom: 10, left: 48 }

function humanizeFeature(feature) {
  return feature
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace('pH', 'pH')
}

function resultFromStorage(locationState) {
  if (locationState?.result && locationState?.profile) return locationState
  try {
    const saved = window.sessionStorage.getItem('packwise-last-recommendation')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export default function Results() {
  const location = useLocation()
  const navigate = useNavigate()
  const [resultState] = useState(() => resultFromStorage(location.state))
  const [metrics, setMetrics] = useState(null)
  const [metricsError, setMetricsError] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfMessage, setPdfMessage] = useState('')
  const [pdfError, setPdfError] = useState(false)

  useEffect(() => {
    if (!resultState?.result?.recommendations?.length) {
      navigate('/recommend', { replace: true })
      return
    }
    let active = true
    api.get('/model/metrics')
      .then(({ data }) => { if (active) setMetrics(data) })
      .catch(() => { if (active) setMetricsError(true) })
    return () => { active = false }
  }, [navigate, resultState])

  if (!resultState?.result?.recommendations?.length) {
    return <main className="results-page page-width"><div className="results-loading"><Loader label="Opening recommendation form" /></div></main>
  }

  const { result, profile } = resultState
  const recommendations = result.recommendations
  const maxShelfLife = Math.max(profile.required_shelf_life_days, ...recommendations.map((item) => item.predicted_shelf_life_days), 1)
  const radarData = metricLabels.map((metric) => {
    const point = { metric }
    recommendations.forEach((item, index) => {
      const score = metric === 'Suitability'
        ? item.suitability_score
        : metric === 'Shelf life'
          ? Math.min(100, (item.predicted_shelf_life_days / maxShelfLife) * 100)
          : metric === 'Sustainability'
            ? item.sustainability_score
            : metric === 'Recyclability'
              ? item.recyclability
              : item.probability * 100
      point[`option${index + 1}`] = Math.round(score)
    })
    return point
  })
  const importance = (metrics?.feature_importance || []).slice(0, 9).map((item) => ({
    feature: humanizeFeature(item.feature),
    importance: Number((item.importance * 100).toFixed(2)),
  }))
  const safetyFiltered = result.safety_filtered_materials || []

  const downloadReport = async () => {
    setPdfLoading(true)
    setPdfMessage('')
    setPdfError(false)
    try {
      const { jsPDF } = await import('jspdf')
      const document = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = document.internal.pageSize.getWidth()
      const pageHeight = document.internal.pageSize.getHeight()
      const margin = 46
      let y = 56
      const addParagraph = (text, fontSize = 10, color = [68, 82, 72], lineGap = 5) => {
        document.setFontSize(fontSize)
        document.setTextColor(...color)
        const lines = document.splitTextToSize(text, pageWidth - margin * 2)
        if (y + lines.length * (fontSize + lineGap) > pageHeight - margin) {
          document.addPage()
          y = margin
        }
        document.text(lines, margin, y)
        y += lines.length * (fontSize + lineGap) + 7
      }

      document.setFillColor(24, 112, 61)
      document.rect(0, 0, pageWidth, 12, 'F')
      document.setTextColor(26, 49, 35)
      document.setFont('helvetica', 'bold')
      document.setFontSize(23)
      document.text('Packwise recommendation report', margin, y)
      y += 24
      addParagraph(`Generated ${new Date().toLocaleString()}`, 9, [105, 119, 110])
      addParagraph(`Food profile: ${profile.food_category} | Storage: ${profile.storage_temp}°C | Humidity: ${profile.relative_humidity}% | Transport: ${profile.transport_days} days | Shelf-life target: ${profile.required_shelf_life_days} days`, 10, [45, 63, 51])
      y += 4
      addParagraph('Recommendation overview', 14, [24, 112, 61])
      addParagraph(result.explanation, 10)
      recommendations.forEach((item, index) => {
        y += 3
        addParagraph(`${index + 1}. ${item.material} — ${item.suitability_score}% suitability`, 12, [26, 49, 35])
        addParagraph(`Confidence ${(item.probability * 100).toFixed(1)}% | Estimated shelf life ${item.predicted_shelf_life_days} days | Cost ${item.cost_level} | Sustainability ${item.sustainability_score}/100 | Recyclability ${item.recyclability}%`, 9)
        addParagraph(`Why: ${item.explanation}`, 9)
        if (item.warnings?.length) addParagraph(`Safety and handling notes: ${item.warnings.join(' ')}`, 9, [142, 82, 33])
        if (item.pros?.length) addParagraph(`Advantages: ${item.pros.join('; ')}`, 9)
        if (item.cons?.length) addParagraph(`Consider: ${item.cons.join('; ')}`, 9)
      })
      y += 4
      addParagraph('Important: decision support only. Validate food-contact compliance, packaging performance, and shelf life through appropriate testing. Shelf-life estimates shown here are profile-level model outputs, not laboratory-validated material-specific claims.', 8, [105, 119, 110])
      document.save(`packwise-${profile.food_category}-recommendation.pdf`)
      setPdfMessage('PDF report downloaded.')
    } catch {
      setPdfError(true)
      setPdfMessage('The PDF report could not be created. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <main className="results-page page-width">
      <div className="results-topline">
        <Link className="back-link" to="/recommend"><ArrowLeft size={15} /> Edit food profile</Link>
        <span className="results-tag"><Sparkles size={14} /> RECOMMENDATION READY</span>
      </div>
      <section className="results-heading">
        <div><p className="section-kicker">Your packaging shortlist</p><h1>Three options. <span>Clear trade-offs.</span></h1><p>{result.explanation}</p></div>
        <div className="results-profile"><span>PROFILE</span><strong>{profile.food_category}</strong><small>{profile.storage_temp}°C · {profile.required_shelf_life_days} day target</small></div>
      </section>

      {safetyFiltered.length > 0 && <div className="safety-notice" role="status"><CircleAlert size={18} /><p><strong>{safetyFiltered.length} option{safetyFiltered.length === 1 ? '' : 's'} filtered for barrier safety.</strong> {safetyFiltered.join(', ')} did not meet the minimum safety rules for this profile.</p></div>}

      <section className="recommendation-grid" aria-label="Recommended materials">
        {recommendations.map((item, index) => (
          <Card className={`result-card${index === 0 ? ' result-card-leading' : ''}`} key={item.material}>
            <div className="result-card-top"><span className="result-rank">0{index + 1} <i>{index === 0 ? 'BEST FIT' : 'ALTERNATIVE'}</i></span><Badge tone={item.suitability_score >= 70 ? 'green' : item.suitability_score >= 50 ? 'amber' : 'slate'}>{item.suitability_score}% fit</Badge></div>
            <div className="result-material-icon"><PackageCheck size={21} /></div>
            <h2>{item.material}</h2>
            <p className="result-explanation">{item.explanation}</p>
            <div className="result-metrics">
              <div><span>Confidence</span><strong>{(item.probability * 100).toFixed(1)}%</strong></div>
              <div><span>Profile shelf life</span><strong>{item.predicted_shelf_life_days} days</strong></div>
              <div><span>Cost</span><strong className="capitalize">{item.cost_level}</strong></div>
            </div>
            <div className="result-badges"><Badge tone="green"><Leaf size={12} /> {item.sustainability_score}/100 sustainable</Badge><Badge tone="slate">{item.recyclability}% recyclable</Badge></div>
            {item.warnings?.length > 0 && <ul className="result-warnings">{item.warnings.map((warning) => <li key={warning}><CircleAlert size={13} />{warning}</li>)}</ul>}
            <div className="pros-cons">
              <div><span className="list-heading">ADVANTAGES</span><ul>{item.pros.slice(0, 3).map((pro) => <li key={pro}><BadgeCheck size={14} />{pro}</li>)}</ul></div>
              <div><span className="list-heading">CONSIDER</span><ul>{item.cons.slice(0, 2).map((con) => <li key={con}>{con}</li>)}</ul></div>
            </div>
          </Card>
        ))}
      </section>

      <section className="explanation-panel">
        <span className="explanation-icon"><Sparkles size={18} /></span>
        <div><span className="section-kicker">WHY THESE OPTIONS?</span><p>{result.explanation} The shelf-life figure is a profile-level estimate from the trained model, not a separate laboratory-validated result for each material.</p></div>
      </section>

      <section className="charts-section">
        <div className="charts-heading"><div><p className="section-kicker">Compare at a glance</p><h2>How the options <span>stack up.</span></h2></div><p>Scores are relative to this food profile and its stated priorities.</p></div>
        <div className="charts-grid">
          <Card className="chart-card">
            <div className="chart-title"><div><span className="chart-overline">MULTI-DIMENSION VIEW</span><h3>Material fit profile</h3></div><span className="chart-key-note">Normalized to 100</span></div>
            <div className="radar-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="62%" margin={chartMargin}>
                  <PolarGrid stroke="var(--chart-grid)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--chart-muted)', fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  {recommendations.map((item, index) => <Radar key={item.material} name={item.material} dataKey={`option${index + 1}`} stroke={materialColors[index]} fill={materialColors[index]} fillOpacity={0.12} strokeWidth={2} />)}
                  <Tooltip contentStyle={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">{recommendations.map((item, index) => <span key={item.material}><i style={{ background: materialColors[index] }} />{item.material}</span>)}</div>
          </Card>

          <Card className="chart-card">
            <div className="chart-title"><div><span className="chart-overline">GLOBAL MODEL SIGNALS</span><h3>What influenced the ranking</h3></div><span className="chart-key-note">Relative importance</span></div>
            {metricsError && <div className="chart-message"><CircleAlert size={16} /> Model feature importance is unavailable right now.</div>}
            {!metrics && !metricsError && <div className="importance-loading"><Loader label="Loading feature importance" /></div>}
            {metrics && importance.length === 0 && <div className="chart-message">No feature importance data was included in the model metrics.</div>}
            {importance.length > 0 && <div className="importance-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={importance} layout="vertical" margin={{ top: 0, right: 18, bottom: 0, left: 8 }} barCategoryGap={9}>
                  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="feature" type="category" width={122} tick={{ fill: 'var(--chart-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Importance']} contentStyle={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', fontSize: 11 }} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    {importance.map((entry, index) => <Cell key={entry.feature} fill={index === 0 ? '#17864a' : index % 2 === 0 ? '#6eaa78' : '#d3ae4d'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>}
            <p className="chart-caption">Global importance describes the trained model overall; it is not a per-request causal explanation.</p>
          </Card>
        </div>
      </section>

      <div className="results-actions"><button className="button button-quiet" type="button" disabled={pdfLoading} onClick={downloadReport}>{pdfLoading ? <Loader label="Preparing PDF report" /> : <FileDown size={16} />} {pdfLoading ? 'Preparing report…' : 'Download PDF report'}</button><Link className="button button-quiet" to="/recommend"><RotateCcw size={15} /> Adjust profile</Link><Link className="button button-primary" to="/recommend">Start another recommendation <ArrowRight size={16} /></Link></div>
      <p className="results-disclaimer">Decision support only. Confirm packaging performance, food-contact compliance, and shelf life through appropriate testing.</p>
      <Toast message={pdfMessage} tone={pdfError ? 'error' : 'success'} onDismiss={() => setPdfMessage('')} />
    </main>
  )
}
