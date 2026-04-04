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

const MODEL = 'claude-sonnet-4-6'

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured on server' })
  }

  const { clientName, currentFiles, priorFile } = req.body || {}

  if (!clientName || !Array.isArray(currentFiles) || currentFiles.length === 0) {
    return res.status(400).json({ error: 'clientName and at least one file in currentFiles are required' })
  }

  // Build content blocks server-side
  const contentBlocks = []

  contentBlocks.push({
    type: 'text',
    text: `Client: ${clientName}\n\nCurrent year documents (${currentFiles.length} file${currentFiles.length !== 1 ? 's' : ''}):`,
  })

  for (let i = 0; i < currentFiles.length; i++) {
    const file = currentFiles[i]
    if (!file.name || !file.base64) {
      return res.status(400).json({ error: `currentFiles[${i}] must have name and base64 fields` })
    }
    contentBlocks.push({ type: 'text', text: `Document ${i + 1}: "${file.name}"` })
    contentBlocks.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
    })
  }

  if (priorFile) {
    if (!priorFile.name || !priorFile.base64) {
      return res.status(400).json({ error: 'priorFile must have name and base64 fields' })
    }
    contentBlocks.push({ type: 'text', text: `Prior year return: "${priorFile.name}"` })
    contentBlocks.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: priorFile.base64 },
    })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `Anthropic API error ${response.status}`,
      })
    }

    return res.json({ text: data.content[0].text })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected server error' })
  }
}

// Increase body size limit to handle multi-document base64 payloads
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
}
