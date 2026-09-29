import { Component, useEffect, useRef } from 'react'
import { AlertCircle, Check, X } from 'lucide-react'

export function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return <Tag className={`surface-card ${className}`.trim()} {...props}>{children}</Tag>
}

const badgeStyles = {
  green: 'badge-green',
  amber: 'badge-amber',
  slate: 'badge-slate',
  coral: 'badge-coral',
}

export function Badge({ tone = 'green', children, className = '' }) {
  return <span className={`badge ${badgeStyles[tone] || badgeStyles.green} ${className}`.trim()}>{children}</span>
}

export function Stepper({ steps, activeStep = 0 }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((step, index) => (
        <li className={`stepper-item${index < activeStep ? ' is-complete' : ''}${index === activeStep ? ' is-active' : ''}`} key={step} aria-current={index === activeStep ? 'step' : undefined}>
          <span className="stepper-number">{index < activeStep ? <Check size={14} /> : index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function Modal({ open, title, onClose, children }) {
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    closeButtonRef.current?.focus()
    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      document.body.classList.remove('modal-open')
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className="modal-panel" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <div>{children}</div>
      </section>
    </div>
  )
}

export function Toast({ message, tone = 'success', onDismiss }) {
  if (!message) return null
  return (
    <div className={`toast toast-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon">{tone === 'error' ? <AlertCircle size={17} /> : <Check size={17} />}</span>
      <span>{message}</span>
      {onDismiss && <button className="icon-button" type="button" onClick={onDismiss} aria-label="Dismiss notification"><X size={16} /></button>}
    </div>
  )
}

export function Loader({ label = 'Loading' }) {
  return <div className="loader" role="status" aria-label={label}><span /><span /><span /></div>
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><AlertCircle size={21} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  )
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <main className="error-fallback" role="alert"><h1>That view couldn’t load.</h1><p>Return to the home page and try again.</p><a className="button button-primary" href="/">Go home</a></main>
    }
    return this.props.children
  }
}
