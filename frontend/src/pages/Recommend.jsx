import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, ArrowRight, Check, LoaderCircle, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api.js'
import { Stepper } from '../components/ui.jsx'

const categories = ['fruits', 'vegetables', 'dairy', 'meat', 'seafood', 'bakery', 'grains', 'snacks', 'beverages', 'frozen', 'spices', 'oils']
const levels = ['low', 'medium', 'high']
const defaultProfile = {
  food_category: 'fruits',
  moisture_content: 86,
  fat_content: 1,
  pH: 4.1,
  water_activity: 0.97,
  respiration_rate: 'high',
  oxygen_sensitivity: 'medium',
  light_sensitivity: 'medium',
  storage_temp: 8,
  relative_humidity: 88,
  transport_days: 5,
  required_shelf_life_days: 14,
  budget_level: 'medium',
  sustainability_priority: 'high',
}

const fallbackPresets = {
  fruits: { ...defaultProfile },
  vegetables: { ...defaultProfile, food_category: 'vegetables', moisture_content: 91, pH: 6, water_activity: 0.98, storage_temp: 6, relative_humidity: 90 },
  dairy: { ...defaultProfile, food_category: 'dairy', moisture_content: 70, fat_content: 3.5, pH: 6.6, water_activity: 0.97, respiration_rate: 'low', light_sensitivity: 'high', storage_temp: 4, relative_humidity: 65 },
  meat: { ...defaultProfile, food_category: 'meat', moisture_content: 68, fat_content: 15, pH: 5.8, water_activity: 0.97, respiration_rate: 'low', oxygen_sensitivity: 'high', storage_temp: 2, relative_humidity: 80 },
  seafood: { ...defaultProfile, food_category: 'seafood', moisture_content: 76, fat_content: 8, pH: 6.5, water_activity: 0.98, respiration_rate: 'low', oxygen_sensitivity: 'high', storage_temp: 1, relative_humidity: 85 },
  bakery: { ...defaultProfile, food_category: 'bakery', moisture_content: 28, fat_content: 8, pH: 5.5, water_activity: 0.78, respiration_rate: 'low', oxygen_sensitivity: 'medium', light_sensitivity: 'low', storage_temp: 20, relative_humidity: 55 },
  grains: { ...defaultProfile, food_category: 'grains', moisture_content: 12, fat_content: 4, pH: 6.2, water_activity: 0.48, respiration_rate: 'low', light_sensitivity: 'medium', storage_temp: 20, relative_humidity: 45 },
  snacks: { ...defaultProfile, food_category: 'snacks', moisture_content: 6, fat_content: 20, pH: 6, water_activity: 0.32, respiration_rate: 'low', oxygen_sensitivity: 'high', light_sensitivity: 'medium', storage_temp: 20, relative_humidity: 45 },
  beverages: { ...defaultProfile, food_category: 'beverages', moisture_content: 96, fat_content: 1, pH: 4.2, water_activity: 0.99, respiration_rate: 'low', oxygen_sensitivity: 'medium', light_sensitivity: 'high', storage_temp: 10, relative_humidity: 55 },
  frozen: { ...defaultProfile, food_category: 'frozen', moisture_content: 65, fat_content: 8, pH: 5.8, water_activity: 0.92, respiration_rate: 'low', light_sensitivity: 'low', storage_temp: -18, relative_humidity: 55 },
  spices: { ...defaultProfile, food_category: 'spices', moisture_content: 10, fat_content: 8, pH: 5.8, water_activity: 0.42, respiration_rate: 'low', light_sensitivity: 'high', storage_temp: 20, relative_humidity: 40 },
  oils: { ...defaultProfile, food_category: 'oils', moisture_content: 0.2, fat_content: 99, pH: 6, water_activity: 0.1, respiration_rate: 'low', oxygen_sensitivity: 'high', light_sensitivity: 'high', storage_temp: 20, relative_humidity: 45 },
}

const steps = ['Food details', 'Storage & transport', 'Preferences']

function Field({ label, hint, children, error }) {
  return (
    <div className={`form-field${error ? ' field-invalid' : ''}`} role="group" aria-label={label}>
      <div className="field-heading"><span className="field-label">{label}</span>{hint && <span className="field-hint">{hint}</span>}</div>
      {children}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  )
}

function SelectField({ id, value, onChange, options, labelMap = {} }) {
  return (
    <select id={id} aria-label={id.replaceAll('_', ' ')} value={value} onChange={onChange}>
      {options.map((option) => <option value={option} key={option}>{labelMap[option] || option[0].toUpperCase() + option.slice(1)}</option>)}
    </select>
  )
}

function RangeField({ id, value, onChange, min, max, step = 1, suffix = '' }) {
  return (
    <div className="range-control">
      <input id={id} type="range" aria-label={id.replaceAll('_', ' ')} min={min} max={max} step={step} value={value} onChange={onChange} style={{ '--range-progress': `${((value - min) / (max - min)) * 100}%` }} />
      <output htmlFor={id}>{value}{suffix}</output>
    </div>
  )
}

export default function Recommend() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState(defaultProfile)
  const [presets, setPresets] = useState(fallbackPresets)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    let active = true
    api.get('/foods').then(({ data }) => {
      if (!active || !Array.isArray(data.categories)) return
      const nextPresets = { ...fallbackPresets }
      for (const item of data.categories) nextPresets[item.name] = { ...nextPresets[item.name], ...item.defaults }
      setPresets(nextPresets)
    }).catch(() => {
      // Local presets keep the wizard usable while the API is unavailable.
    })
    return () => { active = false }
  }, [])

  const setValue = (name, value) => {
    setProfile((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setError('')
  }

  const applyPreset = (category) => {
    const preset = presets[category] || fallbackPresets[category] || defaultProfile
    setProfile((current) => ({ ...current, ...preset, food_category: category }))
    setFieldErrors({})
  }

  const validateStep = () => {
    const nextErrors = {}
    if (step === 0) {
      if (profile.moisture_content < 0 || profile.moisture_content > 100) nextErrors.moisture_content = 'Enter a value from 0 to 100%.'
      if (profile.fat_content < 0 || profile.fat_content > 100) nextErrors.fat_content = 'Enter a value from 0 to 100%.'
      if (profile.pH < 0 || profile.pH > 14) nextErrors.pH = 'pH must be between 0 and 14.'
      if (profile.water_activity < 0 || profile.water_activity > 1) nextErrors.water_activity = 'Water activity must be from 0 to 1.'
    }
    if (step === 1) {
      if (profile.storage_temp < -40 || profile.storage_temp > 60) nextErrors.storage_temp = 'Use a temperature from -40 to 60°C.'
      if (profile.relative_humidity < 0 || profile.relative_humidity > 100) nextErrors.relative_humidity = 'Humidity must be from 0 to 100%.'
      if (profile.transport_days < 0 || profile.transport_days > 365) nextErrors.transport_days = 'Transport duration must be 0 to 365 days.'
      if (profile.required_shelf_life_days < 1 || profile.required_shelf_life_days > 1095) nextErrors.required_shelf_life_days = 'Target must be between 1 and 1,095 days.'
    }
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep()) setStep((current) => Math.min(steps.length - 1, current + 1))
  }

  const submitRecommendation = async (event) => {
    event.preventDefault()
    if (!validateStep()) return
    setLoading(true)
    setError('')
    try {
      const payload = {
        ...profile,
        moisture_content: Number(profile.moisture_content),
        fat_content: Number(profile.fat_content),
        pH: Number(profile.pH),
        water_activity: Number(profile.water_activity),
        storage_temp: Number(profile.storage_temp),
        relative_humidity: Number(profile.relative_humidity),
        transport_days: Number(profile.transport_days),
        required_shelf_life_days: Number(profile.required_shelf_life_days),
      }
      const { data } = await api.post('/recommend', payload)
      const resultState = { result: data, profile: payload }
      window.sessionStorage.setItem('packwise-last-recommendation', JSON.stringify(resultState))
      navigate('/results', { state: resultState })
    } catch (requestError) {
      const detail = requestError.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'We couldn’t generate a recommendation. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="recommend-page page-width">
      <div className="recommend-heading">
        <div><p className="section-kicker">A recommendation tailored to your product</p><h1>Let’s start with the <span>food.</span></h1><p className="recommend-intro">A few details help us compare protection, practicality, and the conditions your product will face.</p></div>
        <div className="wizard-counter"><span>STEP</span><strong>0{step + 1}</strong><i>/</i><span>03</span></div>
      </div>

      <div className="wizard-layout">
        <aside className="wizard-aside">
          <Stepper steps={steps} activeStep={step} />
          <div className="wizard-aside-note"><span className="aside-note-icon"><Check size={16} /></span><p>Your answers shape the recommendation. You can adjust every field before submitting.</p></div>
        </aside>

        <form className="wizard-form" onSubmit={submitRecommendation} noValidate>
          <AnimatePresence mode="wait">
            <motion.section className="wizard-step-content" key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              {step === 0 && <>
                <div className="form-step-heading"><span>01 / PRODUCT PROFILE</span><h2>What are you packing?</h2><p>Choose a starting profile, then tune it to your food.</p></div>
                <div className="form-grid">
                  <Field label="Food category" hint="Presets can be edited"><SelectField id="food_category" value={profile.food_category} onChange={(event) => applyPreset(event.target.value)} options={categories} /></Field>
                  <Field label="Moisture content" hint="Percent by weight" error={fieldErrors.moisture_content}><RangeField id="moisture_content" value={profile.moisture_content} min={0} max={100} suffix="%" onChange={(event) => setValue('moisture_content', Number(event.target.value))} /></Field>
                  <Field label="Fat content" hint="Percent by weight" error={fieldErrors.fat_content}><RangeField id="fat_content" value={profile.fat_content} min={0} max={100} suffix="%" onChange={(event) => setValue('fat_content', Number(event.target.value))} /></Field>
                  <Field label="pH" hint="0 to 14" error={fieldErrors.pH}><RangeField id="pH" value={profile.pH} min={0} max={14} step={0.1} onChange={(event) => setValue('pH', Number(event.target.value))} /></Field>
                  <Field label="Water activity" hint="aw · 0 to 1" error={fieldErrors.water_activity}><RangeField id="water_activity" value={profile.water_activity} min={0} max={1} step={0.01} onChange={(event) => setValue('water_activity', Number(event.target.value))} /></Field>
                </div>
                <div className="form-divider"><span>PRODUCT SENSITIVITY</span></div>
                <div className="form-grid form-grid-three">
                  <Field label="Respiration"><SelectField id="respiration_rate" value={profile.respiration_rate} onChange={(event) => setValue('respiration_rate', event.target.value)} options={levels} /></Field>
                  <Field label="Oxygen sensitivity"><SelectField id="oxygen_sensitivity" value={profile.oxygen_sensitivity} onChange={(event) => setValue('oxygen_sensitivity', event.target.value)} options={levels} /></Field>
                  <Field label="Light sensitivity"><SelectField id="light_sensitivity" value={profile.light_sensitivity} onChange={(event) => setValue('light_sensitivity', event.target.value)} options={levels} /></Field>
                </div>
              </>}

              {step === 1 && <>
                <div className="form-step-heading"><span>02 / THE JOURNEY</span><h2>Where will it go?</h2><p>Storage conditions and time in transit affect what protection is useful.</p></div>
                <div className="form-grid">
                  <Field label="Storage temperature" hint="Degrees Celsius" error={fieldErrors.storage_temp}><RangeField id="storage_temp" value={profile.storage_temp} min={-40} max={60} suffix="°C" onChange={(event) => setValue('storage_temp', Number(event.target.value))} /></Field>
                  <Field label="Relative humidity" hint="Percent RH" error={fieldErrors.relative_humidity}><RangeField id="relative_humidity" value={profile.relative_humidity} min={0} max={100} suffix="%" onChange={(event) => setValue('relative_humidity', Number(event.target.value))} /></Field>
                  <Field label="Transport duration" hint="Days in transit" error={fieldErrors.transport_days}><RangeField id="transport_days" value={profile.transport_days} min={0} max={365} suffix=" days" onChange={(event) => setValue('transport_days', Number(event.target.value))} /></Field>
                  <Field label="Shelf-life target" hint="Days from packing" error={fieldErrors.required_shelf_life_days}><RangeField id="required_shelf_life_days" value={profile.required_shelf_life_days} min={1} max={365} suffix=" days" onChange={(event) => setValue('required_shelf_life_days', Number(event.target.value))} /></Field>
                </div>
                <div className="journey-insight"><span className="insight-mark">i</span><p>Use the conditions the package will actually experience, not just the ideal storage specification.</p></div>
              </>}

              {step === 2 && <>
                <div className="form-step-heading"><span>03 / YOUR PRIORITIES</span><h2>What matters most?</h2><p>Set your constraints. We’ll keep these trade-offs visible in the result.</p></div>
                <div className="preference-block">
                  <Field label="Budget level" hint="How much flexibility do you have?"><div className="segmented-control" role="radiogroup" aria-label="Budget level">{levels.map((level) => <button key={level} type="button" role="radio" aria-checked={profile.budget_level === level} className={profile.budget_level === level ? 'selected' : ''} onClick={() => setValue('budget_level', level)}>{level[0].toUpperCase() + level.slice(1)}</button>)}</div></Field>
                  <Field label="Sustainability priority" hint="Importance in the material decision"><div className="segmented-control" role="radiogroup" aria-label="Sustainability priority">{levels.map((level) => <button key={level} type="button" role="radio" aria-checked={profile.sustainability_priority === level} className={profile.sustainability_priority === level ? 'selected' : ''} onClick={() => setValue('sustainability_priority', level)}>{level[0].toUpperCase() + level.slice(1)}</button>)}</div></Field>
                </div>
                <div className="profile-summary"><span>YOUR PROFILE</span><div><strong>{profile.food_category}</strong><span>{profile.moisture_content}% moisture</span><span>{profile.storage_temp}°C storage</span><span>{profile.required_shelf_life_days} day target</span></div></div>
              </>}
            </motion.section>
          </AnimatePresence>

          {error && <div className="form-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          <div className="wizard-actions">
            {step > 0 ? <button className="button button-quiet" type="button" disabled={loading} onClick={() => { setStep((current) => current - 1); setFieldErrors({}); setError('') }}><ArrowLeft size={16} /> Back</button> : <button className="button button-quiet" type="button" onClick={() => { setProfile(defaultProfile); setStep(0); setFieldErrors({}); setError('') }}><RotateCcw size={15} /> Reset</button>}
            {step < steps.length - 1 ? <button className="button button-primary" type="button" onClick={nextStep}>Continue <ArrowRight size={16} /></button> : <button className="button button-primary" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin-icon" size={17} /> Analysing profile…</> : <>Get recommendations <ArrowRight size={16} /></>}</button>}
          </div>
          <p className="form-disclaimer">Recommendations support material selection and do not replace food-safety validation.</p>
        </form>
      </div>
    </main>
  )
}
