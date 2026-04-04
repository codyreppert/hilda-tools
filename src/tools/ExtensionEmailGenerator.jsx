import { useState } from 'react'

const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const AIRTABLE_TABLE = import.meta.env.VITE_AIRTABLE_TABLE || 'Email Generator'

const RETURN_TYPES = [
  { id: 'personal', label: 'Personal Return', sublabel: 'Due April 15 · Docs by March 15' },
  { id: 'business', label: 'Business Return', sublabel: 'Due March 16 · Docs by Feb 28' },
]

const TONES = [
  { id: 'warm',   label: 'Warm & Clear' },
  { id: 'firm',   label: 'Firm & Direct' },
  { id: 'gentle', label: 'Gentle Reminder' },
  { id: 'urgent', label: 'Urgent' },
]

const PERSONAL_DOCS = [
  { group: 'Income', items: [
    'W-2',
    '1099-B (investment / capital gains)',
    '1099-INT (interest income)',
    '1099-DIV (dividends)',
    '1099-NEC (self-employment)',
    '1099-MISC',
    '1099-G (state tax refund)',
    '1099-S (property sales)',
    'W-2G (gambling winnings)',
    'K-1 (partnership or S-corp)',
  ]},
  { group: 'Sole Proprietor / Schedule C', items: [
    'Profit & Loss Statement (prepared — not receipts or credit card statements)',
    'Business income records',
    'Business expense records',
    'Business-use vehicle mileage log',
    'Home office details (sq footage, expenses)',
    'Self-employed health insurance premiums',
    '1099s issued to contractors',
  ]},
  { group: 'Rental Properties / Schedule E', items: [
    'P&L Statement for each rental property (separate per property)',
    'Rental income records',
    'Rental expense records (repairs, insurance, management fees)',
    'Depreciation schedule / Form 4562 from prior year',
    'Federal Asset Report from prior year',
    'Purchase contracts for new property improvements',
    'Settlement statements for any properties sold in 2025',
  ]},
  { group: 'Deductions & Credits', items: [
    '1098 (mortgage interest)',
    'Property tax statement (if not on 1098)',
    'Charitable contribution records',
    'Out-of-pocket medical expenses',
    '1098-T (tuition statement)',
    '1098-E (student loan interest)',
    '1095-A (health insurance marketplace)',
    'Solar credit documentation',
    'Childcare expenses',
    'HSA contributions',
    'Estimated tax payments made',
    'IRS or state notices received',
  ]},
  { group: 'Other', items: [
    'Prior year tax return',
  ]},
]

const BUSINESS_DOCS = [
  { group: 'Required Financials', items: [
    'Profit & Loss Statement (prepared — not receipts or credit card statements)',
    'Balance Sheet',
    'Prior year business tax return',
    'Business formation docs & EIN letter from IRS',
  ]},
  { group: 'Income & Payroll', items: [
    '1099s issued to contractors',
    'W-2s issued to employees',
    'Payroll records',
  ]},
  { group: 'Assets & Other', items: [
    'Purchase contracts/amounts for large assets (cars, trucks, machinery, fixtures, etc.)',
    'Business loan statements',
    'Vehicle mileage log',
    'Short-term rental details',
    'Depreciation schedules',
    'K-1 (if applicable)',
  ]},
]

const DEADLINES = {
  personal: { docDeadline: 'March 15, 2026', filingDeadline: 'April 15, 2026' },
  business: { docDeadline: 'February 28, 2026', filingDeadline: 'March 16, 2026' },
}

const DOC_LISTS = { personal: PERSONAL_DOCS, business: BUSINESS_DOCS }

function buildEmail({ cpaName, firmName, clientName, returnType, selectedDocs, customDocs, tone }) {
  const { docDeadline, filingDeadline } = DEADLINES[returnType]
  const sig = firmName ? cpaName + '\n' + firmName : cpaName
  const firstName = clientName.split(' ')[0]

  const allMissing = [
    ...selectedDocs,
    ...(customDocs ? customDocs.split(',').map(s => s.trim()).filter(Boolean) : [])
  ]

  const docsBlock = allMissing.length > 0
    ? '\nSpecifically, I still need:\n' + allMissing.map(d => '• ' + d).join('\n') + '\n'
    : ''

  const returnLabel = returnType === 'business' ? 'business tax return' : 'personal tax return'

  const templates = {
    warm: {
      subject: 'Your Tax Return Has Been Extended — Documents Still Needed',
      body: 'Hi ' + firstName + ',\n\nI hope you\'re doing well! I wanted to follow up regarding your ' + returnLabel + '. Since we didn\'t receive all of your documents by the filing deadline, we have filed an extension on your behalf.\n\nAn extension gives us more time to file — however, any taxes owed are still due by the original deadline. If you have a balance due, please let me know so we can address that promptly.\n\nTo complete and file your return, I still need the following:\n' + docsBlock + '\nOnce I receive everything, I\'ll get your return finalized as quickly as possible. Don\'t hesitate to reach out if you have any questions!\n\nWarmly,\n' + sig,
    },
    firm: {
      subject: 'Extension Filed — Outstanding Documents Required',
      body: 'Dear ' + firstName + ',\n\nThis is a follow-up regarding your ' + returnLabel + '. As we had not received all required documents by the filing deadline, an extension has been filed on your behalf.\n\nPlease note: the extension only extends the time to file — it does not extend the time to pay. Any taxes owed were still due by the original deadline.\n\nTo complete your return, the following documents are still needed:\n' + docsBlock + '\nPlease submit all outstanding items as soon as possible so we can finalize your return promptly.\n\nRegards,\n' + sig,
    },
    gentle: {
      subject: 'Quick Follow-Up: Documents Needed to Complete Your ' + (returnType === 'business' ? 'Business ' : '') + 'Tax Return',
      body: 'Hi ' + firstName + ',\n\nJust a quick follow-up on your ' + returnLabel + '! We went ahead and filed an extension for you, so there\'s no need to worry — your return is not late.\n\nThat said, I do still need a few things from you to get everything wrapped up:\n' + docsBlock + '\nOnce I have those, I\'ll take care of the rest. Feel free to reach out if you have any questions at all!\n\nThanks,\n' + sig,
    },
    urgent: {
      subject: 'URGENT: Documents Still Needed to Complete Your Extended Return',
      body: 'Hi ' + firstName + ',\n\nI need your immediate attention regarding your ' + returnLabel + '. An extension has been filed, but I am still missing documents needed to complete your return — and the extended deadline will be here before we know it.\n\nImportant reminder: the extension only gives us more time to FILE. If you owe taxes, interest and penalties may already be accruing. We need to get your return finalized as soon as possible.\n\nStill needed immediately:\n' + docsBlock + '\nPlease respond or submit your documents today.\n\nUrgently,\n' + sig,
    },
  }

  return templates[tone] || templates.warm
}

async function logToAirtable({ cpaName, clientName, tone, returnType, missingDocs, subject }) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) return
  try {
    const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + encodeURIComponent(AIRTABLE_TABLE)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          'Timestamp': new Date().toISOString(),
          'CPA Name': cpaName,
          'Client Name': clientName,
          'Tone': tone,
          'Missing Docs': missingDocs,
          'Deadline': DEADLINES[returnType]?.docDeadline || '',
          'Context': returnType,
          'Subject Generated': subject,
        }
      })
    })
    const data = await res.json()
    if (!res.ok) console.error('[Airtable] Error:', JSON.stringify(data))
  } catch (e) {
    console.warn('[Airtable] Failed:', e.message)
  }
}

export default function ExtensionEmailGenerator() {
  const [cpaName, setCpaName]           = useState('Hilda Gonzalez, CPA')
  const [firmName, setFirmName]         = useState('Enlightenment Financial Services')
  const [returnType, setReturnType]     = useState('personal')
  const [clientName, setClientName]     = useState('')
  const [selectedDocs, setSelectedDocs] = useState([])
  const [customDocs, setCustomDocs]     = useState('')
  const [tone, setTone]                 = useState('warm')
  const [result, setResult]             = useState(null)
  const [copied, setCopied]             = useState(false)
  const [clientError, setClientError]   = useState(false)

  const docList = DOC_LISTS[returnType]
  const { docDeadline, filingDeadline } = DEADLINES[returnType]

  function toggleDoc(doc) {
    setSelectedDocs(prev => prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc])
  }

  function switchReturnType(type) {
    setReturnType(type)
    setSelectedDocs([])
    setCustomDocs('')
    setResult(null)
  }

  function generate() {
    if (!clientName.trim()) { setClientError(true); return }
    setClientError(false)
    const email = buildEmail({ cpaName, firmName, clientName, returnType, selectedDocs, customDocs, tone })
    setResult(email)
    setCopied(false)
    logToAirtable({ cpaName, clientName, tone, returnType, missingDocs: [...selectedDocs, customDocs].filter(Boolean).join(', '), subject: email.subject })
  }

  function copyEmail() {
    if (!result) return
    navigator.clipboard.writeText('Subject: ' + result.subject + '\n\n' + result.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function reset() {
    setResult(null)
    setClientName('')
    setSelectedDocs([])
    setCustomDocs('')
    setCopied(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 50px)' }}>
      <div style={{ background: '#1a1a2e', padding: '16px 24px', borderBottom: '1px solid rgba(247,244,239,0.06)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', marginBottom: 3 }}>Tool 01</div>
        <div style={{ fontSize: 17, color: '#f7f4ef', fontFamily: 'Georgia, serif' }}>Document Follow-Up Generator</div>
      </div>

      <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap' }}>

        {/* FORM */}
        <div style={{ background: '#1a1a2e', padding: '24px 20px', width: 300, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>

          <Section label="Your Info">
            <Field label="Your Name"><TInput value={cpaName} onChange={e => setCpaName(e.target.value)} /></Field>
            <Field label="Firm Name"><TInput value={firmName} onChange={e => setFirmName(e.target.value)} /></Field>
          </Section>

          <Divider />

          <Section label="Return Type">
            <div style={{ display: 'flex', gap: 8 }}>
              {RETURN_TYPES.map(t => (
                <button key={t.id} onClick={() => switchReturnType(t.id)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 6, textAlign: 'center',
                  border: '1px solid ' + (returnType === t.id ? '#c4722a' : 'rgba(247,244,239,0.15)'),
                  background: returnType === t.id ? 'rgba(196,114,42,0.15)' : 'transparent',
                  cursor: 'pointer',
                }}>
                  <div style={{ color: returnType === t.id ? '#e8a96a' : '#f7f4ef', fontFamily: 'sans-serif', fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ color: '#8a8577', fontFamily: 'sans-serif', fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>{t.sublabel}</div>
                </button>
              ))}
            </div>
            <div style={{ background: 'rgba(196,114,42,0.08)', border: '1px solid rgba(196,114,42,0.25)', borderRadius: 6, padding: '10px 12px', fontFamily: 'sans-serif', fontSize: 12, color: '#e8a96a', lineHeight: 1.6 }}>
              📋 Docs due: <strong>{docDeadline}</strong><br />
              📅 Filing deadline: <strong>{filingDeadline}</strong>
            </div>
          </Section>

          <Divider />

          <Section label="Client">
            <Field label="Client Name" error={clientError ? 'Required' : ''}>
              <TInput value={clientName} onChange={e => { setClientName(e.target.value); setClientError(false) }} placeholder="John & Mary Smith" highlight={clientError} />
            </Field>
          </Section>

          <Divider />

          <Section label="Missing Documents">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {docList.map(group => (
                <div key={group.group}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a8577', fontFamily: 'sans-serif', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(247,244,239,0.06)' }}>{group.group}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {group.items.map(doc => (
                      <label key={doc} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc)}
                          onChange={() => toggleDoc(doc)}
                          style={{ accentColor: '#c4722a', width: 14, height: 14, marginTop: 2, flexShrink: 0 }}
                        />
                        <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: selectedDocs.includes(doc) ? '#e8a96a' : '#c8c3bb', lineHeight: 1.4 }}>{doc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {selectedDocs.length > 0 && (
              <div style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#e8a96a', marginTop: 4 }}>
                {selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''} selected
              </div>
            )}
            <Field label="Other missing (comma separated)">
              <TInput value={customDocs} onChange={e => setCustomDocs(e.target.value)} placeholder="anything else..." />
            </Field>
          </Section>

          <Divider />

          <Section label="Tone">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TONES.map(t => (
                <button key={t.id} onClick={() => setTone(t.id)} style={{
                  padding: '9px 8px', borderRadius: 6,
                  border: '1px solid ' + (tone === t.id ? '#c4722a' : 'rgba(247,244,239,0.15)'),
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
            Generate Follow-Up
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
              <div style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#8a8577' }}>Select return type, check off what's still missing, and generate a follow-up</div>
            </div>
          )}

          {result && (
            <>
              <div style={{ background: 'white', border: '1px solid #d4cfc6', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,26,46,0.06)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #d4cfc6', background: '#ede9e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{clientName}</div>
                    <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#8a8577', marginTop: 2 }}>
                      {returnType === 'business' ? 'Business' : 'Personal'} · Docs due {docDeadline}
                    </div>
                  </div>
                  <button onClick={copyEmail} style={{
                    padding: '7px 14px',
                    background: copied ? '#3d7a5e' : '#1a1a2e',
                    color: '#f7f4ef', border: 'none', borderRadius: 6,
                    fontFamily: 'sans-serif', fontSize: 12, fontWeight: 500, cursor: 'pointer',
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
function Divider() { return <div style={{ width: 36, height: 1, background: '#c4722a', opacity: 0.4 }} /> }
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
      border: '1px solid ' + (highlight ? '#c4722a' : 'rgba(247,244,239,0.18)'),
      borderRadius: 6, padding: '9px 11px', color: '#f7f4ef',
      outline: 'none', width: '100%', boxSizing: 'border-box',
    }} />
  )
}
