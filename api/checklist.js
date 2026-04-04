const AIRTABLE_TABLE = 'Client Checklist'

async function fetchAllRecords(token, baseId) {
  const records = []
  let offset = null
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE)}`)
    url.searchParams.set('pageSize', '100')
    if (offset) url.searchParams.set('offset', offset)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data))
    records.push(...(data.records || []))
    offset = data.offset || null
  } while (offset)
  return records
}

function groupByClient(records) {
  const clients = {}
  for (const r of records) {
    const name = r.fields['Client Name'] || 'Unknown'
    if (!clients[name]) clients[name] = { name, returnType: r.fields['Return Type'] || 'Personal', items: [] }
    clients[name].items.push({
      id: r.id,
      category: r.fields['Category'] || '',
      item: r.fields['Checklist Item'] || '',
      status: r.fields['Status'] || 'Not Started',
      notes: r.fields['Notes'] || '',
      driveFileName: r.fields['Drive File Name'] || '',
      lastScanned: r.fields['Last Scanned'] || '',
    })
  }
  return Object.values(clients)
}

async function batchCreate(token, baseId, records) {
  const chunks = []
  for (let i = 0; i < records.length; i += 10) chunks.push(records.slice(i, i + 10))
  for (const chunk of chunks) {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: chunk.map(f => ({ fields: f })) }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data))
  }
}

module.exports = async function handler(req, res) {
  const token = process.env.VITE_AIRTABLE_TOKEN
  const baseId = process.env.VITE_AIRTABLE_BASE_ID
  const password = process.env.DASHBOARD_PASSWORD
  const reqPassword = req.headers['x-dashboard-password']

  if (!reqPassword || reqPassword !== password) return res.status(401).json({
    error: 'Unauthorized',
    debug: {
      envVarSet: !!password,
      envVarLength: password ? password.length : 0,
      headerReceived: !!reqPassword,
      headerLength: reqPassword ? reqPassword.length : 0,
    }
  })
  if (!token || !baseId) return res.status(500).json({ error: 'Missing Airtable config' })

  const action = req.query.action

  if (req.method === 'GET' && action === 'read') {
    try {
      const records = await fetchAllRecords(token, baseId)
      return res.json({ clients: groupByClient(records) })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'POST' && action === 'update') {
    const { recordId, status, notes } = req.body
    if (!recordId) return res.status(400).json({ error: 'recordId required' })
    const fields = {}
    if (status !== undefined) fields['Status'] = status
    if (notes !== undefined) fields['Notes'] = notes
    try {
      const r = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(JSON.stringify(data))
      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'POST' && action === 'create') {
    const { records } = req.body
    if (!records?.length) return res.status(400).json({ error: 'records required' })
    try {
      await batchCreate(token, baseId, records)
      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
