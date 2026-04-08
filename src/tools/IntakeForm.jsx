import { useState, useRef, useEffect } from 'react'
import { useDarkMode } from '../App'

const API = '/api/intake'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const INCOME_OPTIONS = [
  'W-2 (employer wages)',
  'Self-employment / freelance',
  'Rental income',
  'Investments / stocks',
  'Cryptocurrency',
  'K-1s (partnership or S-corp)',
  'Foreign income',
  'Other',
]

const LIFE_CHANGE_OPTIONS = [
  'Got married',
  'Divorced',
  'New baby or adoption',
  'Sold a business',
  'Inherited assets',
  'Moved to a new state',
  'None of the above',
]

// ─── Shared submit ────────────────────────────────────────────────────────────
async function submitIntake(data) {
  await fetch(`${API}?action=submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// ─── Chat state machine ───────────────────────────────────────────────────────
function buildQuestions(data) {
  const q = [
    { key: 'name',          type: 'text',        prompt: "Hi there! I'm here to help connect you with Hilda Gonzalez, CPA. Let's start — what's your full name?" },
    { key: 'email',         type: 'email',        prompt: "Nice to meet you, {firstName}! What's the best email address for Hilda to reach you?" },
    { key: 'phone',         type: 'tel',          prompt: "And a phone number? (Optional — skip if you prefer email only.)", optional: true },
    { key: 'businessOwner', type: 'yesno',        prompt: "Are you filing as an individual, or do you own a business?" },
  ]

  if (data.businessOwner) {
    q.push(
      { key: 'businessType', type: 'select', prompt: "What type of business entity?", options: ['Sole Proprietorship', 'Single-member LLC', 'Multi-member LLC', 'S-Corporation', 'C-Corporation', 'Partnership'] },
      { key: 'revenueRange', type: 'select', prompt: "Approximately what is your annual business revenue?", options: ['Under $100K', '$100K–$250K', '$250K–$500K', '$500K–$1M', 'Over $1M'] },
      { key: 'employees',    type: 'select', prompt: "How many employees (including yourself)?", options: ['Just me', '2–5', '6–20', '21–50', '50+'] },
    )
  }

  q.push(
    { key: 'filingStatus',  type: 'select',      prompt: "What is your tax filing status?", options: ['Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household'] },
    { key: 'dependents',    type: 'select',      prompt: "How many dependents will you claim?", options: ['0', '1', '2', '3', '4', '5+'] },
    { key: 'state',         type: 'stateSelect', prompt: "What state do you live in?" },
    { key: 'incomeSources', type: 'multiselect', prompt: "Which income sources apply to you this year? (Select all that apply)", options: INCOME_OPTIONS },
    { key: 'lifeChanges',   type: 'multiselect', prompt: "Did any of these major life changes happen this year?", options: LIFE_CHANGE_OPTIONS },
    { key: 'serviceNeeded', type: 'select',      prompt: "What are you mainly looking for?", options: ['Just need to file my taxes', 'Tax planning & strategy', 'Quarterly estimated taxes', 'Bookkeeping help', 'Full ongoing advisory relationship'] },
    { key: 'urgency',       type: 'select',      prompt: "How urgent is this for you?", options: ['Need to file ASAP', 'Planning ahead for next year', 'Looking for an ongoing advisor'] },
    { key: 'priorCPA',      type: 'yesno',       prompt: "Are you currently working with another CPA or tax professional?" },
  )

  if (data.priorCPA) {
    q.push({ key: 'priorCPAReason', type: 'text', prompt: "What's prompting you to make a change?" })
  }

  q.push(
    { key: 'irsIssues',      type: 'yesno',  prompt: "Have you had any IRS notices or unresolved tax issues in the past 3 years?" },
    { key: 'howHeard',       type: 'text',   prompt: "How did you hear about Hilda or Enlightenment Financial Services?" },
    { key: 'additionalNotes', type: 'textarea', prompt: "Anything else you'd like Hilda to know before she reaches out?", optional: true },
  )

  return q
}

function ChatMode({ onSubmitted }) {
  const [data, setData] = useState({})
  const [messages, setMessages] = useState([])
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [inputVal, setInputVal] = useState('')
  const [multiSelected, setMultiSelected] = useState([])
  const [typing, setTyping] = useState(false)
  const [done, setDone] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const questions = buildQuestions(data)
  const currentQ = questions[currentQIdx]

  useEffect(() => {
    // Show first question on mount
    if (messages.length === 0) {
      addBotMessage(questions[0].prompt)
    }
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (currentQ?.type === 'text' || currentQ?.type === 'email' || currentQ?.type === 'tel' || currentQ?.type === 'textarea') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, currentQ])

  function addBotMessage(text) {
    setMessages(m => [...m, { role: 'bot', text }])
  }

  function addUserMessage(text) {
    setMessages(m => [...m, { role: 'user', text }])
  }

  function firstName(name) {
    return (name || '').split(' ')[0] || ''
  }

  function formatPrompt(prompt) {
    return prompt.replace('{firstName}', firstName(data.name))
  }

  async function advance(newData) {
    const merged = { ...data, ...newData }
    setData(merged)

    // Rebuild questions with new data to handle branching
    const newQuestions = buildQuestions(merged)
    const nextIdx = currentQIdx + 1

    if (nextIdx >= newQuestions.length) {
      // Done — submit
      setTyping(true)
      setTimeout(async () => {
        setTyping(false)
        addBotMessage("That's everything I need! Hilda will review your information and be in touch shortly. Thank you!")
        setDone(true)
        submitIntake({ ...merged, mode: 'chat' })
        onSubmitted()
      }, 1000)
      return
    }

    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setCurrentQIdx(nextIdx)
      setMultiSelected([])
      setInputVal('')
      addBotMessage(formatPrompt(newQuestions[nextIdx].prompt))
    }, 600)
  }

  function handleTextSubmit(e) {
    e.preventDefault()
    if (!currentQ) return
    const val = inputVal.trim()
    if (!val && !currentQ.optional) return
    addUserMessage(val || '(skipped)')
    advance({ [currentQ.key]: val })
    setInputVal('')
  }

  function handleYesNo(answer) {
    addUserMessage(answer ? 'Yes' : 'No')
    advance({ [currentQ.key]: answer })
  }

  function handleSelect(option) {
    addUserMessage(option)
    advance({ [currentQ.key]: option })
  }

  function handleStateSelect(state) {
    addUserMessage(state)
    advance({ [currentQ.key]: state })
  }

  function toggleMulti(option) {
    setMultiSelected(prev =>
      prev.includes(option) ? prev.filter(x => x !== option) : [...prev, option]
    )
  }

  function submitMulti() {
    const val = multiSelected.length ? multiSelected : []
    addUserMessage(val.length ? val.join(', ') : 'None selected')
    advance({ [currentQ.key]: val })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? '#c4722a' : 'white',
              color: m.role === 'user' ? 'white' : '#1a1a2e',
              fontFamily: 'sans-serif',
              fontSize: 14,
              lineHeight: 1.55,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 5, padding: '10px 14px', background: 'white', borderRadius: '16px 16px 16px 4px', width: 56, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#c4722a', opacity: 0.6, animation: `bounce 1.2s ${i*0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!done && !typing && currentQ && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '14px 20px', background: 'white' }}>
          {(currentQ.type === 'text' || currentQ.type === 'email' || currentQ.type === 'tel') && (
            <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 10 }}>
              <input
                ref={inputRef}
                type={currentQ.type}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder={currentQ.optional ? 'Type here, or press Send to skip…' : 'Type your answer…'}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #d4cfc6', fontFamily: 'sans-serif', fontSize: 14, outline: 'none' }}
              />
              <button type="submit" style={sendBtn}>Send</button>
            </form>
          )}
          {currentQ.type === 'textarea' && (
            <form onSubmit={handleTextSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder={currentQ.optional ? 'Type here, or click Send to skip…' : 'Type your answer…'}
                rows={3}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #d4cfc6', fontFamily: 'sans-serif', fontSize: 14, resize: 'vertical', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" style={sendBtn}>Send</button>
              </div>
            </form>
          )}
          {currentQ.type === 'yesno' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleYesNo(true)} style={yesBtn}>Yes</button>
              <button onClick={() => handleYesNo(false)} style={noBtn}>No</button>
            </div>
          )}
          {currentQ.type === 'select' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {currentQ.options.map(o => (
                <button key={o} onClick={() => handleSelect(o)} style={chipBtn}>{o}</button>
              ))}
            </div>
          )}
          {currentQ.type === 'stateSelect' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                onChange={e => { if (e.target.value) handleStateSelect(e.target.value) }}
                defaultValue=""
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #d4cfc6', fontFamily: 'sans-serif', fontSize: 14, outline: 'none' }}
              >
                <option value="" disabled>Select a state…</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {currentQ.type === 'multiselect' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {currentQ.options.map(o => (
                  <button
                    key={o}
                    onClick={() => toggleMulti(o)}
                    style={{
                      ...chipBtn,
                      background: multiSelected.includes(o) ? '#c4722a' : 'white',
                      color: multiSelected.includes(o) ? 'white' : '#1a1a2e',
                      borderColor: multiSelected.includes(o) ? '#c4722a' : '#d4cfc6',
                    }}
                  >{o}</button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={submitMulti} style={sendBtn}>Continue →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Form mode ────────────────────────────────────────────────────────────────
function FormMode({ onSubmitted }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', state: '',
    filingStatus: '', dependents: '0',
    businessOwner: false, businessType: '', revenueRange: '', employees: '',
    incomeSources: [], lifeChanges: [],
    serviceNeeded: '', urgency: '',
    priorCPA: false, priorCPAReason: '',
    irsIssues: false, howHeard: '', additionalNotes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function toggleArr(key, val) {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email) { setError('Name and email are required.'); return }
    setSubmitting(true)
    setError('')
    try {
      await submitIntake({ ...form, mode: 'form' })
      onSubmitted()
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const sectionTitle = (t) => (
    <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, color: '#1a1a2e', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #d4cfc6' }}>{t}</div>
  )

  const label = (t, req) => (
    <div style={{ fontFamily: 'sans-serif', fontSize: 12, fontWeight: 600, color: '#6a6560', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
      {t}{req && <span style={{ color: '#c4722a' }}> *</span>}
    </div>
  )

  const textInput = (key, placeholder, type = 'text') => (
    <input
      type={type}
      value={form[key]}
      onChange={e => set(key, e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  )

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
      {/* About You */}
      <div style={section}>
        {sectionTitle('About You')}
        <div style={row2}>
          <div>
            {label('Full Name', true)}
            {textInput('name', 'Jane Smith')}
          </div>
          <div>
            {label('Email', true)}
            {textInput('email', 'jane@example.com', 'email')}
          </div>
        </div>
        <div style={row2}>
          <div>
            {label('Phone')}
            {textInput('phone', '(555) 000-0000', 'tel')}
          </div>
          <div>
            {label('State of Residence')}
            <select value={form.state} onChange={e => set('state', e.target.value)} style={inputStyle}>
              <option value="">Select a state…</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tax Situation */}
      <div style={section}>
        {sectionTitle('Your Tax Situation')}
        <div style={row2}>
          <div>
            {label('Filing Status')}
            <select value={form.filingStatus} onChange={e => set('filingStatus', e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {['Single','Married Filing Jointly','Married Filing Separately','Head of Household'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            {label('Dependents')}
            <select value={form.dependents} onChange={e => set('dependents', e.target.value)} style={inputStyle}>
              {['0','1','2','3','4','5+'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        {label('Income Sources (select all that apply)')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {INCOME_OPTIONS.map(o => (
            <button type="button" key={o} onClick={() => toggleArr('incomeSources', o)} style={{
              ...chipBtn,
              background: form.incomeSources.includes(o) ? '#c4722a' : 'white',
              color: form.incomeSources.includes(o) ? 'white' : '#1a1a2e',
              borderColor: form.incomeSources.includes(o) ? '#c4722a' : '#d4cfc6',
            }}>{o}</button>
          ))}
        </div>
        {label('Major Life Changes This Year')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          {LIFE_CHANGE_OPTIONS.map(o => (
            <button type="button" key={o} onClick={() => toggleArr('lifeChanges', o)} style={{
              ...chipBtn,
              background: form.lifeChanges.includes(o) ? '#c4722a' : 'white',
              color: form.lifeChanges.includes(o) ? 'white' : '#1a1a2e',
              borderColor: form.lifeChanges.includes(o) ? '#c4722a' : '#d4cfc6',
            }}>{o}</button>
          ))}
        </div>
      </div>

      {/* Business */}
      <div style={section}>
        {sectionTitle('Business')}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={form.businessOwner} onChange={e => set('businessOwner', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#c4722a' }} />
          <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#1a1a2e' }}>I own a business</span>
        </label>
        {form.businessOwner && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={row2}>
              <div>
                {label('Business Entity Type')}
                <select value={form.businessType} onChange={e => set('businessType', e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  {['Sole Proprietorship','Single-member LLC','Multi-member LLC','S-Corporation','C-Corporation','Partnership'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                {label('Annual Revenue')}
                <select value={form.revenueRange} onChange={e => set('revenueRange', e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  {['Under $100K','$100K–$250K','$250K–$500K','$500K–$1M','Over $1M'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div>
              {label('Number of Employees')}
              <select value={form.employees} onChange={e => set('employees', e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
                <option value="">Select…</option>
                {['Just me','2–5','6–20','21–50','50+'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* What you're looking for */}
      <div style={section}>
        {sectionTitle("What You're Looking For")}
        <div style={row2}>
          <div>
            {label('Services Needed')}
            <select value={form.serviceNeeded} onChange={e => set('serviceNeeded', e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {['Just need to file my taxes','Tax planning & strategy','Quarterly estimated taxes','Bookkeeping help','Full ongoing advisory relationship'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            {label('Urgency')}
            <select value={form.urgency} onChange={e => set('urgency', e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {['Need to file ASAP','Planning ahead for next year','Looking for an ongoing advisor'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Background */}
      <div style={section}>
        {sectionTitle('Background')}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={form.priorCPA} onChange={e => set('priorCPA', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#c4722a' }} />
          <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#1a1a2e' }}>I'm currently with another CPA or tax professional</span>
        </label>
        {form.priorCPA && (
          <div style={{ marginBottom: 16 }}>
            {label("What's prompting you to make a switch?")}
            <textarea
              value={form.priorCPAReason}
              onChange={e => set('priorCPAReason', e.target.value)}
              rows={2}
              placeholder="Briefly describe…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={form.irsIssues} onChange={e => set('irsIssues', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#c4722a' }} />
          <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#1a1a2e' }}>I have (or have had) an IRS notice or unresolved issue in the past 3 years</span>
        </label>
        {label('How did you hear about Hilda?')}
        {textInput('howHeard', 'Referral, Google, social media…')}
      </div>

      {/* Anything else */}
      <div style={section}>
        {sectionTitle('Anything Else?')}
        <textarea
          value={form.additionalNotes}
          onChange={e => set('additionalNotes', e.target.value)}
          rows={4}
          placeholder="Anything you'd like Hilda to know before she reaches out…"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {error && <div style={{ color: '#c0392b', fontFamily: 'sans-serif', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        style={{
          width: '100%', padding: '14px 0', background: submitting ? '#8a8577' : '#c4722a',
          color: 'white', border: 'none', borderRadius: 10, fontFamily: 'sans-serif',
          fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit →'}
      </button>
    </form>
  )
}

// ─── Thank-you screen ─────────────────────────────────────────────────────────
function ThankYou() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#1a1a2e', marginBottom: 12 }}>You're all set!</div>
        <div style={{ fontFamily: 'sans-serif', fontSize: 15, color: '#8a8577', lineHeight: 1.7 }}>
          Hilda will review your information and be in touch soon. We appreciate you reaching out to Enlightenment Financial Services.
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function IntakeForm() {
  const { darkMode } = useDarkMode()
  const [mode, setMode] = useState(null) // null = picker, 'chat', 'form'
  const [submitted, setSubmitted] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: darkMode ? '#0a0a0e' : '#f7f4ef' }}>
      {/* Header */}
      <div style={{ background: darkMode ? '#0a0a0e' : '#1a1a2e', padding: '0 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0' }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 600, color: '#f7f4ef', marginBottom: 2 }}>
              Enlightenment Financial Services
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: '0.14em', color: '#e8a96a', textTransform: 'uppercase' }}>
              New Client Intake
            </div>
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#e8a96a' }}>✦</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: darkMode ? '#0a0a0e' : 'transparent' }}>
        {submitted ? (
          <ThankYou />
        ) : mode === null ? (
          <ModePicker onSelect={setMode} />
        ) : mode === 'chat' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 680, width: '100%', margin: '0 auto' }}>
            <ChatMode onSubmitted={() => setSubmitted(true)} />
          </div>
        ) : (
          <FormMode onSubmitted={() => setSubmitted(true)} />
        )}
      </div>

      {/* Footer */}
      {!submitted && (
        <div style={{ background: '#1a1a2e', padding: '14px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577' }}>
            Hilda Gonzalez, CPA · Enlightenment Financial Services · Your information is kept strictly confidential
          </div>
        </div>
      )}
    </div>
  )
}

function ModePicker({ onSelect }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: darkMode ? '#e8e5e0' : '#1a1a2e', marginBottom: 10 }}>
            Welcome — let's get started
          </h2>
          <p style={{ fontFamily: 'sans-serif', fontSize: 15, color: darkMode ? '#a8a39b' : '#8a8577', lineHeight: 1.7 }}>
            Tell us a bit about your tax situation so Hilda can reach out with the right next steps.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ModeCard
            icon="💬"
            title="Chat with our assistant"
            desc="Answer a few guided questions — quick and conversational."
            recommended
            onClick={() => onSelect('chat')}
          />
          <ModeCard
            icon="📋"
            title="Fill out the form"
            desc="Prefer to see all fields at once? Use the traditional form."
            onClick={() => onSelect('form')}
          />
        </div>
      </div>
    </div>
  )
}

function ModeCard({ icon, title, desc, recommended, onClick }) {
  const { darkMode } = useDarkMode()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: darkMode ? '#1a1a2e' : 'white',
        border: `2px solid ${hovered ? '#c4722a' : (darkMode ? '#2a2a42' : '#d4cfc6')}`,
        borderRadius: 14,
        padding: '28px 24px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        boxShadow: hovered ? `0 4px 20px ${darkMode ? 'rgba(196,114,42,0.2)' : 'rgba(196,114,42,0.12)'}` : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      {recommended && (
        <div style={{
          position: 'absolute', top: -10, left: 20,
          background: '#c4722a', color: 'white', fontSize: 10,
          fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20,
        }}>Recommended</div>
      )}
      <div style={{ fontSize: 32, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: darkMode ? '#e8e5e0' : '#1a1a2e', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: darkMode ? '#a8a39b' : '#8a8577', lineHeight: 1.6 }}>{desc}</div>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const sendBtn = {
  padding: '10px 18px', background: '#c4722a', color: 'white', border: 'none',
  borderRadius: 10, fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
}
const yesBtn = {
  ...sendBtn, flex: 1,
}
const noBtn = {
  padding: '10px 18px', background: 'white', color: '#1a1a2e', border: '1px solid #d4cfc6',
  borderRadius: 10, fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', flex: 1,
}
const chipBtn = {
  padding: '8px 14px', background: 'white', color: '#1a1a2e', border: '1px solid #d4cfc6',
  borderRadius: 20, fontFamily: 'sans-serif', fontSize: 13, cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
}
const section = {
  background: 'white', borderRadius: 12, padding: '24px', marginBottom: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}
const row2 = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16,
}
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d4cfc6',
  fontFamily: 'sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  background: 'white', color: '#1a1a2e',
}
