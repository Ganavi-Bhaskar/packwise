import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle, ArrowRight, Check, GitCompareArrows, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, Loader } from '../components/ui.jsx'
import api from '../services/api.js'

const fallbackProfile = {
  food_category: 'fruits', moisture_content: 86, fat_content: 1, pH: 4.1, water_activity: 0.97,
  respiration_rate: 'high', oxygen_sensitivity: 'medium', light_sensitivity: 'medium', storage_temp: 8,
  relative_humidity: 88, transport_days: 5, required_shelf_life_days: 14, budget_level: 'medium',
  sustainability_priority: 'high',
}

function getSavedRecommendation() {
  try { return JSON.parse(window.sessionStorage.getItem('packwise-last-recommendation')) } catch { return null }
}

export default function Compare() {
  const saved = getSavedRecommendation()
  const [materials, setMaterials] = useState([])
  const [selected, setSelected] = useState(() => saved?.result?.recommendations?.slice(0, 2).map((item) => item.material) || [])
  const [profile] = useState(saved?.profile || fallbackProfile)
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/materials').then(({ data }) => {
      if (active) setMaterials(data.materials || [])
    }).catch(() => {
      if (active) setError('Could not load the material catalogue. Check that the API is running.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const toggleMaterial = (name) => {
    setError('')
    setComparison(null)
    setSelected((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : current.length < 3 ? [...current, name] : current)
  }

  const runComparison = async () => {
    if (selected.length < 2 || selected.length > 3) return
    setComparing(true)
    setError('')
    try {
      const { data } = await api.post('/compare', { ...profile, material_names: selected })
      setComparison(data.materials || [])
    } catch (requestError) {
      const detail = requestError.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Comparison failed. Please try again.')
    } finally {
      setComparing(false)
    }
  }

  const chartData = comparison?.map((item) => ({
    material: item.material,
    'Suitability': item.suitability_score,
    'Sustainability': item.sustainability_score,
    'Recyclability': item.recyclability,
    'Model confidence': Number((item.probability * 100).toFixed(1)),
  })) || []

  return (
    <main className="workspace-page page-width">
      <header className="workspace-heading">
        <div><p className="section-kicker">Packaging options</p><h1>Compare materials <span>side by side.</span></h1><p>Use one food profile to see how two or three materials trade off protection, fit, cost, and sustainability.</p></div>
        <div className="profile-chip"><span>FOOD PROFILE</span><strong>{profile.food_category}</strong><small>{profile.storage_temp}°C · {profile.required_shelf_life_days} day target</small></div>
      </header>

      {error && <div className="workspace-error" role="alert"><AlertCircle size={17} />{error}</div>}
      <section className="compare-layout">
        <div className="compare-picker">
          <div className="compare-picker-heading"><div><h2>Choose materials</h2><p>Select 2 or 3 to compare</p></div><Badge tone={selected.length >= 2 ? 'green' : 'amber'}>{selected.length}/3 selected</Badge></div>
          {loading ? <Loader label="Loading materials" /> : materials.length === 0 ? <EmptyState title="No materials available" description="The material catalogue is empty or unavailable." /> : (
            <div className="compare-material-list">
              {materials.map((material) => {
                const checked = selected.includes(material.name)
                const disabled = !checked && selected.length >= 3
                return <label className={`compare-choice${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`} key={material.name}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleMaterial(material.name)} />
                  <span className="choice-check"><Check size={13} /></span>
                  <span className="choice-copy"><strong>{material.name}</strong><small>{material.cost_level} cost · {material.sustainability_score}/100 sustainability</small></span>
                </label>
              })}
            </div>
          )}
          <button className="button button-primary compare-submit" type="button" disabled={selected.length < 2 || comparing || loading} onClick={runComparison}>
            {comparing ? <><LoaderCircle className="spin-icon" size={16} /> Comparing…</> : <><GitCompareArrows size={16} /> Compare selected</>}
          </button>
          <p className="compare-safety-note">Unsafe choices remain visible with a warning so the trade-off is explicit.</p>
        </div>

        <div className="compare-results" aria-live="polite">
          {!comparison && !comparing && <EmptyState title="Your comparison will appear here" description="Choose materials on the left, then compare their scores against the current food profile." action={<Link className="text-link" to="/recommend">Edit food profile <ArrowRight size={15} /></Link>} />}
          {comparing && <div className="compare-loading"><Loader label="Comparing selected materials" /></div>}
          {comparison && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="comparison-content">
            <div className="comparison-title"><div><span className="section-kicker">SAME FOOD PROFILE</span><h2>Material scorecard</h2></div><span className="comparison-food">{profile.food_category}</span></div>
            <div className="comparison-table-wrap">
              <table className="comparison-table"><caption className="visually-hidden">Comparison of selected packaging materials</caption><thead><tr><th scope="col">Measure</th>{comparison.map((item) => <th scope="col" key={item.material}>{item.material}</th>)}</tr></thead><tbody>
                <tr><th scope="row">Suitability</th>{comparison.map((item) => <td key={item.material}><strong>{item.suitability_score}</strong><span>/100</span></td>)}</tr>
                <tr><th scope="row">Model confidence</th>{comparison.map((item) => <td key={item.material}>{(item.probability * 100).toFixed(1)}%</td>)}</tr>
                <tr><th scope="row">Profile shelf life</th>{comparison.map((item) => <td key={item.material}>{item.predicted_shelf_life_days} days</td>)}</tr>
                <tr><th scope="row">Cost</th>{comparison.map((item) => <td className="capitalize" key={item.material}>{item.cost_level}</td>)}</tr>
                <tr><th scope="row">Sustainability</th>{comparison.map((item) => <td key={item.material}>{item.sustainability_score}/100</td>)}</tr>
                <tr><th scope="row">Recyclability</th>{comparison.map((item) => <td key={item.material}>{item.recyclability}%</td>)}</tr>
              </tbody></table>
            </div>
            <Card className="compare-chart-card"><div className="chart-title"><div><span className="chart-overline">RELATIVE SCORES</span><h3>Trade-offs by dimension</h3></div></div><div className="compare-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="material" tick={{ fill: 'var(--chart-muted)', fontSize: 9 }} interval={0} /><YAxis domain={[0, 100]} tick={{ fill: 'var(--chart-muted)', fontSize: 8 }} width={28} /><Tooltip contentStyle={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 9 }} /><Bar dataKey="Suitability" fill="#17864a" radius={[3, 3, 0, 0]} /><Bar dataKey="Sustainability" fill="#d3ae4d" radius={[3, 3, 0, 0]} /><Bar dataKey="Recyclability" fill="#498a9d" radius={[3, 3, 0, 0]} /><Bar dataKey="Model confidence" fill="#e1944f" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
            <div className="comparison-cards">{comparison.map((item) => <Card key={item.material} className="comparison-detail"><h3>{item.material}</h3><p>{item.explanation}</p>{item.warnings.length > 0 && <ul className="result-warnings">{item.warnings.map((warning) => <li key={warning}><AlertCircle size={13} />{warning}</li>)}</ul>}</Card>)}</div>
            <p className="compare-disclaimer">Shelf-life estimates are profile-level, not material-specific laboratory results.</p>
          </motion.div>}
        </div>
      </section>
    </main>
  )
}
