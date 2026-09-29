import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Box, CircleAlert, Leaf, Search } from 'lucide-react'
import { Badge, Card, EmptyState, Loader, Modal } from '../components/ui.jsx'
import api from '../services/api.js'

export default function Materials() {
  const [materials, setMaterials] = useState([])
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [costFilter, setCostFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/materials').then(({ data }) => {
      if (active) setMaterials(data.materials || [])
    }).catch(() => {
      if (active) setError('The material library could not be loaded. Check your connection and try again.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = materials.filter((material) => {
    const matchesQuery = `${material.name} ${material.pros.join(' ')} ${material.cons.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (costFilter === 'all' || material.cost_level === costFilter)
  })

  const showDetails = async (material) => {
    setSelected(material)
    try {
      const { data } = await api.get(`/materials/${encodeURIComponent(material.name)}`)
      setSelected(data)
    } catch {
      setSelected(material)
    }
  }

  return (
    <main className="workspace-page page-width">
      <header className="workspace-heading library-heading">
        <div><p className="section-kicker">Packaging material catalogue</p><h1>Know what goes <span>into the pack.</span></h1><p>Explore barrier properties, cost, end-of-life characteristics, and practical trade-offs.</p></div>
        <div className="library-count"><strong>{materials.length || '—'}</strong><span>MATERIALS<br />IN CATALOGUE</span></div>
      </header>

      <div className="library-toolbar">
        <label className="search-field"><Search size={17} /><span className="visually-hidden">Search materials</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials or properties" /></label>
        <label className="filter-field"><span>Cost level</span><select aria-label="Filter materials by cost" value={costFilter} onChange={(event) => setCostFilter(event.target.value)}><option value="all">All costs</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        {!loading && <span className="filter-count" aria-live="polite">{filtered.length} of {materials.length}</span>}
      </div>

      {error && <div className="workspace-error" role="alert"><CircleAlert size={17} />{error}</div>}
      {loading ? <div className="library-loading"><Loader label="Loading materials" /></div> : filtered.length === 0 ? <EmptyState title="No materials match" description="Try another search term or clear the cost filter." action={<button className="button button-quiet" type="button" onClick={() => { setQuery(''); setCostFilter('all') }}>Clear filters</button>} /> : (
        <motion.div className="material-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}>
          {filtered.map((material) => <motion.article key={material.name} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } }}>
            <Card className="material-card">
              <div className="material-card-top"><span className="material-card-icon"><Box size={18} /></span><Badge tone={material.cost_level === 'low' ? 'green' : material.cost_level === 'medium' ? 'amber' : 'coral'}>{material.cost_level} cost</Badge></div>
              <h2>{material.name}</h2>
              <div className="material-figures"><div><span>Oxygen transmission</span><strong>{material.otr} <small>cc/m²·day</small></strong></div><div><span>Water vapour transmission</span><strong>{material.wvtr} <small>g/m²·day</small></strong></div></div>
              <div className="material-sustainability"><span><Leaf size={14} /> Sustainability</span><strong>{material.sustainability_score}<small>/100</small></strong><div className="sustain-track"><i style={{ width: `${material.sustainability_score}%` }} /></div></div>
              <div className="material-card-bottom"><span>{material.recyclability}% recyclable</span><button className="text-link" type="button" onClick={() => showDetails(material)} aria-label={`View details for ${material.name}`}>Details <ArrowUpRight size={15} /></button></div>
            </Card>
          </motion.article>)}
        </motion.div>
      )}

      <Modal open={Boolean(selected)} title={selected?.name || 'Material details'} onClose={() => setSelected(null)}>
        {selected && <div className="material-modal-content">
          <div className="modal-stat-grid"><div><span>Oxygen transmission rate</span><strong>{selected.otr} cc/m²·day</strong></div><div><span>Water vapour transmission rate</span><strong>{selected.wvtr} g/m²·day</strong></div><div><span>Cost level</span><strong className="capitalize">{selected.cost_level}</strong></div><div><span>Sustainability score</span><strong>{selected.sustainability_score}/100</strong></div><div><span>Recyclability</span><strong>{selected.recyclability}%</strong></div><div><span>Biodegradability</span><strong>{selected.biodegradability}%</strong></div></div>
          <div className="modal-pros-cons"><section><h3>Advantages</h3><ul>{selected.pros.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>Considerations</h3><ul>{selected.cons.map((item) => <li key={item}>{item}</li>)}</ul></section></div>
        </div>}
      </Modal>
    </main>
  )
}
