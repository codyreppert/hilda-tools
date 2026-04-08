const AIRTABLE_TABLE = 'Client Intake'

const SYSTEM_PROMPT = `You are a client fit assessment assistant for Hilda Gonzalez, CPA at Enlightenment Financial Services.

Analyze the new client intake information and return a JSON object with exactly these keys:
- "outcome": one of "accept", "decline", "more_info"
- "complexity": one of "simple", "moderate", "complex", "very_complex"
- "internalNote": 2–4 sentences for Hilda only. Cover complexity level, estimated hours, key flags, and your recommendation. Be direct and practical.
- "draftEmailSubject": a concise email subject line
- "draftEmail": a warm, professional email from Hilda to the prospect. For accept: welcome them, explain next steps (they'll schedule a call). For decline: graceful and kind, suggest they seek another CPA. For more_info: ask the specific follow-up questions this situation requires.

Factors to weigh:
- URGENCY: It is currently tax season (early April). If they need to file now and the situation is complex, flag that.
- COMPLEXITY signals: S-corp, multi-entity, crypto, foreign income, many K-1s, multi-state, recent business sale = complex/very_complex.
- FIT signals: Simple W-2 only with no complications may not need a full-service CPA — consider declining gracefully.
- RED FLAGS: Unresolved IRS issues, switching CPAs right before deadline with a complex return.
- SERVICE TYPE: Advisory and planning clients are often higher long-term value than one-time filers.

Return ONLY valid JSON. No markdown fences, no preamble.`

const MODEL = 'claude-sonnet-4-6'

async function fetchAllRecords(token, baseId) {
  const records = []
  let offset = null
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE)}`)
    url.searchParams.set('pageSize', '100')
    url.searchParams.set('sort[0][field]', 'Submitted At')
    url.searchParams.set('sort[0][direction]', 'desc')
    if (offset) url.searchParams.set('offset', offset)
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data))
    records.push(...(data.records || []))
    offset = data.offset || null
  } while (offset)
  return records
}

module.exports = async function handler(req, res) {
  const token = process.env.VITE_AIRTABLE_TOKEN
  const baseId = process.env.VITE_AIRTABLE_BASE_ID
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!token || !baseId) return res.status(500).json({ error: 'Missing Airtable config' })

  const action = req.query.action

  if (req.method === 'GET' && action === 'read') {
    try {
      const records = await fetchAllRecords(token, baseId)
      return res.json({ records: records.map(r => ({ id: r.id, fields: r.fields })) })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'POST' && action === 'update') {
    const { recordId, outcome } = req.body || {}
    if (!recordId) return res.status(400).json({ error: 'recordId required' })
    try {
      const r = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Outcome: outcome } }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(JSON.stringify(data))
      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'POST' && action === 'submit') {
    const { name, email, phone, state, filingStatus, dependents, businessOwner,
      businessType, revenueRange, employees, incomeSources, lifeChanges,
      serviceNeeded, urgency, priorCPA, priorCPAReason, irsIssues, howHeard,
      additionalNotes, mode } = req.body || {}

    if (!name || !email) return res.status(400).json({ error: 'name and email required' })

    const summary = `
Name: ${name}
Email: ${email}
Phone: ${phone || 'not provided'}
State: ${state || 'not provided'}
Filing Status: ${filingStatus || 'not provided'}
Dependents: ${dependents || 'none'}
Business Owner: ${businessOwner ? 'Yes' : 'No'}
${businessOwner ? `Business Type: ${businessType || 'not specified'}
Annual Revenue: ${revenueRange || 'not specified'}
Employees: ${employees || 'not specified'}` : ''}
Income Sources: ${Array.isArray(incomeSources) ? incomeSources.join(', ') : (incomeSources || 'not specified')}
Life Changes This Year: ${Array.isArray(lifeChanges) ? lifeChanges.join(', ') : (lifeChanges || 'none')}
Service Needed: ${serviceNeeded || 'not specified'}
Urgency: ${urgency || 'not specified'}
Currently With Another CPA: ${priorCPA ? 'Yes' : 'No'}
${priorCPA ? `Reason for Switching: ${priorCPAReason || 'not specified'}` : ''}
IRS Issues in Past 3 Years: ${irsIssues ? 'Yes' : 'No'}
How They Heard About Us: ${howHeard || 'not specified'}
Additional Notes: ${additionalNotes || 'none'}
`.trim()

    let assessment = {
      outcome: 'more_info',
      complexity: 'moderate',
      internalNote: 'Claude assessment unavailable.',
      draftEmailSubject: `Re: Your Inquiry — Enlightenment Financial Services`,
      draftEmail: `Hi ${name.split(' ')[0]},\n\nThank you for reaching out! I'd love to learn more about your situation. I'll be in touch shortly.\n\nWarmly,\nHilda Gonzalez, CPA\nEnlightenment Financial Services`,
    }

    if (anthropicKey) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: summary }],
          }),
        })
        const aiData = await aiRes.json()
        if (aiRes.ok && aiData.content?.[0]?.text) {
          assessment = JSON.parse(aiData.content[0].text)
        }
      } catch (e) {
        console.warn('[Claude] Assessment failed:', e.message)
      }
    }

    const airtableFields = {
      'Name': name,
      'Email': email,
      'Phone': phone || '',
      'Submitted At': new Date().toISOString().split('T')[0],
      'State': state || '',
      'Filing Status': filingStatus || '',
      'Dependents': dependents || '',
      'Business Owner': !!businessOwner,
      'Business Type': businessType || '',
      'Revenue Range': revenueRange || '',
      'Employees': employees || '',
      'Income Sources': Array.isArray(incomeSources) ? incomeSources.join(', ') : (incomeSources || ''),
      'Life Changes': Array.isArray(lifeChanges) ? lifeChanges.join(', ') : (lifeChanges || ''),
      'Service Needed': serviceNeeded || '',
      'Urgency': urgency || '',
      'Prior CPA': !!priorCPA,
      'Prior CPA Reason': priorCPAReason || '',
      'IRS Issues': !!irsIssues,
      'How Heard': howHeard || '',
      'Additional Notes': additionalNotes || '',
      'Mode': mode || 'form',
      'Complexity': assessment.complexity || 'moderate',
      'Outcome': 'New',
      'Internal Note': assessment.internalNote || '',
      'Draft Email Subject': assessment.draftEmailSubject || '',
      'Draft Email': assessment.draftEmail || '',
    }

    try {
      const atRes = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: airtableFields }),
      })
      const atData = await atRes.json()
      if (!atRes.ok) throw new Error(JSON.stringify(atData))
      return res.json({ ok: true, recordId: atData.id })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
