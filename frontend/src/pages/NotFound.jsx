import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="not-found page-width">
      <span className="section-kicker">404 / OUT OF RANGE</span>
      <h1>This page isn’t in the pack.</h1>
      <p>That address doesn’t match a Packwise view.</p>
      <Link className="button button-primary" to="/"><ArrowLeft size={16} /> Back to home</Link>
    </main>
  )
}
