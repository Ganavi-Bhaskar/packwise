import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Box,
  Check,
  ChevronRight,
  CircleDollarSign,
  Leaf,
  ShieldCheck,
  Sparkles,
  Wind,
} from 'lucide-react'
import { Badge, Card } from '../components/ui.jsx'

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] } },
}

const materialRows = [
  { label: 'Oxygen barrier', value: 'Excellent', width: '88%', tone: 'deep' },
  { label: 'Moisture control', value: 'Strong', width: '72%', tone: 'fresh' },
  { label: 'Recyclability', value: 'High', width: '81%', tone: 'citrus' },
]

const steps = [
  { number: '01', icon: Box, title: 'Describe the food', copy: 'Start with what matters: composition, sensitivity, and the shelf life you need.' },
  { number: '02', icon: Wind, title: 'Set the journey', copy: 'Add temperature, humidity, and transit time to reflect real conditions.' },
  { number: '03', icon: Sparkles, title: 'Compare your options', copy: 'See ranked materials with clear trade-offs, estimates, and plain-English reasoning.' },
]

const capabilities = [
  { icon: ShieldCheck, title: 'Protection, made specific', copy: 'Match barrier needs to oxygen, moisture, light, and the realities of each food.' },
  { icon: BarChart3, title: 'Trade-offs in the open', copy: 'Compare shelf-life estimates, cost, and sustainability in one readable view.' },
  { icon: CircleDollarSign, title: 'Grounded in your constraints', copy: 'Bring budget, storage, and transport into the recommendation from the start.' },
]

export default function Home() {
  return (
    <main id="top">
      <section className="hero-section page-width">
        <motion.div className="hero-copy" initial="hidden" animate="show" variants={reveal}>
          <div className="eyebrow"><span className="eyebrow-dot" /> FOOD PACKAGING INTELLIGENCE</div>
          <h1>Good food deserves a <span>smarter</span> first layer.</h1>
          <p className="hero-description">
            Find packaging that protects quality, fits the journey, and makes sense for your sustainability goals.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" to="/recommend">
              Get a recommendation <ArrowUpRight size={18} />
            </Link>
            <a className="text-link" href="#materials">Explore material options <ArrowRight size={16} /></a>
          </div>
          <div className="hero-footnote"><BadgeCheck size={17} /> Food profile in. Clear trade-offs out.</div>
        </motion.div>

        <motion.div className="hero-visual" initial={{ opacity: 0, scale: 0.975 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}>
          <img
            className="hero-photo"
            src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1400&q=88"
            alt="Fresh leafy greens and colorful vegetables ready for packing"
          />
          <div className="photo-index"><span>FIELD NOTE 01</span><span>FRESH PRODUCE</span></div>
          <Card className="recommendation-preview">
            <div className="preview-topline"><span className="preview-label"><Sparkles size={14} /> MATCH FOUND</span><span className="preview-confidence">94% fit</span></div>
            <div className="preview-material"><span className="material-symbol"><Leaf size={19} /></span><div><strong>Breathable produce film</strong><span>for high-respiration greens</span></div><ChevronRight size={18} /></div>
            <div className="preview-stats">
              <div><span>Estimated life</span><strong>+8 days</strong></div>
              <div><span>Cost level</span><strong>Moderate</strong></div>
              <div><span>Material</span><strong>Recyclable</strong></div>
            </div>
          </Card>
          <div className="visual-caption"><span className="caption-line" />Better fit. Less waste.</div>
        </motion.div>
      </section>

      <section className="signal-strip page-width" aria-label="Platform scope">
        <p>Built for the details behind every food journey</p>
        <div className="signal-items">
          <span><strong>12</strong> food categories</span><i />
          <span><strong>13</strong> material options</span><i />
          <span><strong>1</strong> clearer decision</span>
        </div>
      </section>

      <section className="workflow-section" id="how-it-works">
        <div className="page-width">
          <div className="section-heading">
            <div><p className="section-kicker">A clearer route to the right pack</p><h2>From food profile to <span>confident choice.</span></h2></div>
            <p className="section-aside">Packaging performance is contextual. We bring the context into the decision.</p>
          </div>
          <div className="steps-grid">
            {steps.map(({ number, icon: Icon, title, copy }, index) => (
              <motion.article className="step-item" key={number} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.28 }} variants={{ ...reveal, show: { ...reveal.show, transition: { ...reveal.show.transition, delay: index * 0.1 } } }}>
                <div className="step-meta"><span>{number}</span><span className="step-icon"><Icon size={20} /></span></div>
                <h3>{title}</h3><p>{copy}</p>
                <span className="step-rule" />
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="materials-section page-width" id="materials">
        <div className="materials-intro">
          <p className="section-kicker">More than a material name</p>
          <h2>See the whole<br /><span>performance picture.</span></h2>
          <p>Every recommendation brings the practical trade-offs with it, so your team can make a decision that holds up beyond the spec sheet.</p>
          <a className="text-link" href="#approach">How we think about fit <ArrowRight size={16} /></a>
        </div>
        <motion.div className="performance-panel" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }} variants={reveal}>
          <div className="performance-header"><div><span className="panel-kicker">MATERIAL SNAPSHOT</span><h3>Barrier profile</h3></div><Badge tone="green">PET / fresh cut</Badge></div>
          <div className="performance-subtitle"><span>Relative performance</span><span>Product-specific view</span></div>
          <div className="performance-bars">
            {materialRows.map((row) => (
              <div className="performance-row" key={row.label}>
                <div className="bar-label"><span>{row.label}</span><strong>{row.value}</strong></div>
                <div className="bar-track"><motion.span className={`bar-fill bar-${row.tone}`} initial={{ width: 0 }} whileInView={{ width: row.width }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.2 }} /></div>
              </div>
            ))}
          </div>
          <div className="performance-note"><span className="note-check"><Check size={14} /></span><p><strong>A useful balance.</strong> Barrier and recyclability are considered together, not in isolation.</p></div>
          <div className="panel-footer"><span><span className="live-dot" /> MODEL-ASSISTED VIEW</span><span>01 / 03</span></div>
        </motion.div>
      </section>

      <section className="principles-section" id="approach">
        <div className="page-width">
          <div className="principles-heading"><p className="section-kicker">Designed around real decisions</p><h2>Useful science.<br /><span>Human-readable answers.</span></h2></div>
          <div className="capability-grid">
            {capabilities.map(({ icon: Icon, title, copy }, index) => (
              <motion.article className="capability" key={title} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={{ ...reveal, show: { ...reveal.show, transition: { ...reveal.show.transition, delay: index * 0.1 } } }}>
                <span className={`capability-icon capability-icon-${index}`}><Icon size={21} /></span>
                <h3>{title}</h3><p>{copy}</p>
              </motion.article>
            ))}
          </div>
          <div className="principle-foot"><span>One decision, several dimensions.</span><span>Protection <i /> practicality <i /> planet</span></div>
        </div>
      </section>

      <section className="closing-section page-width" id="recommend">
        <div className="closing-mark"><Leaf size={22} /></div>
        <div><p className="section-kicker">A better package starts with a better question</p><h2>What does your food need<br />from its first layer?</h2></div>
        <Link className="button button-dark button-large" to="/recommend">Find your fit <ArrowUpRight size={18} /></Link>
        <a className="closing-scroll" href="#top" aria-label="Return to top"><ArrowDown size={18} /></a>
      </section>
    </main>
  )
}
