import { useState, useRef, useEffect } from 'react'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
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
const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const AIRTABLE_TABLE = 'Document Review'
const CHECKLIST_TABLE = 'Client Checklist'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_SHEETS_ID = import.meta.env.VITE_GOOGLE_SHEETS_ID
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const COMBINED_SCOPE = SHEETS_SCOPE + ' ' + DRIVE_SCOPE
const MOCK_MODE = false

const MOCK_RESPONSE = `## W-2

| Field | Current Year | Prior Year | Source Document |
|-------|-------------|------------|-----------------|
| Wages, Tips (Box 1) — Acme Corp | $85,000 | $65,000 | W2_AcmeCorp.pdf |
| Federal Income Tax Withheld (Box 2) — Acme Corp | $14,200 | $10,800 | W2_AcmeCorp.pdf |
| Social Security Wages (Box 3) — Acme Corp | $85,000 | $65,000 | W2_AcmeCorp.pdf |
| Social Security Tax Withheld (Box 4) — Acme Corp | $5,270 | $4,030 | W2_AcmeCorp.pdf |
| Medicare Wages (Box 5) — Acme Corp | $85,000 | $65,000 | W2_AcmeCorp.pdf |
| Medicare Tax Withheld (Box 6) — Acme Corp | $1,233 | $943 | W2_AcmeCorp.pdf |
| State Income Tax Withheld — CA | $6,100 | $4,550 | W2_AcmeCorp.pdf |
| 401(k) Contributions (Box 12, Code D) — Acme Corp | $5,500 | $4,800 | W2_AcmeCorp.pdf |

**W-2 Total Wages: $85,000**

## 1099-INT

| Field | Current Year | Prior Year | Source Document |
|-------|-------------|------------|-----------------|
| Interest Income — Chase Bank | $312 | $290 | 1099-INT_Chase.pdf |
| Interest Income — Ally Bank | $890 | $105 | 1099-INT_Ally.pdf |
| Federal Income Tax Withheld | $0 | $0 | 1099-INT_Chase.pdf |

**1099-INT Total Interest: $312 + $890 = $1,202**

## 1099-DIV

| Field | Current Year | Prior Year | Source Document |
|-------|-------------|------------|-----------------|
| Ordinary Dividends (Box 1a) — Fidelity | $4,150 | $3,920 | 1099-DIV_Fidelity.pdf |
| Qualified Dividends (Box 1b) — Fidelity | $3,800 | $3,610 | 1099-DIV_Fidelity.pdf |
| Capital Gain Distributions (Box 2a) — Fidelity | $620 | $0 | 1099-DIV_Fidelity.pdf |
| Federal Income Tax Withheld | $0 | $0 | 1099-DIV_Fidelity.pdf |

**1099-DIV Total Ordinary Dividends: $4,150**

## 1099-B

| Field | Current Year | Prior Year | Source Document |
|-------|-------------|------------|-----------------|
| Proceeds — AAPL (sold 10 shares) | $1,943 | $0 | 1099-B_Fidelity.pdf |
| Cost Basis — AAPL | $1,200 | $0 | 1099-B_Fidelity.pdf |
| Gain/Loss — AAPL (long-term) | $743 | $0 | 1099-B_Fidelity.pdf |
| Proceeds — TSLA (sold 5 shares) | $1,105 | $0 | 1099-B_Fidelity.pdf |
| Cost Basis — TSLA | $1,400 | $0 | 1099-B_Fidelity.pdf |
| Gain/Loss — TSLA (short-term) | -$295 | $0 | 1099-B_Fidelity.pdf |
| Federal Income Tax Withheld | $0 | $0 | 1099-B_Fidelity.pdf |

**1099-B Net Gain/Loss: $743 + (-$295) = $448**

## 1098

| Field | Current Year | Prior Year | Source Document |
|-------|-------------|------------|-----------------|
| Mortgage Interest Paid — Wells Fargo | $11,240 | $14,850 | 1098_WellsFargo.pdf |
| Outstanding Mortgage Principal | $342,000 | $356,200 | 1098_WellsFargo.pdf |
| Property Taxes Paid | $6,800 | $6,500 | 1098_WellsFargo.pdf |
| Mortgage Insurance Premiums | $0 | $0 | 1098_WellsFargo.pdf |

**1098 Total Mortgage Interest: $11,240**

## 5498 / Retirement Contributions

| Field | Current Year | Prior Year | Source Document |
|-------|-------------|------------|-----------------|
| Roth IRA Contributions (Box 10) | $8,200 | $6,500 | 5498_Vanguard.pdf |
| Traditional IRA Contributions (Box 1) | $0 | $0 | 5498_Vanguard.pdf |
| Fair Market Value of Account | $47,350 | $38,100 | 5498_Vanguard.pdf |

**5498 Total Roth IRA Contributions: $8,200**

## Year-Over-Year Summary

| Category | Current Year | Prior Year | Source Document |
|----------|-------------|------------|-----------------|
| Total W-2 Wages | $85,000 | $65,000 | W2_AcmeCorp.pdf |
| Total Interest Income | $1,202 | $395 | 1099-INT |
| Total Ordinary Dividends | $4,150 | $3,920 | 1099-DIV_Fidelity.pdf |
| Net Capital Gain/Loss | $448 | $0 | 1099-B_Fidelity.pdf |
| Mortgage Interest Paid | $11,240 | $14,850 | 1098_WellsFargo.pdf |

**Year-Over-Year Summary: See flagged items for significant changes**`

function parseAmount(str) {
  if (!str) return null
  const n = parseFloat(str.replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

function getVariancePct(current, prior) {
  const c = parseAmount(current)
  const p = parseAmount(prior)
  if (c === null || p === null) return null
  if (p === 0 && c === 0) return null
  if (p === 0) return 999 // new income — always flag
  return Math.abs((c - p) / Math.abs(p)) * 100
}

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

function getOAuthToken(scope) {
  const cacheKey = 'goog_token_' + scope
  const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null')
  if (cached && cached.expiry > Date.now()) return Promise.resolve(cached.token)

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return }
        sessionStorage.setItem(cacheKey, JSON.stringify({ token: resp.access_token, expiry: Date.now() + 3500000 }))
        resolve(resp.access_token)
      },
    })
    client.requestAccessToken({ prompt: '' })
  })
}

function parseFolderIdFromUrl(url) {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

async function fetchFilesFromDrive(folderUrl, taxYear, token) {
  const folderId = parseFolderIdFromUrl(folderUrl)
  if (!folderId) throw new Error('Could not parse folder ID from URL')

  const folderMeta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,parents`,
    { headers: { Authorization: 'Bearer ' + token } }
  ).then(r => r.json())

  let detectedClientName = ''
  const parentId = folderMeta.parents?.[0]
  if (parentId) {
    const parentMeta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${parentId}?fields=id,name`,
      { headers: { Authorization: 'Bearer ' + token } }
    ).then(r => r.json())
    detectedClientName = parentMeta.name || ''
  }

  const filesRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,size)`,
    { headers: { Authorization: 'Bearer ' + token } }
  ).then(r => r.json())

  const priorYear = String(parseInt(taxYear) - 1)
  let priorDriveFiles = []
  if (parentId) {
    const siblingsRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${parentId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+name='${priorYear}'+and+trashed=false&fields=files(id,name)`,
      { headers: { Authorization: 'Bearer ' + token } }
    ).then(r => r.json())
    if (siblingsRes.files?.length > 0) {
      const priorFolderId = siblingsRes.files[0].id
      const priorFilesRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${priorFolderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,size)`,
        { headers: { Authorization: 'Bearer ' + token } }
      ).then(r => r.json())
      priorDriveFiles = priorFilesRes.files || []
    }
  }

  return { detectedClientName, currentDriveFiles: filesRes.files || [], priorDriveFiles }
}

async function downloadDriveFileAsBase64(fileId, token) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: 'Bearer ' + token } }
  )
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(b => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

async function sendToSheets({ clientName, taxYear, sections, onStatus, existingToken }) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_SHEETS_ID) {
    onStatus('error', 'VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_SHEETS_ID not set in .env')
    return
  }

  await loadGIS()
  let token = existingToken
  if (!token) {
    onStatus('loading', 'Authorizing with Google...')
    token = await getOAuthToken(SHEETS_SCOPE)
  }

  onStatus('loading', 'Writing to Google Sheets...')

  const HEADER = ['Client', 'Date', 'Form Type', 'Field', 'Current Year', 'Prior Year', 'Source', 'Tax Year']
  const date = new Date().toLocaleDateString('en-US')
  const dataRows = []
  sections.forEach(section => {
    section.fields.forEach(field => {
      if (field.isTotal) return
      dataRows.push([clientName, date, section.formType, field.label,
        field.currentValue, field.priorValue || '', field.source, taxYear])
    })
  })

  const authHeader = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }

  // --- Per-client tab ---
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: 'Bearer ' + token } }
  )
  const meta = await metaRes.json()
  const existingSheets = (meta.sheets || []).map(s => s.properties.title)

  if (!existingSheets.includes(clientName)) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}:batchUpdate`,
      { method: 'POST', headers: authHeader, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: clientName } } }] }) }
    )
  }

  const clientCheckRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(clientName)}!A1`,
    { headers: { Authorization: 'Bearer ' + token } }
  )
  const clientCheckData = await clientCheckRes.json()
  const clientHasHeader = clientCheckData.values?.[0]?.[0] === 'Client'
  const clientRows = clientHasHeader ? dataRows : [HEADER, ...dataRows]

  const clientAppendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(clientName)}!A1:H1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: authHeader, body: JSON.stringify({ values: clientRows }) }
  )
  if (!clientAppendRes.ok) {
    const err = await clientAppendRes.json()
    throw new Error(err.error?.message || `Sheets API error ${clientAppendRes.status}`)
  }

  // --- Master Extracted tab ---
  const checkRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Extracted!A1`,
    { headers: { Authorization: 'Bearer ' + token } }
  )
  const checkData = await checkRes.json()
  const hasHeader = checkData.values?.[0]?.[0] === 'Client'
  const extractedRows = hasHeader ? dataRows : [HEADER, ...dataRows]

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Extracted!A1:H1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: authHeader, body: JSON.stringify({ values: extractedRows }) }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Sheets API error ${res.status}`)
  }

  onStatus('success', `${dataRows.length} rows written → "${clientName}" tab + Extracted`)
}

const CONTRIBUTION_LIMITS = {
  '2025': { rothIra: 7000, traditionalIra: 7000, k401: 23500 },
  '2024': { rothIra: 7000, traditionalIra: 7000, k401: 23000 },
  '2023': { rothIra: 6500, traditionalIra: 6500, k401: 22500 },
  '2022': { rothIra: 6000, traditionalIra: 6000, k401: 20500 },
}

function computeContributionFlags(sections, taxYear) {
  const limits = CONTRIBUTION_LIMITS[taxYear] || CONTRIBUTION_LIMITS['2025']
  const flags = {}
  sections.forEach(section => {
    section.fields.forEach(field => {
      if (field.isTotal) return
      const label = field.label.toLowerCase()
      const amount = parseAmount(field.currentValue)
      if (amount === null || amount === 0) return

      if (label.includes('roth ira')) {
        if (amount > limits.rothIra) {
          flags[field.label] = { type: 'over', message: `Over ${taxYear} Roth IRA limit of $${limits.rothIra.toLocaleString()} — corrective distribution required` }
        } else if (amount < limits.rothIra) {
          flags[field.label] = { type: 'under', message: `Under ${taxYear} Roth IRA max of $${limits.rothIra.toLocaleString()} — planning opportunity` }
        }
      } else if (label.includes('traditional ira') && !label.includes('roth')) {
        if (amount > limits.traditionalIra) {
          flags[field.label] = { type: 'over', message: `Over ${taxYear} Traditional IRA limit of $${limits.traditionalIra.toLocaleString()} — corrective distribution required` }
        } else if (amount < limits.traditionalIra) {
          flags[field.label] = { type: 'under', message: `Under ${taxYear} Traditional IRA max of $${limits.traditionalIra.toLocaleString()} — planning opportunity` }
        }
      } else if (label.includes('401(k)') && (label.includes('box 12') || label.includes('contribution'))) {
        if (amount > limits.k401) {
          flags[field.label] = { type: 'over', message: `Over ${taxYear} 401(k) limit of $${limits.k401.toLocaleString()} — excess must be returned by April 15` }
        } else if (amount < limits.k401) {
          flags[field.label] = { type: 'under', message: `Under ${taxYear} 401(k) max of $${limits.k401.toLocaleString()} — planning opportunity` }
        }
      }
    })
  })
  return flags
}

const FORM_TYPE_MAP = [
  { pattern: /^W-2/i,              match: 'W-2' },
  { pattern: /^1099/i,             match: '1099' },
  { pattern: /^K-1/i,              match: 'K-1' },
  { pattern: /Schedule C|P&L/i,    match: 'Profit & Loss' },
  { pattern: /Schedule E|Rental/i, match: 'Rental' },
  { pattern: /^1098/i,             match: '1098' },
]

const DETECT_FORM_MAP = [
  { pattern: /^W-2/i,              key: 'W-2' },
  { pattern: /^1099-INT/i,         key: '1099-INT' },
  { pattern: /^1099-DIV/i,         key: '1099-DIV' },
  { pattern: /^1099-B/i,           key: '1099-B' },
  { pattern: /^1099-NEC/i,         key: '1099-NEC' },
  { pattern: /^1099-MISC/i,        key: '1099-MISC' },
  { pattern: /^1099-K/i,           key: '1099-K' },
  { pattern: /^1099-R/i,           key: '1099-R' },
  { pattern: /^1099-G/i,           key: '1099-G' },
  { pattern: /^K-1/i,              key: 'K-1' },
  { pattern: /Schedule C|P&L/i,    key: 'Schedule C / P&L' },
  { pattern: /Schedule E|Rental/i, key: 'Schedule E / Rental' },
  { pattern: /^1098/i,             key: '1098' },
]

function extractFormTypes(sections) {
  const found = new Set()
  sections.forEach(s => {
    DETECT_FORM_MAP.forEach(({ pattern, key }) => {
      if (pattern.test(s.formType)) found.add(key)
    })
  })
  return [...found]
}

async function updateChecklist({ clientName, sections, onStatus }) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    onStatus('error', 'Airtable credentials not configured')
    return
  }

  onStatus('loading', 'Looking up client in checklist...')

  const nameEncoded = encodeURIComponent(`{Client Name}="${clientName}"`)
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(CHECKLIST_TABLE)}?filterByFormula=${nameEncoded}&pageSize=100`

  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Airtable error ${res.status}`)
  }

  const data = await res.json()

  // Try case-insensitive fallback if exact match returns nothing
  let records = data.records
  if (records.length === 0) {
    const allRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(CHECKLIST_TABLE)}?pageSize=100`,
      { headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN } }
    )
    const allData = await allRes.json()
    records = allData.records.filter(r =>
      (r.fields['Client Name'] || '').trim().toLowerCase() === clientName.trim().toLowerCase()
    )
  }

  if (records.length === 0) {
    onStatus('warn', `"${clientName}" not found in checklist — check name spelling`)
    return
  }

  // Determine which checklist keywords to mark based on extracted form types
  const extractedTypes = sections.map(s => s.formType)
  const keywordsToMark = new Set()
  extractedTypes.forEach(ft => {
    FORM_TYPE_MAP.forEach(({ pattern, match }) => {
      if (pattern.test(ft)) keywordsToMark.add(match)
    })
  })

  // Find matching records that are still "Not Started"
  const toUpdate = records.filter(r => {
    const item = r.fields['Checklist Item'] || ''
    const status = r.fields['Status'] || 'Not Started'
    if (status !== 'Not Started') return false
    return [...keywordsToMark].some(kw => item.toLowerCase().includes(kw.toLowerCase()))
  })

  if (toUpdate.length === 0) {
    onStatus('success', 'No "Not Started" items matched — checklist may already be up to date')
    return
  }

  onStatus('loading', `Marking ${toUpdate.length} items as Detected...`)

  await Promise.all(toUpdate.map(r =>
    fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(CHECKLIST_TABLE)}/${r.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Status: 'Detected' } }),
    })
  ))

  onStatus('success', `✓ ${toUpdate.length} item${toUpdate.length !== 1 ? 's' : ''} marked Detected in checklist`)
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
  const [taxYear, setTaxYear]                 = useState('2025')
  const [sheetsStatus, setSheetsStatus]       = useState(null)
  const [checklistStatus, setChecklistStatus] = useState(null)
  const [driveMode, setDriveMode]             = useState(false)
  const [driveFolderUrl, setDriveFolderUrl]   = useState('')
  const [priorFolderFound, setPriorFolderFound] = useState(null)
  const timerRef                              = useRef(null)
  const progressRef                           = useRef(null)
  const driveTokenRef                         = useRef(null)

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
    if (driveMode) {
      if (!driveFolderUrl.trim()) { setApiError('Paste a Google Drive folder URL to continue.'); return }
    } else {
      if (!clientName.trim()) { setClientNameError(true); return }
      if (currentFiles.length === 0) { setApiError('Please upload at least one PDF document.'); return }
    }

    setPhase('processing')
    setApiError(null)
    startTimers()

    let resolvedCurrentFiles = currentFiles
    let resolvedCurrentBase64List = null
    let resolvedPriorFile = priorFile
    let resolvedPriorBase64 = null

    if (driveMode) {
      try {
        setProcessingStep('Authorizing with Google...')
        await loadGIS()
        const token = await getOAuthToken(COMBINED_SCOPE)
        driveTokenRef.current = token

        setProcessingStep('Reading folder from Google Drive...')
        const { detectedClientName, currentDriveFiles, priorDriveFiles } =
          await fetchFilesFromDrive(driveFolderUrl, taxYear, token)

        if (detectedClientName) setClientName(detectedClientName)

        if (currentDriveFiles.length === 0) {
          throw new Error('No PDF files found in that folder.')
        }

        if (priorDriveFiles.length > 0) {
          setPriorFolderFound(true)
          const autoSelected = priorDriveFiles.find(f => /1040|return|tax/i.test(f.name)) || priorDriveFiles[0]
          resolvedPriorFile = autoSelected
          if (!MOCK_MODE) {
            setProcessingStep(`Downloading ${currentDriveFiles.length} document${currentDriveFiles.length !== 1 ? 's' : ''}...`)
            resolvedCurrentBase64List = await Promise.all(currentDriveFiles.map(f => downloadDriveFileAsBase64(f.id, token)))
            resolvedCurrentFiles = currentDriveFiles
            resolvedPriorBase64 = await downloadDriveFileAsBase64(autoSelected.id, token)
          }
        } else {
          setPriorFolderFound(false)
          if (!MOCK_MODE) {
            setProcessingStep(`Downloading ${currentDriveFiles.length} document${currentDriveFiles.length !== 1 ? 's' : ''}...`)
            resolvedCurrentBase64List = await Promise.all(currentDriveFiles.map(f => downloadDriveFileAsBase64(f.id, token)))
            resolvedCurrentFiles = currentDriveFiles
          }
        }
      } catch (err) {
        stopTimers()
        setApiError(err.message)
        setPhase('empty')
        return
      }
    }

    if (MOCK_MODE) {
      setProcessingStep('Analyzing documents...')
      await new Promise(r => setTimeout(r, 2000))
      setProcessingStep('Organizing extraction results...')
      await new Promise(r => setTimeout(r, 500))
      setSections(parseMarkdownSections(MOCK_RESPONSE))
      stopTimers()
      setPhase('result')
      return
    }

    try {
      setProcessingStep('Reading PDF files...')
      const currentBase64List = resolvedCurrentBase64List ||
        await Promise.all(resolvedCurrentFiles.map(readFileAsBase64))
      const priorBase64 = resolvedPriorBase64 ||
        (resolvedPriorFile ? await readFileAsBase64(resolvedPriorFile) : null)

      setProcessingStep('Sending to Claude for analysis...')

      const contentBlocks = []
      contentBlocks.push({ type: 'text', text: `Client: ${clientName}\n\nCurrent year documents (${resolvedCurrentFiles.length} file${resolvedCurrentFiles.length !== 1 ? 's' : ''}):` })
      resolvedCurrentFiles.forEach((f, i) => {
        contentBlocks.push({ type: 'text', text: `Document ${i + 1}: "${f.name}"` })
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: currentBase64List[i] } })
      })
      if (resolvedPriorFile) {
        contentBlocks.push({ type: 'text', text: `Prior year return: "${resolvedPriorFile.name}"` })
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
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: contentBlocks }],
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || `Anthropic API error ${response.status}`)

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

  async function handleConfirm() {
    const now = new Date()
    setConfirmedAt(now)
    setPhase('confirmed')
    logToAirtable({ clientName, files: currentFiles, priorFile, confirmedAt: now })

    const formTypes = extractFormTypes(sections)
    if (formTypes.length > 0 && clientName.trim()) {
      try {
        setChecklistStatus({ type: 'loading', msg: 'Updating client checklist...' })
        const res = await fetch('/api/checklist?action=detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: clientName.trim(), formTypes }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
        const msg = data.warn
          ? data.warn
          : data.updated === 0
            ? 'Checklist already up to date'
            : `✓ ${data.updated} item${data.updated !== 1 ? 's' : ''} marked Detected in Client Dashboard`
        setChecklistStatus({ type: data.warn ? 'warn' : 'success', msg })
      } catch (e) {
        setChecklistStatus({ type: 'error', msg: 'Checklist update failed: ' + e.message })
      }
    }
  }

  async function handleSendToSheets() {
    try {
      await sendToSheets({
        clientName,
        taxYear,
        sections,
        onStatus: (type, msg) => setSheetsStatus({ type, msg }),
        existingToken: driveTokenRef.current,
      })
    } catch (err) {
      setSheetsStatus({ type: 'error', msg: err.message })
    }
  }

  async function handleUpdateChecklist() {
    try {
      await updateChecklist({
        clientName,
        sections,
        onStatus: (type, msg) => setChecklistStatus({ type, msg }),
      })
    } catch (err) {
      setChecklistStatus({ type: 'error', msg: err.message })
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
    setSheetsStatus(null)
    setChecklistStatus(null)
    setTaxYear('2025')
    setDriveFolderUrl('')
    setPriorFolderFound(null)
    driveTokenRef.current = null
  }

  const hasPriorYear = sections.some(s => s.hasPriorYear)
  const contributionFlags = computeContributionFlags(sections, taxYear)

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

      <div className="tool-two-col" style={{ flexWrap: 'wrap' }}>

        {/* LEFT SIDEBAR */}
        <div id="doc-review-sidebar" className="tool-sidebar" style={{ background: '#1a1a2e', padding: '24px 20px', width: 300, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>

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

          <Section label="Tax Year">
            <div style={{ display: 'flex', gap: 8 }}>
              {['2025', '2024', '2023', '2022'].map(y => (
                <button
                  key={y}
                  onClick={() => setTaxYear(y)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6, textAlign: 'center',
                    border: '1px solid ' + (taxYear === y ? '#c4722a' : 'rgba(247,244,239,0.15)'),
                    background: taxYear === y ? 'rgba(196,114,42,0.15)' : 'transparent',
                    color: taxYear === y ? '#e8a96a' : '#8a8577',
                    fontFamily: 'sans-serif', fontSize: 12, fontWeight: taxYear === y ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </Section>

          <Divider />

          {/* Source mode toggle */}
          <Section label="Document Source">
            <div style={{ display: 'flex', gap: 0, borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(247,244,239,0.15)' }}>
              {[{ id: false, label: 'Upload Files' }, { id: true, label: 'Google Drive' }].map(({ id, label }) => (
                <button
                  key={label}
                  onClick={() => { setDriveMode(id); setDriveFolderUrl(''); setCurrentFiles([]); setPriorFile(null); setPriorFolderFound(null) }}
                  style={{
                    flex: 1, padding: '8px 4px', border: 'none', textAlign: 'center',
                    background: driveMode === id ? 'rgba(196,114,42,0.2)' : 'transparent',
                    color: driveMode === id ? '#e8a96a' : '#8a8577',
                    fontFamily: 'sans-serif', fontSize: 12, fontWeight: driveMode === id ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Divider />

          {driveMode ? (
            <Section label="Drive Folder URL">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TInput
                  value={driveFolderUrl}
                  onChange={e => setDriveFolderUrl(e.target.value)}
                  placeholder="drive.google.com/drive/folders/..."
                />
                <div style={{ fontSize: 11, color: '#8a8577', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
                  Paste the client's <strong style={{ color: '#e8a96a' }}>{taxYear}</strong> folder link. Client name and prior year return will be auto-detected.
                </div>
                {priorFolderFound === true && (
                  <div style={{ fontSize: 11, color: '#6abf7a', fontFamily: 'sans-serif' }}>
                    ✓ Prior year ({parseInt(taxYear) - 1}) folder found
                  </div>
                )}
                {priorFolderFound === false && (
                  <>
                    <div style={{ fontSize: 11, color: '#e8a96a', fontFamily: 'sans-serif' }}>
                      ⚠ No {parseInt(taxYear) - 1} folder found — upload manually:
                    </div>
                    <FileDropZone
                      label="Upload prior year return"
                      multiple={false}
                      files={priorFile ? [priorFile] : []}
                      onFiles={files => setPriorFile(files[0] || null)}
                      muted
                    />
                  </>
                )}
              </div>
            </Section>
          ) : (
            <>
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
            </>
          )}

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
        <div className="tool-content" style={{ flex: 1, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280, background: '#faf9f7', position: 'relative' }}>

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
                      {sheetsStatus?.type === 'loading' ? '⏳ Sending...' : sheetsStatus?.type === 'success' ? '✓ In Sheets' : '↗ Send to Sheets'}
                    </button>
                    <button
                      onClick={handleUpdateChecklist}
                      disabled={checklistStatus?.type === 'loading'}
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #d4cfc6', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12, color: checklistStatus?.type === 'success' ? '#3d7a5e' : checklistStatus?.type === 'warn' ? '#c4722a' : '#8a8577', cursor: checklistStatus?.type === 'loading' ? 'not-allowed' : 'pointer' }}
                    >
                      {checklistStatus?.type === 'loading' ? '⏳ Updating...' : checklistStatus?.type === 'success' ? '✓ Checklist Updated' : '☑ Update Checklist'}
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
                      {sheetsStatus?.type === 'loading' ? '⏳ Sending...' : sheetsStatus?.type === 'success' ? '✓ In Sheets' : '↗ Send to Sheets'}
                    </button>
                    <button
                      onClick={handleUpdateChecklist}
                      disabled={checklistStatus?.type === 'loading'}
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #d4cfc6', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 12, color: checklistStatus?.type === 'success' ? '#3d7a5e' : checklistStatus?.type === 'warn' ? '#c4722a' : '#8a8577', cursor: checklistStatus?.type === 'loading' ? 'not-allowed' : 'pointer' }}
                    >
                      {checklistStatus?.type === 'loading' ? '⏳ Updating...' : checklistStatus?.type === 'success' ? '✓ Checklist Updated' : '☑ Update Checklist'}
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

              {/* Checklist status banner */}
              {checklistStatus && checklistStatus.type !== 'loading' && (
                <div style={{
                  background: checklistStatus.type === 'error' ? 'rgba(200,60,60,0.08)' : checklistStatus.type === 'warn' ? 'rgba(196,114,42,0.08)' : 'rgba(61,122,94,0.08)',
                  border: '1px solid ' + (checklistStatus.type === 'error' ? 'rgba(200,60,60,0.25)' : checklistStatus.type === 'warn' ? 'rgba(196,114,42,0.3)' : 'rgba(61,122,94,0.3)'),
                  borderRadius: 8, padding: '10px 16px', fontFamily: 'sans-serif', fontSize: 12,
                  color: checklistStatus.type === 'error' ? '#c83c3c' : checklistStatus.type === 'warn' ? '#c4722a' : '#3d7a5e',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>{checklistStatus.msg}</span>
                  <button onClick={() => setChecklistStatus(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, marginLeft: 12 }}>✕</button>
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
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontFamily: 'sans-serif', fontSize: 13 }}>
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
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 500, borderBottom: '1px solid #ede9e1', background: contributionFlags[field.label]?.type === 'over' ? '#fff0f0' : contributionFlags[field.label]?.type === 'under' ? '#f0f7ff' : undefined }}>
                                      <span style={{ color: '#1a1a2e' }}>{field.currentValue}</span>
                                      {contributionFlags[field.label] && (() => {
                                        const cf = contributionFlags[field.label]
                                        return (
                                          <span title={cf.message} style={{
                                            display: 'inline-flex', alignItems: 'center', marginLeft: 8,
                                            background: cf.type === 'over' ? '#fde8e8' : '#e8f0fe',
                                            border: `1px solid ${cf.type === 'over' ? '#e57373' : '#7aacf8'}`,
                                            color: cf.type === 'over' ? '#c62828' : '#1a56db',
                                            borderRadius: 4, padding: '1px 5px',
                                            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', cursor: 'default',
                                          }}>
                                            {cf.type === 'over' ? 'OVER LIMIT' : 'NOT MAXED'}
                                          </span>
                                        )
                                      })()}
                                    </td>
                                    {section.hasPriorYear && (() => {
                                      const vPct = getVariancePct(field.currentValue, field.priorValue)
                                      const flagged = vPct !== null && vPct >= 20
                                      return (
                                        <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid #ede9e1', background: flagged ? '#fff8f0' : undefined }}>
                                          <span style={{ color: '#8a8577' }}>{field.priorValue || '—'}</span>
                                          {flagged && (
                                            <span title={`${vPct > 900 ? 'New item' : Math.round(vPct) + '% change'} — review`} style={{
                                              display: 'inline-flex', alignItems: 'center', marginLeft: 8,
                                              background: '#fef3e2', border: '1px solid #e8a96a',
                                              color: '#c4722a', borderRadius: 4, padding: '1px 5px',
                                              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', cursor: 'default',
                                            }}>
                                              {vPct > 900 ? 'NEW' : `+${Math.round(vPct)}%`}
                                            </span>
                                          )}
                                        </td>
                                      )
                                    })()}
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
