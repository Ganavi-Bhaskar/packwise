import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert, Eye, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, Loader, Modal, Toast } from '../components/ui.jsx'
import api from '../services/api.js'

const PAGE_SIZE = 10
const categories = ['fruits', 'vegetables', 'dairy', 'meat', 'seafood', 'bakery', 'grains', 'snacks', 'beverages', 'frozen', 'spices', 'oils']

export default function History() {
  const [page, setPage] = useState({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 })
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState('')
  const [offset, setOffset] = useState(0)

  const loadHistory = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/history', { params: { limit: PAGE_SIZE, offset, ...(category !== 'all' ? { food_category: category } : {}) } })
      .then(({ data }) => setPage(data))
      .catch(() => setError('Recommendation history could not be loaded. Please try again.'))
      .finally(() => setLoading(false))
  }, [category, offset])

  useEffect(() => { loadHistory() }, [loadHistory])

  const removeRecord = async () => {
    if (!deleting) return
    try {
      await api.delete(`/history/${deleting.id}`)
      setDeleting(null)
      setToast('Recommendation removed from history.')
      loadHistory()
    } catch {
      setDeleting(null)
      setError('This recommendation could not be deleted. Please retry.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(page.total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <main className="workspace-page page-width">
      <header className="workspace-heading history-heading">
        <div><p className="section-kicker">Saved activity</p><h1>Recommendation <span>history.</span></h1><p>Review previous food profiles and the material options they produced.</p></div>
        <label className="history-filter"><span>Food category</span><select aria-label="Filter history by food category" value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0) }}><option value="all">All categories</option>{categories.map((item) => <option value={item} key={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
      </header>

      {error && <div className="workspace-error" role="alert"><CircleAlert size={17} />{error}<button className="inline-retry" type="button" onClick={loadHistory}>Retry</button></div>}
      <Card className="history-panel">
        {loading ? <div className="history-loading"><Loader label="Loading recommendation history" /></div> : page.items.length === 0 ? <EmptyState title="No saved recommendations yet" description="Your completed recommendations will appear here for quick review." action={<Link className="button button-primary" to="/recommend">Create recommendation <ArrowRight size={15} /></Link>} /> : <>
          <div className="history-table-wrap"><table className="history-table"><caption className="visually-hidden">Saved food packaging recommendations</caption><thead><tr><th scope="col">Food profile</th><th scope="col">Created</th><th scope="col">Top material</th><th scope="col">Fit score</th><th scope="col">Shelf-life estimate</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
            {page.items.map((item) => {
              const best = item.result.recommendations?.[0]
              return <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <td><strong className="capitalize">{item.food_category}</strong><span className="history-subline">{item.input_data.storage_temp}°C · {item.input_data.required_shelf_life_days} day target</span></td>
                <td><span className="history-date"><CalendarDays size={13} />{new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></td>
                <td>{best?.material || '—'}</td>
                <td>{best ? <Badge tone={best.suitability_score >= 70 ? 'green' : 'amber'}>{best.suitability_score}%</Badge> : '—'}</td>
                <td>{best ? `${best.predicted_shelf_life_days} days` : '—'}</td>
                <td><div className="history-actions"><button className="icon-button table-action" type="button" onClick={() => setViewing(item)} aria-label={`View ${item.food_category} recommendation`} title="View details"><Eye size={15} /></button><button className="icon-button table-action delete-action" type="button" onClick={() => setDeleting(item)} aria-label={`Delete ${item.food_category} recommendation`} title="Delete"><Trash2 size={15} /></button></div></td>
              </motion.tr>
            })}
          </tbody></table></div>
          <div className="pagination"><span>Showing {offset + 1}–{Math.min(offset + page.items.length, page.total)} of {page.total}</span><div><button className="icon-button" type="button" aria-label="Previous page" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ArrowLeft size={15} /></button><span>Page {currentPage} of {totalPages}</span><button className="icon-button" type="button" aria-label="Next page" disabled={offset + PAGE_SIZE >= page.total} onClick={() => setOffset(offset + PAGE_SIZE)}><ArrowRight size={15} /></button></div></div>
        </>}
      </Card>

      <Modal open={Boolean(viewing)} title="Recommendation details" onClose={() => setViewing(null)}>
        {viewing && <div className="history-detail"><div className="history-detail-profile"><span className="capitalize">{viewing.food_category}</span><span>{viewing.input_data.storage_temp}°C storage</span><span>{viewing.input_data.required_shelf_life_days} day target</span></div><p>{viewing.result.explanation}</p><ol>{viewing.result.recommendations.map((item) => <li key={item.material}><strong>{item.material}</strong><span>{item.suitability_score}% fit · {item.predicted_shelf_life_days} days</span><small>{item.explanation}</small></li>)}</ol></div>}
      </Modal>
      <Modal open={Boolean(deleting)} title="Delete this recommendation?" onClose={() => setDeleting(null)}>
        {deleting && <div className="delete-confirm"><p>This saved {deleting.food_category} profile and its recommendation result will be removed from history.</p><div><button className="button button-quiet" type="button" onClick={() => setDeleting(null)}>Keep it</button><button className="button delete-confirm-button" type="button" onClick={removeRecord}><Trash2 size={15} /> Delete record</button></div></div>}
      </Modal>
      <Toast message={toast} onDismiss={() => setToast('')} />
    </main>
  )
}
