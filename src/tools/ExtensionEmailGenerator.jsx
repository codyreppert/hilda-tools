import { useState } from 'react'

// ─── AIRTABLE CONFIG ─────────────────────────────────────────────
// Create a .env file in the project root with these values:
// VITE_AIRTABLE_TOKEN=your_personal_access_token
// VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
// VITE_AIRTABLE_TABLE=Email Generator
const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const AIRTABLE_TABLE = import.meta.env.VITE_AIRTABLE_TABLE || 'Email Generator'
// ─────────────────────────────────────────────────────────────────

const TONES = [
  { id: 'warm',   label: 'Warm & Clear' },
  { id: 'firm',   label: 'Firm & Direct' },
  { id: 'gentle', label: 'Gentle Reminder' },
  { id: 'urgent', label: 'Urgent' },
]

function getDefaultDeadline() {
  const d = new Date()
  d.setMonth(3); d.setDate(10)
  return d.toISOString().split('T')[0]
}

function formatDate(str) {
  if (!str) return 'April 10, 2026'
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function buildEmail({ cpaName, firmName, deadline, clientName, missingDocs, context, tone }) {
  const d = formatDate(deadline)
  const sig = firmName ? `${cpaName}\n${firmName}` : cpaName
  const firstName = clientName.split(' ')[0]
  const docsBlock = missingDocs
    ? `\nI'm still waiting on:\n• ${missingDocs.split(',').map(s => s.trim()).join('\n• ')}\n`
    : ''
  const contextBlock = context ? `\n${context}\n` : ''

  const templates = {
    warm: {
      subject: `Action Needed: Tax Documents Due ${d}`,
      body: `Hi ${firstName},\n\nI hope you're doing well! I wanted to reach out because I'd love to get your tax return filed on time this year.\n\nIn order to do that, I'll need all of your documents submitted by **${d}**. If I don't receive everything by that date, I'll need to file an extension on your behalf. Just a heads up — an extension gives us more time to file, but does not extend the deadline to pay any taxes owed.\n${docsBlock}${contextBlock}\nPlease don't hesitate to reach out if you have any questions. I'm here to make this as smooth as possible!\n\nWarmly,\n${sig}`,
    },
    firm: {
      subject: `Documents Required by ${d} — Action Required`,
      body: `Dear ${firstName},\n\nThis is a notice that I have not yet received all documents necessary to complete your tax return.\n\nThe deadline for document submission is **${d}**. If documents are not received by this date, your return will be filed on extension. Please note: an extension provides additional time to file — it does not extend the time to pay any balance due.\n${docsBlock}${contextBlock}\nPlease submit all documents as soon as possible.\n\nRegards,\n${sig}`,
    },
    gentle: {
      subject: `Quick Reminder — Documents Needed for Your Tax Return`,
      body: `Hi ${firstName},\n\nJust a friendly reminder — I'm still waiting on a few things before I can finalize your tax return!\n\nIf you're able to get everything over to me by **${d}**, I can make sure we file on time. If not, no worries — I'll file an extension for you, which gives us more time to file. Just keep in mind that any taxes owed are still due by the original deadline.\n${docsBlock}${contextBlock}\nThanks so much — feel free to reach out if you need anything!\n\nThanks,\n${sig}`,
    },
    urgent: {
      subject: `URGENT: Submit Documents by ${d} to Avoid Extension`,
      body: `Hi ${firstName},\n\nI need to hear from you right away. I have not received the documents needed to complete your tax return, and the deadline is **${d}**.\n\nIf I don't receive everything by that date, your return will be filed on extension. Important: an extension only extends the filing deadline — any taxes owed are still due on the original date, and late payment may result in penalties and interest.\n${docsBlock}${contextBlock}\nPlease respond or submit your documents today.\n\nUrgently,\n${sig}`,
    },
  }

  return templates[tone] || templates.warm
}

async function logToAirtable({ cpaName, clientName, tone, missingDocs, deadline, context, subject }) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) return // silently skip if not configured

  try {
    await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Timestamp': new Date().toISOString(),
          'CPA Name': cpaName,
          'Client Name': clientName,
          'Tone': tone,
          'Missing Docs': missingDocs,
          'Deadline': formatDate(deadline),
          'Context': context,
          'Subject Generated': subject,
        }
      })
    })
  } catch (e) {
    console.warn('Airtable log failed (non-blocking):', e.message)
  }
}

export default function ExtensionEmailGenerator() {
  const [cpaName, setCpaName]       = useState('Hilda')
  const [firmName, setFirmName]     = useState('Enlightenment Financial Services')
  const [deadline, setDeadline]     = useState(getDefaultDeadline())
  const [clientName, setClientName] = useState('')
  const [missingDocs, setMissingDocs] = useState('')
  const [context, setContext]       = useState('')
  const [tone, setTone]             = useState('warm')
  const [result, setResult]         = useState(null)
  const [copied, setCopied]         = useState(false)
  const [clientError, setClientError] = useState(false)

  function generate() {
    if (!clientName.trim()) { setClientError(true); return }
    setClientError(false)
    const email = buildEmail({ cpaName, firmName, deadline, clientName, missingDocs, context, tone })
    setResult(email)
    setCopied(false)
    logToAirtable({ cpaName, clientName, tone, missingDocs, deadline, context, subject: email.subject })
  }

  function copyEmail() {
    if (!result) return
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function reset() {
    setResult(null)
    setClientName('')
    setMissingDocs('')
    setContext('')
    setCopied(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 50px)' }}>

      {/* Tool header */}
      <div style={{ background: '#1a1a2e', padding: '16px 24px', borderBottom: '1px solid rgba(247,244,239,0.06)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', marginBottom: 3 }}>Tool 01</div>
        <div style={{ fontSize: 17, color: '#f7f4ef', fontFamily: 'Georgia, serif' }}>Extension Notice Generator</div>
      </div>

      <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap' }}>

        {/* FORM */}
        <div style={{ background: '#1a1a2e', padding: '24px 20px', width: 300, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 18 }}>

          <Section label="Your Info">
            <Field label="Your Name">
              <TInput value={cpaName} onChange={e => setCpaName(e.target.value)} placeholder="Hilda" />
            </Field>
            <Field label="Firm Name (optional)">
              <TInput value={firmName} onChange={e => setFirmName(e.target.value)} />
            </Field>
            <Field label="Document Deadline">
              <TInput type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </Field>
          </Section>

          <Divider />

          <Section label="Client">
            <Field label="Client Name" error={clientError ? 'Required' : ''}>
              <TInput
                value={clientName}
                onChange={e => { setClientName(e.target.value); setClientError(false) }}
                placeholder="John & Mary Smith"
                highlight={clientError}
              />
            </Field>
            <Field label="Missing Documents (optional)">
              <TArea value={missingDocs} onChange={e => setMissingDocs(e.target.value)} placeholder="W-2, 1099-INT from Chase..." />
            </Field>
            <Field label="Special context (optional)">
              <TArea value={context} onChange={e => setContext(e.target.value)} placeholder="Long-time client, new this year..." rows={2} />
            </Field>
          </Section>

          <Divider />

          <Section label="Tone">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TONES.map(t => (
                <button key={t.id} onClick={() => setTone(t.id)} style={{
                  padding: '9px 8px', borderRadius: 6,
                  border: `1px solid ${tone === t.id ? '#c4722a' : 'rgba(247,244,239,0.15)'}`,
                  background: tone === t.id ? '#c4722a' : 'transparent',
                  color: tone === t.id ? 'white' : '#c8c3bb',
                  fontFamily: 'sans-serif', fontSize: 12,
                  cursor: 'pointer', fontWeight: tone === t.id ? 600 : 400,
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </Section>

          <button onClick={generate} style={{
            marginTop: 4, padding: '13px', background: '#c4722a',
            border: 'none', borderRadius: 8, color: 'white',
            fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.03em',
          }}>
            Generate Email
          </button>
        </div>

        {/* OUTPUT */}
        <div style={{ flex: 1, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
          <div style={{ fontSize: 22, fontWeight: 400, color: '#1a1a2e' }}>
            Generated <span style={{ color: '#c4722a' }}>Notice</span>
          </div>

          {!result && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 240, opacity: 0.35, textAlign: 'center' }}>
              <div style={{ fontSize: 36 }}>✉</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#8a8577' }}>Fill in the details and click Generate Email</div>
            </div>
          )}

          {result && (
            <>
              <div style={{ background: 'white', border: '1px solid #d4cfc6', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,26,46,0.06)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #d4cfc6', background: '#ede9e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{clientName}</div>
                    <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#8a8577', marginTop: 2 }}>Deadline: {formatDate(deadline)}</div>
                  </div>
                  <button onClick={copyEmail} style={{
                    padding: '7px 14px',
                    background: copied ? '#3d7a5e' : '#1a1a2e',
                    color: '#f7f4ef', border: 'none', borderRadius: 6,
                    fontFamily: 'sans-serif', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.2s',
                  }}>
                    {copied ? '✓ Copied!' : 'Copy Email'}
                  </button>
                </div>

                <div style={{ padding: '10px 20px', borderBottom: '1px solid #d4cfc6', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a8577', minWidth: 52 }}>Subject</span>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{result.subject}</span>
                </div>

                <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: 14, lineHeight: 1.85, color: '#2d2d3e', whiteSpace: 'pre-wrap', fontWeight: 300 }}>
                  {result.body.split('**').map((part, i) =>
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={generate} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid #d4cfc6', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577', cursor: 'pointer' }}>
                  ↺ Regenerate
                </button>
                <button onClick={reset} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid #d4cfc6', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577', cursor: 'pointer' }}>
                  + New Client
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', opacity: 0.7 }}>{label}</div>
      {children}
    </div>
  )
}
function Divider() {
  return <div style={{ width: 36, height: 1, background: '#c4722a', opacity: 0.4 }} />
}
function Field({ label, children, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#c8c3bb' }}>
        {label}{error && <span style={{ color: '#e8a96a', marginLeft: 6 }}>{error}</span>}
      </label>
      {children}
    </div>
  )
}
function TInput({ highlight, ...props }) {
  return (
    <input {...props} style={{
      fontFamily: 'sans-serif', fontSize: 14,
      background: 'rgba(247,244,239,0.07)',
      border: `1px solid ${highlight ? '#c4722a' : 'rgba(247,244,239,0.18)'}`,
      borderRadius: 6, padding: '9px 11px', color: '#f7f4ef',
      outline: 'none', width: '100%', boxSizing: 'border-box',
    }} />
  )
}
function TArea({ rows = 3, ...props }) {
  return (
    <textarea {...props} rows={rows} style={{
      fontFamily: 'sans-serif', fontSize: 14,
      background: 'rgba(247,244,239,0.07)',
      border: '1px solid rgba(247,244,239,0.18)',
      borderRadius: 6, padding: '9px 11px', color: '#f7f4ef',
      outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical',
    }} />
  )
}
