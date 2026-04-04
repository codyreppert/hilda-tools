import { useState, useRef, useEffect } from 'react'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const AIRTABLE_TABLE = 'Document Review'
const MODEL = 'claude-sonnet-4-6'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_SHEETS_ID = import.meta.env.VITE_GOOGLE_SHEETS_ID
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const MOCK_MODE = true

const MOCK_RESPONSE = `## W-2

| Field | Current Year | Source Document |
|-------|-------------|-----------------|
| Wages, Tips (Box 1) — Acme Corp | $85,000 | W2_AcmeCorp.pdf |
| Federal Income Tax Withheld (Box 2) — Acme Corp | $14,200 | W2_AcmeCorp.pdf |
| Social Security Wages (Box 3) — Acme Corp | $85,000 | W2_AcmeCorp.pdf |
| Social Security Tax Withheld (Box 4) — Acme Corp | $5,270 | W2_AcmeCorp.pdf |
| Medicare Wages (Box 5) — Acme Corp | $85,000 | W2_AcmeCorp.pdf |
| Medicare Tax Withheld (Box 6) — Acme Corp | $1,233 | W2_AcmeCorp.pdf |
| State Income Tax Withheld — CA | $6,100 | W2_AcmeCorp.pdf |

**W-2 Total Wages: $85,000**

## 1099-INT

| Field | Current Year | Source Document |
|-------|-------------|-----------------|
| Interest Income — Chase Bank | $312 | 1099-INT_Chase.pdf |
| Interest Income — Ally Bank | $890 | 1099-INT_Chase.pdf |
| Federal Income Tax Withheld | $0 | 1099-INT_Chase.pdf |

**1099-INT Total Interest: $312 + $890 = $1,202**

## 1099-DIV

| Field | Current Year | Source Document |
|-------|-------------|-----------------|
| Ordinary Dividends (Box 1a) — Fidelity | $4,150 | 1099-DIV_Fidelity.pdf |
| Qualified Dividends (Box 1b) — Fidelity | $3,800 | 1099-DIV_Fidelity.pdf |
| Capital Gain Distributions (Box 2a) — Fidelity | $620 | 1099-DIV_Fidelity.pdf |
| Federal Income Tax Withheld | $0 | 1099-DIV_Fidelity.pdf |

**1099-DIV Total Ordinary Dividends: $4,150**

## 1099-B

| Field | Current Year | Source Document |
|-------|-------------|-----------------|
| Proceeds — AAPL (sold 10 shares) | $1,943 | 1099-B_Fidelity.pdf |
| Cost Basis — AAPL | $1,200 | 1099-B_Fidelity.pdf |
| Gain/Loss — AAPL (long-term) | $743 | 1099-B_Fidelity.pdf |
| Proceeds — TSLA (sold 5 shares) | $1,105 | 1099-B_Fidelity.pdf |
| Cost Basis — TSLA | $1,400 | 1099-B_Fidelity.pdf |
| Gain/Loss — TSLA (short-term) | -$295 | 1099-B_Fidelity.pdf |
| Federal Income Tax Withheld | $0 | 1099-B_Fidelity.pdf |

**1099-B Net Gain/Loss: $743 + (-$295) = $448**

## 1098

| Field | Current Year | Source Document |
|-------|-------------|-----------------|
| Mortgage Interest Paid — Wells Fargo | $11,240 | 1098_WellsFargo.pdf |
| Outstanding Mortgage Principal | $342,000 | 1098_WellsFargo.pdf |
| Property Taxes Paid | $6,800 | 1098_WellsFargo.pdf |
| Mortgage Insurance Premiums | $0 | 1098_WellsFargo.pdf |

**1098 Total Mortgage Interest: $11,240**`

const SYSTEM_PROMPT = `You are a tax document extraction assistant for a CPA named Hilda Gonzalez.

The user will provide one or more PDF tax documents along with their filenames. Extract every tax figure from every document and organize them into a structured cheat sheet for the CPA to review before preparing the return.

Return ONLY the cheat sheet. No preamble, no closing remarks. Begin immediately with the first ## heading.

Organize output into sections by form type. Use exactly this format:

## [FORM TYPE]

| Field | Current Year | Source Document |
|-------|-------------|-----------------|
| [label] | [value] | [filename] |

If a prior year return is provided, use four columns:

## [FORM TYPE]

| Field | Current Year | Prior Year | Source Document |
|-------|-------------|------------|-----------------|
| [label] | [value] | [prior value or —] | [filename] |

Rules:
1. Form type headings must be one of: W-2, 1099-INT, 1099-DIV, 1099-NEC, 1099-MISC, 1099-B, 1099-R, 1099-G, 1099-S, K-1, Schedule C / P&L, Schedule E / Rental, 1098, 1095-A, Other Documents. Add additional types as needed.
2. End each section with a bold math-check line on its own line (outside the table): **[Section] Total: $X + $Y = $Z** (or **[Section] Total: $X** if only one value)
3. Format dollar amounts as $X,XXX (no cents unless non-zero). Include % sign for percentages.
4. If a field value is missing or not found in the document, write: Not found
5. Include payer or employer name in field labels when available.
6. Multiple W-2s or same-type 1099s go as separate rows within the same section — do not create duplicate headings.
7. If prior year is provided, add a ## Year-Over-Year Summary section at the end with a table comparing key totals (total wages, total interest, total dividends, AGI if available, etc.).`

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseMarkdownSections(text) {
  const blocks = text.split(/^## /m).filter(Boolean)
  return blocks.map(block => {
    const lines = block.split('\n')
    const formType = lines[0].trim()
    const tableLines = lines.filter(l => l.trim().startsWith('|'))
    const boldLines = lines.filter(l => /^\*\*.*Total.*\*\*/.test(l.trim()))

    if (tableLines.length < 2) {
      return { formType, fields: [], hasPriorYear: false, notes: lines.slice(1).join('\n').trim() }
    }

    const headerRow = tableLines[0]
    const hasPriorYear = headerRow.includes('Prior Year')
    const dataRows = tableLines.slice(2)

    const fields = dataRows.map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean)
      return {
        label: cells[0] || '',
        currentValue: cells[1] || '',
        priorValue: hasPriorYear ? (cells[2] || '') : '',
        source: hasPriorYear ? (cells[3] || '') : (cells[2] || ''),
        isTotal: false,
      }
    }).filter(f => f.label)

    boldLines.forEach(line => {
      fields.push({ label: line.replace(/\*\*/g, '').trim(), currentValue: '', priorValue: '', source: '', isTotal: true })
    })

    return { formType, fields, hasPriorYear, notes: '' }
  })
}

async function logToAirtable({ clientName, files, priorFile, confirmedAt }) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) return
  try {
    const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + encodeURIComponent(AIRTABLE_TABLE)
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          'Client name': clientName,
          'Timestamp': new Date().toISOString(),
          'Documents': files.map(f => f.name).join(', '),
          'File Count': files.length,
          'Has Prior Year': !!priorFile,
          'Confirmed At': confirmedAt ? confirmedAt.toISOString() : null,
        }
      })
    })
  } catch (e) {
    console.warn('[Airtable] Failed:', e.message)
  }
}

function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function sendToSheets({ clientName, sections, onStatus }) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_SHEETS_ID) {
    onStatus('error', 'VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_SHEETS_ID not set in .env')
    return
  }

  onStatus('loading', 'Authorizing with Google...')
  await loadGIS()

  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SHEETS_SCOPE,
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error))
        else resolve(resp.access_token)
      },
    })
    client.requestAccessToken({ prompt: 'consent' })
  })

  onStatus('loading', 'Writing to Google Sheets...')

  const date = new Date().toLocaleDateString('en-US')
  const rows = []

  // Header row (only if sheet is empty — we append regardless, user can delete dupes)
  rows.push(['Client', 'Date', 'Form Type', 'Field', 'Current Year', 'Prior Year', 'Source'])

  sections.forEach(section => {
    section.fields.forEach(field => {
      if (field.isTotal) return
      rows.push([
        clientName,
        date,
        section.formType,
        field.label,
        field.currentValue,
        field.priorValue || '',
        field.source,
      ])
    })
  })

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Sheet1!A1:G1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Sheets API error ${res.status}`)
  }

  onStatus('success', `${rows.length - 1} rows written to Google Sheets`)
}

export default function DocumentReview() {
  const [clientName, setClientName]           = useState('')
  const [clientNameError, setClientNameError] = useState(false)
  const [currentFiles, setCurrentFiles]       = useState([])
  const [priorFile, setPriorFile]             = useState(null)
  const [phase, setPhase]                     = useState('empty')
  const [sections, setSections]               = useState([])
  const [apiError, setApiError]               = useState(null)
  const [processingStep, setProcessingStep]   = useState('')
  const [elapsedSeconds, setElapsedSeconds]   = useState(0)
  const [progressWidth, setProgressWidth]     = useState(0)
  const [confirmedAt, setConfirmedAt]         = useState(null)
  const [sheetsStatus, setSheetsStatus]       = useState(null) // { type: 'loading'|'success'|'error', msg: string }
  const timerRef                              = useRef(null)
  const progressRef                           = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(progressRef.current)
    }
  }, [])

  function startTimers() {
    setElapsedSeconds(0)
    setProgressWidth(0)
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    progressRef.current = setTimeout(() => setProgressWidth(90), 100)
  }

  function stopTimers() {
    clearInterval(timerRef.current)
    clearTimeout(progressRef.current)
    setProgressWidth(100)
  }

  async function runExtraction() {
    if (!clientName.trim()) { setClientNameError(true); return }
    if (currentFiles.length === 0) { setApiError('Please upload at least one PDF document.'); return }

    setPhase('processing')
    setApiError(null)
    setProcessingStep('Reading PDF files...')
    startTimers()

    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 2500))
      setProcessingStep('Organizing extraction results...')
      await new Promise(r => setTimeout(r, 500))
      setSections(parseMarkdownSections(MOCK_RESPONSE))
      stopTimers()
      setPhase('result')
      return
    }

    try {
      const currentBase64List = await Promise.all(currentFiles.map(readFileAsBase64))
      const priorBase64 = priorFile ? await readFileAsBase64(priorFile) : null

      setProcessingStep('Sending to Claude for analysis...')

      const contentBlocks = []
      contentBlocks.push({
        type: 'text',
        text: `Client: ${clientName}\n\nCurrent year documents (${currentFiles.length} file${currentFiles.length !== 1 ? 's' : ''}):`
      })

      currentFiles.forEach((file, i) => {
        contentBlocks.push({ type: 'text', text: `Document ${i + 1}: "${file.name}"` })
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: currentBase64List[i] } })
      })

      if (priorBase64) {
        contentBlocks.push({ type: 'text', text: `Prior year return: "${priorFile.name}"` })
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: priorBase64 } })
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: contentBlocks }],
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || `API error ${response.status}`)
      }

      setProcessingStep('Organizing extraction results...')
      setSections(parseMarkdownSections(data.content[0].text))
      stopTimers()
      setPhase('result')
    } catch (err) {
      stopTimers()
      setApiError(err.message || 'An unexpected error occurred.')
      setPhase('empty')
    }
  }

  function handleConfirm() {
    const now = new Date()
    setConfirmedAt(now)
    setPhase('confirmed')
    logToAirtable({ clientName, files: currentFiles, priorFile, confirmedAt: now })
  }

  async function handleSendToSheets() {
    try {
      await sendToSheets({
        clientName,
        sections,
        onStatus: (type, msg) => setSheetsStatus({ type, msg }),
      })
    } catch (err) {
      setSheetsStatus({ type: 'error', msg: err.message })
    }
  }

  function handleReset() {
    setClientName('')
    setClientNameError(false)
    setCurrentFiles([])
    setPriorFile(null)
    setPhase('empty')
    setSections([])
    setApiError(null)
    setConfirmedAt(null)
    setProgressWidth(0)
    setElapsedSeconds(0)
  }

  const hasPriorYear = sections.some(s => s.hasPriorYear)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 50px)' }}>

      {/* Print styles */}
      {(phase === 'result' || phase === 'confirmed') && (
        <style>{`
          @media print {
            #doc-review-sidebar, .no-print { display: none !important; }
            body { background: white !important; }
            .doc-section-card { break-inside: avoid; page-break-inside: avoid; }
          }
        `}</style>
      )}

      {/* Tool header */}
      <div style={{ background: '#1a1a2e', padding: '16px 24px', borderBottom: '1px solid rgba(247,244,239,0.06)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', marginBottom: 3 }}>Tool 03</div>
        <div style={{ fontSize: 17, color: '#f7f4ef', fontFamily: 'Georgia, serif' }}>Document Extraction & Review</div>
      </div>

      <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap' }}>

        {/* LEFT SIDEBAR */}
        <div id="doc-review-sidebar" style={{ background: '#1a1a2e', padding: '24px 20px', width: 300, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>

          <Section label="Client">
            <Field label="Client Name" error={clientNameError ? 'Required' : ''}>
              <TInput
                value={clientName}
                onChange={e => { setClientName(e.target.value); setClientNameError(false) }}
                placeholder="John & Mary Smith"
                highlight={clientNameError}
              />
            </Field>
          </Section>

          <Divider />

          <Section label="Current Year Documents">
            <FileDropZone
              label="Upload PDFs (drag & drop or click)"
              multiple
              files={currentFiles}
              onFiles={setCurrentFiles}
            />
          </Section>

          <Divider />

          <Section label="Prior Year Return (Optional)">
            <FileDropZone
              label="Upload prior year return"
              multiple={false}
              files={priorFile ? [priorFile] : []}
              onFiles={files => setPriorFile(files[0] || null)}
              muted
            />
          </Section>

          <Divider />

          <button
            onClick={runExtraction}
            disabled={phase === 'processing'}
            style={{
              padding: '13px',
              background: phase === 'processing' ? '#8a8577' : '#c4722a',
              border: 'none', borderRadius: 8, color: 'white',
              fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600,
              cursor: phase === 'processing' ? 'not-allowed' : 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            {phase === 'processing' ? 'Extracting...' : 'Extract Documents'}
          </button>

          {(phase === 'result' || phase === 'confirmed') && (
            <button
              onClick={handleReset}
              style={{
                padding: '10px', background: 'transparent',
                border: '1px solid rgba(247,244,239,0.18)', borderRadius: 8,
                color: '#8a8577', fontFamily: 'sans-serif', fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + New Client
            </button>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex: 1, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280, background: '#faf9f7', position: 'relative' }}>

          {/* Confirmed watermark */}
          {phase === 'confirmed' && (
            <div style={{ position: 'absolute', top: 24, right: 24, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(196,114,42,0.25)', fontFamily: 'sans-serif', pointerEvents: 'none' }}>
              Working Paper
            </div>
          )}

          <div style={{ fontSize: 22, fontWeight: 400, color: '#1a1a2e', fontFamily: 'Georgia, serif' }}>
            Extracted <span style={{ color: '#c4722a' }}>Figures</span>
          </div>

          {/* Error */}
          {apiError && (
            <div style={{ background: 'rgba(200,60,60,0.08)', border: '1px solid rgba(200,60,60,0.25)', borderRadius: 8, padding: '14px 18px', fontFamily: 'sans-serif', fontSize: 13, color: '#c83c3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><strong>Error:</strong> {apiError}</span>
              <button onClick={() => setApiError(null)} style={{ background: 'none', border: 'none', color: '#c83c3c', cursor: 'pointer', fontSize: 14, marginLeft: 12 }}>✕</button>
            </div>
          )}

          {/* Empty state */}
          {phase === 'empty' && !apiError && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 300, opacity: 0.35, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>📄</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#8a8577', maxWidth: 280, lineHeight: 1.6 }}>
                Upload client PDFs, enter a client name, and click Extract Documents
              </div>
            </div>
          )}

          {/* Processing state */}
          {phase === 'processing' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, minHeight: 300 }}>
              <div style={{ width: 320, height: 3, background: '#e8e4de', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: progressWidth + '%', background: '#c4722a', borderRadius: 2, transition: 'width 45s linear' }} />
              </div>
              <div style={{ width: 36, height: 36, border: '3px solid #e8e4de', borderTopColor: '#c4722a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#8a8577' }}>{processingStep}</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#c8c3bb' }}>
                Analyzing {currentFiles.length} document{currentFiles.length !== 1 ? 's' : ''} for {clientName} · {elapsedSeconds}s
              </div>
            </div>
          )}

          {/* Result / Confirmed state */}
          {(phase === 'result' || phase === 'confirmed') && (
            <>
              {/* Action bar */}
              <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 18px', background: 'white', border: '1px solid #d4cfc6', borderRadius: 10, boxShadow: '0 1px 6px rgba(26,26,46,0.05)' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{clientName}</div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#8a8577', marginTop: 2 }}>
                    {currentFiles.length} document{currentFiles.length !== 1 ? 's' : ''}{hasPriorYear ? ' · with prior year' : ''} · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                {phase === 'result' && (
                  <>
                    <button
                      onClick={() => window.print()}
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #d4cfc6', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577', cursor: 'pointer' }}
                    >
                      Print
                    </button>
                    <button
                      onClick={handleSendToSheets}
                      disabled={sheetsStatus?.type === 'loading'}
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #d4cfc6', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12, color: sheetsStatus?.type === 'success' ? '#3d7a5e' : '#8a8577', cursor: sheetsStatus?.type === 'loading' ? 'not-allowed' : 'pointer' }}
                    >
                      {sheetsStatus?.type === 'loading' ? '⏳ Sending...' : sheetsStatus?.type === 'success' ? '✓ Sent to Sheets' : '↗ Send to Sheets'}
                    </button>
                    <button
                      onClick={handleConfirm}
                      style={{ padding: '8px 18px', background: '#c4722a', border: 'none', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                    >
                      Confirm Extraction →
                    </button>
                  </>
                )}
                {phase === 'confirmed' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(61,122,94,0.1)', border: '1px solid rgba(61,122,94,0.3)', borderRadius: 6, padding: '7px 14px' }}>
                      <span style={{ color: '#3d7a5e', fontSize: 14 }}>✓</span>
                      <div>
                        <div style={{ fontFamily: 'sans-serif', fontSize: 12, fontWeight: 600, color: '#3d7a5e' }}>Extraction Confirmed</div>
                        <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#8a8577' }}>
                          Reviewed by Hilda Gonzalez · {confirmedAt?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSendToSheets}
                      disabled={sheetsStatus?.type === 'loading'}
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #d4cfc6', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12, color: sheetsStatus?.type === 'success' ? '#3d7a5e' : '#8a8577', cursor: sheetsStatus?.type === 'loading' ? 'not-allowed' : 'pointer' }}
                    >
                      {sheetsStatus?.type === 'loading' ? '⏳ Sending...' : sheetsStatus?.type === 'success' ? '✓ Sent to Sheets' : '↗ Send to Sheets'}
                    </button>
                    <button
                      onClick={() => window.print()}
                      style={{ padding: '8px 16px', background: '#1a1a2e', border: 'none', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12, fontWeight: 500, color: '#f7f4ef', cursor: 'pointer' }}
                    >
                      Print Working Paper
                    </button>
                  </div>
                )}
              </div>

              {/* Sheets status banner */}
              {sheetsStatus?.type === 'error' && (
                <div style={{ background: 'rgba(200,60,60,0.08)', border: '1px solid rgba(200,60,60,0.25)', borderRadius: 8, padding: '10px 16px', fontFamily: 'sans-serif', fontSize: 12, color: '#c83c3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><strong>Sheets error:</strong> {sheetsStatus.msg}</span>
                  <button onClick={() => setSheetsStatus(null)} style={{ background: 'none', border: 'none', color: '#c83c3c', cursor: 'pointer', fontSize: 14, marginLeft: 12 }}>✕</button>
                </div>
              )}

              {/* Section cards */}
              {sections.map((section, idx) => {
                const isYoY = section.formType.toLowerCase().includes('year-over-year')
                return (
                  <div
                    key={idx}
                    className="doc-section-card"
                    style={{
                      background: 'white',
                      border: isYoY ? '1px solid rgba(196,114,42,0.4)' : '1px solid #d4cfc6',
                      borderLeft: isYoY ? '3px solid #c4722a' : undefined,
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 1px 8px rgba(26,26,46,0.04)',
                    }}
                  >
                    {/* Card header */}
                    <div style={{ padding: '12px 18px', background: '#ede9e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #d4cfc6' }}>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{section.formType}</div>
                      {section.fields.length > 0 && (
                        <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#8a8577' }}>
                          {section.fields.filter(f => !f.isTotal).length} field{section.fields.filter(f => !f.isTotal).length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    {section.notes ? (
                      <div style={{ padding: '14px 18px', fontFamily: 'sans-serif', fontSize: 13, color: '#2d2d3e', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {section.notes}
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'sans-serif', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#f7f4ef' }}>
                              <th style={{ padding: '9px 18px', textAlign: 'left', color: '#8a8577', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', width: section.hasPriorYear ? '35%' : '45%', borderBottom: '1px solid #d4cfc6' }}>Field</th>
                              <th style={{ padding: '9px 12px', textAlign: 'right', color: '#8a8577', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', width: section.hasPriorYear ? '20%' : '30%', borderBottom: '1px solid #d4cfc6' }}>Current Year</th>
                              {section.hasPriorYear && (
                                <th style={{ padding: '9px 12px', textAlign: 'right', color: '#e8a96a', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', width: '20%', borderBottom: '1px solid #d4cfc6' }}>Prior Year</th>
                              )}
                              <th style={{ padding: '9px 18px', textAlign: 'left', color: '#8a8577', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', width: '25%', borderBottom: '1px solid #d4cfc6' }}>Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.fields.map((field, fi) => (
                              <tr
                                key={fi}
                                style={{
                                  background: field.isTotal ? '#f7f4ef' : fi % 2 === 0 ? 'white' : '#faf9f7',
                                  borderTop: field.isTotal ? '2px solid #d4cfc6' : undefined,
                                }}
                              >
                                <td
                                  style={{ padding: '9px 18px', color: field.isTotal ? '#1a1a2e' : '#2d2d3e', fontWeight: field.isTotal ? 600 : 400, borderBottom: '1px solid #ede9e1' }}
                                  colSpan={field.isTotal ? (section.hasPriorYear ? 4 : 3) : 1}
                                >
                                  {field.label}
                                </td>
                                {!field.isTotal && (
                                  <>
                                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#1a1a2e', fontWeight: 500, borderBottom: '1px solid #ede9e1' }}>{field.currentValue}</td>
                                    {section.hasPriorYear && (
                                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#8a8577', borderBottom: '1px solid #ede9e1' }}>{field.priorValue || '—'}</td>
                                    )}
                                    <td style={{ padding: '9px 18px', color: '#8a8577', fontSize: 11, borderBottom: '1px solid #ede9e1' }}>{field.source}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
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
      border: '1px solid ' + (highlight ? '#c4722a' : 'rgba(247,244,239,0.18)'),
      borderRadius: 6, padding: '9px 11px', color: '#f7f4ef',
      outline: 'none', width: '100%', boxSizing: 'border-box',
    }} />
  )
}

function FileDropZone({ label, multiple, files, onFiles, muted }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [sizeWarning, setSizeWarning] = useState('')

  function handleFiles(incoming) {
    const pdfs = Array.from(incoming).filter(f => f.type === 'application/pdf')
    const large = pdfs.filter(f => f.size > 20 * 1024 * 1024)
    setSizeWarning(large.length > 0 ? large.map(f => f.name).join(', ') + ' may be slow to process (>20MB)' : '')
    onFiles(multiple ? pdfs : pdfs.slice(0, 1))
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        style={{
          border: '1px dashed ' + (dragging ? '#c4722a' : muted ? 'rgba(247,244,239,0.12)' : 'rgba(247,244,239,0.25)'),
          borderRadius: 8, padding: '16px 12px', textAlign: 'center',
          cursor: 'pointer', background: dragging ? 'rgba(196,114,42,0.08)' : 'transparent',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
        <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: files.length > 0 ? '#e8a96a' : muted ? '#8a8577' : '#c8c3bb' }}>
          {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : label}
        </div>
        <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#8a8577', marginTop: 4 }}>PDF only · Click or drag & drop</div>
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(247,244,239,0.06)', borderRadius: 4, padding: '5px 8px' }}>
              <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#c8c3bb', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button
                onClick={e => { e.stopPropagation(); onFiles(files.filter((_, j) => j !== i)) }}
                style={{ background: 'none', border: 'none', color: '#8a8577', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {sizeWarning && (
        <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#e8a96a', marginTop: 6, lineHeight: 1.4 }}>⚠ {sizeWarning}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
