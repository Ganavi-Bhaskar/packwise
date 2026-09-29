import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowUpRight, Leaf, Menu, Moon, PackageCheck, Sun, X } from 'lucide-react'
import { useTheme } from '../hooks/ThemeProvider.jsx'

const links = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Compare', to: '/compare' },
  { label: 'Materials', to: '/materials' },
  { label: 'History', to: '/history' },
  { label: 'Insights', to: '/insights' },
]

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Main navigation">
        <Link className="brand" to="/" aria-label="Packwise home" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark"><PackageCheck size={20} strokeWidth={2.1} /></span>
          <span>packwise<span className="brand-period">.</span></span>
        </Link>

        <div className={`nav-links${menuOpen ? ' nav-links-open' : ''}`} id="primary-navigation">
          {links.map((link) => link.to ? (
            <NavLink key={link.label} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>
          ) : (
            <a key={link.label} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>
          ))}
          <Link className="mobile-nav-cta" to="/recommend" onClick={() => setMenuOpen(false)}>
            Get a recommendation <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="nav-actions">
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-pressed={theme === 'dark'}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <Link className="button button-primary nav-cta" to="/recommend">
            Get a recommendation <ArrowUpRight size={16} />
          </Link>
          <button
            className="icon-button menu-toggle"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>
    </header>
  )
}
