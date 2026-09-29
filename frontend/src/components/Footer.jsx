import { ArrowUpRight, Leaf, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <Link className="brand" to="/" aria-label="Packwise home">
            <span className="brand-mark"><PackageCheck size={19} /></span>
            <span>packwise<span className="brand-period">.</span></span>
          </Link>
          <p>Better protection for food.<br />Less guesswork for the people who pack it.</p>
        </div>
        <div className="footer-note">
          <span className="footer-leaf"><Leaf size={17} /></span>
          <span>Designed for thoughtful<br />packaging decisions.</span>
        </div>
        <a className="footer-top" href="#top">Back to top <ArrowUpRight size={15} /></a>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Packwise</span>
        <span>Recommendations are decision support, not food-safety certification.</span>
      </div>
    </footer>
  )
}
