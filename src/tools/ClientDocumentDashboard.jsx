import { useState, useEffect, useRef } from 'react'

function mockItem(id, category, item, status, notes = '', driveFileName = '') {
  return { id, category, item, status, notes, driveFileName, lastScanned: '' }
}

const MOCK_CLIENTS = [
  {
    name: 'Reppert, Cody',
    returnType: 'Personal',
    items: [
      mockItem('m1',  'Income', 'W-2s (all employers)', 'Verified', '', 'W2'),
      mockItem('m2',  'Income', '1099 forms (NEC, MISC, K, INT, DIV, B)', 'Verified', '', '1099s Investment'),
      mockItem('m3',  'Income', 'Self-employment / side income details', 'N/A'),
      mockItem('m4',  'Income', 'Rental income (long-term / short-term)', 'Detected', '', 'BURNS 24 RTN.pdf'),
      mockItem('m5',  'Income', 'K-1s (partnerships / S-corps)', 'Verified', '', 'K-1'),
      mockItem('m6',  'Business & Rentals', 'Business/entity type', 'N/A'),
      mockItem('m7',  'Business & Rentals', 'Profit & Loss statement', 'N/A'),
      mockItem('m8',  'Business & Rentals', 'Major expenses & payroll details', 'N/A'),
      mockItem('m9',  'Business & Rentals', 'Asset purchases (vehicles, equipment, property)', 'N/A'),
      mockItem('m10', 'Business & Rentals', 'Depreciation schedules', 'N/A'),
      mockItem('m11', 'Business & Rentals', 'Short-term rental details', 'N/A'),
      mockItem('m12', 'Real Estate', 'Closing statements (HUD / CD)', 'N/A'),
      mockItem('m13', 'Real Estate', 'Mortgage interest statements (1098)', 'Verified', '', '1098-E'),
      mockItem('m14', 'Real Estate', 'Property tax statements', 'Not Started'),
      mockItem('m15', 'Real Estate', 'Repairs vs improvements list', 'N/A'),
      mockItem('m16', 'Real Estate', 'Cost segregation study (if applicable)', 'N/A'),
      mockItem('m17', 'Deductions & Credits', 'Retirement contributions', 'Not Started'),
      mockItem('m18', 'Deductions & Credits', 'HSA contributions', 'N/A'),
      mockItem('m19', 'Deductions & Credits', 'Education expenses', 'N/A'),
      mockItem('m20', 'Deductions & Credits', 'Childcare expenses', 'N/A'),
      mockItem('m21', 'Deductions & Credits', 'Charitable contributions', 'Not Started'),
      mockItem('m22', 'Vehicles & Travel', 'Business-use vehicles', 'N/A'),
      mockItem('m23', 'Vehicles & Travel', 'Mileage logs', 'N/A'),
      mockItem('m24', 'Vehicles & Travel', 'Auto purchase/lease info', 'N/A'),
      mockItem('m25', 'Vehicles & Travel', 'Business/rental travel expenses', 'N/A'),
      mockItem('m26', 'Tax Planning', 'Estimated tax payments', 'Verified', '', '1099-G'),
      mockItem('m27', 'Tax Planning', 'IRS or state notices', 'N/A'),
      mockItem('m28', 'Tax Planning', 'Expected life/income changes', 'Not Started'),
      mockItem('m29', 'Tax Planning', 'Short- and long-term goals', 'Not Started'),
    ],
  },
  {
    name: 'Garcia, Maria & Luis',
    returnType: 'Personal',
    items: [
      mockItem('g1',  'Income', 'W-2s (all employers)', 'Verified'),
      mockItem('g2',  'Income', '1099 forms (NEC, MISC, K, INT, DIV, B)', 'Verified'),
      mockItem('g3',  'Income', 'Self-employment / side income details', 'Verified'),
      mockItem('g4',  'Income', 'Rental income (long-term / short-term)', 'N/A'),
      mockItem('g5',  'Income', 'K-1s (partnerships / S-corps)', 'N/A'),
      mockItem('g6',  'Business & Rentals', 'Business/entity type', 'N/A'),
      mockItem('g7',  'Business & Rentals', 'Profit & Loss statement', 'N/A'),
      mockItem('g8',  'Business & Rentals', 'Major expenses & payroll details', 'N/A'),
      mockItem('g9',  'Business & Rentals', 'Asset purchases (vehicles, equipment, property)', 'N/A'),
      mockItem('g10', 'Business & Rentals', 'Depreciation schedules', 'N/A'),
      mockItem('g11', 'Business & Rentals', 'Short-term rental details', 'N/A'),
      mockItem('g12', 'Real Estate', 'Closing statements (HUD / CD)', 'N/A'),
      mockItem('g13', 'Real Estate', 'Mortgage interest statements (1098)', 'Verified'),
      mockItem('g14', 'Real Estate', 'Property tax statements', 'Verified'),
      mockItem('g15', 'Real Estate', 'Repairs vs improvements list', 'N/A'),
      mockItem('g16', 'Real Estate', 'Cost segregation study (if applicable)', 'N/A'),
      mockItem('g17', 'Deductions & Credits', 'Retirement contributions', 'Verified'),
      mockItem('g18', 'Deductions & Credits', 'HSA contributions', 'Verified'),
      mockItem('g19', 'Deductions & Credits', 'Education expenses', 'Verified'),
      mockItem('g20', 'Deductions & Credits', 'Childcare expenses', 'Verified'),
      mockItem('g21', 'Deductions & Credits', 'Charitable contributions', 'Verified'),
      mockItem('g22', 'Vehicles & Travel', 'Business-use vehicles', 'N/A'),
      mockItem('g23', 'Vehicles & Travel', 'Mileage logs', 'N/A'),
      mockItem('g24', 'Vehicles & Travel', 'Auto purchase/lease info', 'N/A'),
      mockItem('g25', 'Vehicles & Travel', 'Business/rental travel expenses', 'N/A'),
      mockItem('g26', 'Tax Planning', 'Estimated tax payments', 'Verified'),
      mockItem('g27', 'Tax Planning', 'IRS or state notices', 'N/A'),
      mockItem('g28', 'Tax Planning', 'Expected life/income changes', 'Verified'),
      mockItem('g29', 'Tax Planning', 'Short- and long-term goals', 'Verified'),
    ],
  },
  {
    name: 'Johnson Properties LLC',
    returnType: 'Business',
    items: [
      mockItem('j1',  'Income', 'W-2s (all employers)', 'N/A'),
      mockItem('j2',  'Income', '1099 forms (NEC, MISC, K, INT, DIV, B)', 'Detected', '', 'income_docs_2025.pdf'),
      mockItem('j3',  'Income', 'Self-employment / side income details', 'N/A'),
      mockItem('j4',  'Income', 'Rental income (long-term / short-term)', 'Not Started'),
      mockItem('j5',  'Income', 'K-1s (partnerships / S-corps)', 'Not Started'),
      mockItem('j6',  'Business & Rentals', 'Business/entity type', 'Verified'),
      mockItem('j7',  'Business & Rentals', 'Profit & Loss statement', 'Detected', '', 'PL_2025_draft.xlsx'),
      mockItem('j8',  'Business & Rentals', 'Major expenses & payroll details', 'Not Started'),
      mockItem('j9',  'Business & Rentals', 'Asset purchases (vehicles, equipment, property)', 'Not Started'),
      mockItem('j10', 'Business & Rentals', 'Depreciation schedules', 'Not Started'),
      mockItem('j11', 'Business & Rentals', 'Short-term rental details', 'Detected', '', 'STR_summary.pdf'),
      mockItem('j12', 'Real Estate', 'Closing statements (HUD / CD)', 'Not Started'),
      mockItem('j13', 'Real Estate', 'Mortgage interest statements (1098)', 'Not Started'),
      mockItem('j14', 'Real Estate', 'Property tax statements', 'Not Started'),
      mockItem('j15', 'Real Estate', 'Repairs vs improvements list', 'Not Started'),
      mockItem('j16', 'Real Estate', 'Cost segregation study (if applicable)', 'Not Started'),
      mockItem('j17', 'Deductions & Credits', 'Retirement contributions', 'N/A'),
      mockItem('j18', 'Deductions & Credits', 'HSA contributions', 'N/A'),
      mockItem('j19', 'Deductions & Credits', 'Education expenses', 'N/A'),
      mockItem('j20', 'Deductions & Credits', 'Childcare expenses', 'N/A'),
      mockItem('j21', 'Deductions & Credits', 'Charitable contributions', 'Not Started'),
      mockItem('j22', 'Vehicles & Travel', 'Business-use vehicles', 'Verified'),
      mockItem('j23', 'Vehicles & Travel', 'Mileage logs', 'Not Started', 'Need 2025 mileage log'),
      mockItem('j24', 'Vehicles & Travel', 'Auto purchase/lease info', 'N/A'),
      mockItem('j25', 'Vehicles & Travel', 'Business/rental travel expenses', 'Not Started'),
      mockItem('j26', 'Tax Planning', 'Estimated tax payments', 'Verified'),
      mockItem('j27', 'Tax Planning', 'IRS or state notices', 'N/A'),
      mockItem('j28', 'Tax Planning', 'Expected life/income changes', 'Not Started'),
      mockItem('j29', 'Tax Planning', 'Short- and long-term goals', 'Not Started'),
    ],
  },
  {
    name: 'Chen, David & Lisa',
    returnType: 'Personal',
    items: [
      mockItem('c1',  'Income', 'W-2s (all employers)', 'Not Started'),
      mockItem('c2',  'Income', '1099 forms (NEC, MISC, K, INT, DIV, B)', 'Not Started'),
      mockItem('c3',  'Income', 'Self-employment / side income details', 'Not Started'),
      mockItem('c4',  'Income', 'Rental income (long-term / short-term)', 'Not Started'),
      mockItem('c5',  'Income', 'K-1s (partnerships / S-corps)', 'Not Started'),
      mockItem('c6',  'Business & Rentals', 'Business/entity type', 'Not Started'),
      mockItem('c7',  'Business & Rentals', 'Profit & Loss statement', 'Not Started'),
      mockItem('c8',  'Business & Rentals', 'Major expenses & payroll details', 'Not Started'),
      mockItem('c9',  'Business & Rentals', 'Asset purchases (vehicles, equipment, property)', 'Not Started'),
      mockItem('c10', 'Business & Rentals', 'Depreciation schedules', 'Not Started'),
      mockItem('c11', 'Business & Rentals', 'Short-term rental details', 'Not Started'),
      mockItem('c12', 'Real Estate', 'Closing statements (HUD / CD)', 'Not Started'),
      mockItem('c13', 'Real Estate', 'Mortgage interest statements (1098)', 'Not Started'),
      mockItem('c14', 'Real Estate', 'Property tax statements', 'Not Started'),
      mockItem('c15', 'Real Estate', 'Repairs vs improvements list', 'Not Started'),
      mockItem('c16', 'Real Estate', 'Cost segregation study (if applicable)', 'Not Started'),
      mockItem('c17', 'Deductions & Credits', 'Retirement contributions', 'Not Started'),
      mockItem('c18', 'Deductions & Credits', 'HSA contributions', 'Not Started'),
      mockItem('c19', 'Deductions & Credits', 'Education expenses', 'Not Started'),
      mockItem('c20', 'Deductions & Credits', 'Childcare expenses', 'Not Started'),
      mockItem('c21', 'Deductions & Credits', 'Charitable contributions', 'Not Started'),
      mockItem('c22', 'Vehicles & Travel', 'Business-use vehicles', 'Not Started'),
      mockItem('c23', 'Vehicles & Travel', 'Mileage logs', 'Not Started'),
      mockItem('c24', 'Vehicles & Travel', 'Auto purchase/lease info', 'Not Started'),
      mockItem('c25', 'Vehicles & Travel', 'Business/rental travel expenses', 'Not Started'),
      mockItem('c26', 'Tax Planning', 'Estimated tax payments', 'Not Started'),
      mockItem('c27', 'Tax Planning', 'IRS or state notices', 'Not Started'),
      mockItem('c28', 'Tax Planning', 'Expected life/income changes', 'Not Started'),
      mockItem('c29', 'Tax Planning', 'Short- and long-term goals', 'Not Started'),
    ],
  },
]

const CATEGORIES = [
  'Income',
  'Business & Rentals',
  'Real Estate',
  'Deductions & Credits',
  'Vehicles & Travel',
  'Tax Planning',
]

const CHECKLIST_TEMPLATE = {
  'Income': [
    'W-2s (all employers)',
    '1099 forms (NEC, MISC, K, INT, DIV, B)',
    'Self-employment / side income details',
    'Rental income (long-term / short-term)',
    'K-1s (partnerships / S-corps)',
  ],
  'Business & Rentals': [
    'Business/entity type',
    'Profit & Loss statement',
    'Major expenses & payroll details',
    'Asset purchases (vehicles, equipment, property)',
    'Depreciation schedules',
    'Short-term rental details',
  ],
  'Real Estate': [
    'Closing statements (HUD / CD)',
    'Mortgage interest statements (1098)',
    'Property tax statements',
    'Repairs vs improvements list',
    'Cost segregation study (if applicable)',
  ],
  'Deductions & Credits': [
    'Retirement contributions',
    'HSA contributions',
    'Education expenses',
    'Childcare expenses',
    'Charitable contributions',
  ],
  'Vehicles & Travel': [
    'Business-use vehicles',
    'Mileage logs',
    'Auto purchase/lease info',
    'Business/rental travel expenses',
  ],
  'Tax Planning': [
    'Estimated tax payments',
    'IRS or state notices',
    'Expected life/income changes',
    'Short- and long-term goals',
  ],
}

const STATUS_COLORS = {
  'Not Started': '#8a8577',
  'Detected': '#c4722a',
  'Verified': '#3d7a5e',
  'N/A': '#5a7fa0',
}

const STATUS_BG = {
  'Not Started': 'rgba(138,133,119,0.12)',
  'Detected': 'rgba(232,169,106,0.15)',
  'Verified': 'rgba(61,122,94,0.12)',
  'N/A': 'rgba(90,127,160,0.12)',
}

function clientProgress(client) {
  const countable = client.items.filter(i => i.status !== 'N/A')
  const verified = client.items.filter(i => i.status === 'Verified').length
  const detected = client.items.filter(i => i.status === 'Detected').length
  const notStarted = client.items.filter(i => i.status === 'Not Started').length
  return { total: countable.length, verified, detected, notStarted }
}

function clientColor(client) {
  const { total, verified } = clientProgress(client)
  if (total === 0) return '#8a8577'
  if (verified === total) return '#3d7a5e'
  if (verified > 0) return '#c4722a'
  return '#c0392b'
}

function buildTemplateRows(clientName, returnType) {
  const rows = []
  for (const category of CATEGORIES) {
    for (const item of CHECKLIST_TEMPLATE[category]) {
      rows.push({
        'Client Name': clientName,
        'Return Type': returnType,
        'Category': category,
        'Checklist Item': item,
        'Status': 'Not Started',
        'Notes': '',
      })
    }
  }
  return rows
}

export default function ClientDocumentDashboard() {
  const [clients, setClients] = useState(MOCK_CLIENTS)
  const [loading, setLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('Personal')
  const [creating, setCreating] = useState(false)

  const [savingId, setSavingId] = useState(null)

  async function fetchClients() {
    setLoading(true)
    try {
      const res = await fetch('/api/checklist?action=read')
      const data = await res.json()
      const real = data.clients || []
      setClients(real.length > 0 ? real : MOCK_CLIENTS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClients() }, [])

  async function updateItem(clientName, itemId, field, value) {
    setSavingId(itemId)
    setClients(prev => prev.map(c => c.name === clientName
      ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, [field]: value } : i) }
      : c
    ))
    if (selectedClient?.name === clientName) {
      setSelectedClient(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, [field]: value } : i),
      }))
    }
    const body = { recordId: itemId }
    if (field === 'status') body.status = value
    if (field === 'notes') body.notes = value
    await fetch('/api/checklist?action=update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSavingId(null)
  }

  async function handleAddClient(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const rows = buildTemplateRows(newName.trim(), newType)
    await fetch('/api/checklist?action=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: rows }),
    })
    await fetchClients()
    const fresh = clients.find(c => c.name === newName.trim())
    setSelectedClient(fresh || null)
    setCreating(false)
    setShowModal(false)
    setNewName('')
    setNewType('Personal')
  }

  useEffect(() => {
    if (clients.length && selectedClient) {
      const updated = clients.find(c => c.name === selectedClient.name)
      if (updated) setSelectedClient(updated)
    }
  }, [clients])

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 50px)' }}>
      <div style={{ background: '#1a1a2e', padding: '16px 24px', borderBottom: '1px solid rgba(247,244,239,0.06)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', marginBottom: 3 }}>Tool 02</div>
        <div style={{ fontSize: 17, color: '#f7f4ef', fontFamily: 'Georgia, serif' }}>Client Document Dashboard</div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>

        {/* LEFT PANEL */}
        <div style={{ background: '#1a1a2e', width: 300, minWidth: 280, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', borderRight: '1px solid rgba(247,244,239,0.06)' }}>
          <div style={{ padding: '16px 16px 8px' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients…"
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: 'sans-serif', fontSize: 13,
                background: 'rgba(247,244,239,0.07)',
                border: '1px solid rgba(247,244,239,0.14)',
                borderRadius: 6, padding: '8px 11px', color: '#f7f4ef', outline: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loading && (
              <div style={{ padding: '24px 16px', fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577', textAlign: 'center' }}>Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: '24px 16px', fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577', textAlign: 'center' }}>No clients yet</div>
            )}
            {filtered.map(client => {
              const { total, verified, detected, notStarted } = clientProgress(client)
              const color = clientColor(client)
              const pct = total > 0 ? Math.round((verified / total) * 100) : 0
              const isSelected = selectedClient?.name === client.name
              return (
                <div
                  key={client.name}
                  onClick={() => setSelectedClient(client)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderLeft: isSelected ? '3px solid #c4722a' : '3px solid transparent',
                    background: isSelected ? 'rgba(196,114,42,0.08)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(247,244,239,0.04)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#f7f4ef', fontWeight: 500 }}>{client.name}</div>
                    <div style={{
                      fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.04em',
                      padding: '2px 7px', borderRadius: 10,
                      background: client.returnType === 'Business' ? 'rgba(90,127,160,0.2)' : 'rgba(232,169,106,0.15)',
                      color: client.returnType === 'Business' ? '#5a7fa0' : '#e8a96a',
                    }}>
                      {client.returnType}
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'rgba(247,244,239,0.08)', borderRadius: 2, marginBottom: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#8a8577' }}>
                    <span style={{ color: '#3d7a5e' }}>{verified} verified</span>
                    {detected > 0 && <span style={{ color: '#c4722a' }}> · {detected} detected</span>}
                    {notStarted > 0 && <span> · {notStarted} not started</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(247,244,239,0.06)' }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                width: '100%', padding: '10px', background: '#c4722a',
                border: 'none', borderRadius: 8, color: 'white',
                fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Add Client
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex: 1, background: '#f7f4ef', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
          {!selectedClient && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, gap: 10, opacity: 0.4 }}>
              <div style={{ fontSize: 36 }}>📋</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#8a8577' }}>Select a client to view their checklist</div>
            </div>
          )}

          {selectedClient && (() => {
            const { total, verified, detected, notStarted } = clientProgress(selectedClient)
            return (
              <div style={{ padding: '28px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1a2e', marginBottom: 4 }}>{selectedClient.name}</div>
                    <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577' }}>
                      {selectedClient.returnType} Return &nbsp;·&nbsp;
                      <span style={{ color: '#3d7a5e' }}>{verified} verified</span>
                      {detected > 0 && <span style={{ color: '#c4722a' }}> · {detected} detected</span>}
                      <span> · {notStarted} not started</span>
                      <span> · {total - verified - detected - notStarted} N/A</span>
                    </div>
                  </div>
                  <button
                    disabled
                    title="Coming in Phase 2"
                    style={{
                      padding: '8px 16px', background: 'transparent',
                      border: '1px solid #d4cfc6', borderRadius: 6,
                      fontFamily: 'sans-serif', fontSize: 13, color: '#c8c3bb',
                      cursor: 'not-allowed',
                    }}
                  >
                    Scan Drive
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {CATEGORIES.map(category => {
                    const items = selectedClient.items.filter(i => i.category === category)
                    if (items.length === 0) return null
                    const catVerified = items.filter(i => i.status === 'Verified').length
                    return (
                      <div key={category}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #d4cfc6' }}>
                          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'sans-serif', fontWeight: 600, color: '#8a8577' }}>
                            {category}
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'sans-serif', color: catVerified === items.length ? '#3d7a5e' : '#8a8577' }}>
                            {catVerified} / {items.length}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {items.map(item => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              saving={savingId === item.id}
                              onStatusChange={v => updateItem(selectedClient.name, item.id, 'status', v)}
                              onNotesBlur={v => updateItem(selectedClient.name, item.id, 'notes', v)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ADD CLIENT MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <form onSubmit={handleAddClient} style={{
            background: 'white', borderRadius: 12, padding: '28px 28px',
            width: 360, display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 8px 40px rgba(26,26,46,0.18)',
          }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#1a1a2e' }}>Add Client</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577' }}>Client Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="First Last"
                autoFocus
                style={{
                  fontFamily: 'sans-serif', fontSize: 14,
                  border: '1px solid #d4cfc6', borderRadius: 6,
                  padding: '9px 11px', color: '#1a1a2e', outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577' }}>Return Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Personal', 'Business'].map(t => (
                  <button key={t} type="button" onClick={() => setNewType(t)} style={{
                    flex: 1, padding: '9px', borderRadius: 6,
                    border: '1px solid ' + (newType === t ? '#c4722a' : '#d4cfc6'),
                    background: newType === t ? 'rgba(196,114,42,0.08)' : 'transparent',
                    color: newType === t ? '#c4722a' : '#8a8577',
                    fontFamily: 'sans-serif', fontSize: 13, fontWeight: newType === t ? 600 : 400,
                    cursor: 'pointer',
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '10px', background: 'transparent',
                border: '1px solid #d4cfc6', borderRadius: 6,
                fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577', cursor: 'pointer',
              }}>Cancel</button>
              <button type="submit" disabled={creating || !newName.trim()} style={{
                flex: 2, padding: '10px', background: creating ? '#d4cfc6' : '#c4722a',
                border: 'none', borderRadius: 6, color: 'white',
                fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600, cursor: creating ? 'default' : 'pointer',
              }}>
                {creating ? 'Creating…' : 'Add Client'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, saving, onStatusChange, onNotesBlur }) {
  const [notes, setNotes] = useState(item.notes)
  const inputRef = useRef()

  useEffect(() => { setNotes(item.notes) }, [item.notes])

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 140px',
      gap: 8, padding: '8px 10px', borderRadius: 6,
      background: STATUS_BG[item.status] || 'transparent',
      alignItems: 'start',
    }}>
      <div>
        <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#2d2d3e', lineHeight: 1.4 }}>
          {item.item}
          {saving && <span style={{ fontSize: 10, color: '#8a8577', marginLeft: 8, fontStyle: 'italic' }}>saving…</span>}
        </div>
        {item.driveFileName && (
          <div style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#8a8577', fontStyle: 'italic', marginTop: 2 }}>
            {item.driveFileName}
          </div>
        )}
        <input
          ref={inputRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => { if (notes !== item.notes) onNotesBlur(notes) }}
          placeholder="Add note…"
          style={{
            marginTop: 5, width: '100%', boxSizing: 'border-box',
            fontFamily: 'sans-serif', fontSize: 12,
            background: 'transparent', border: 'none',
            borderBottom: '1px solid #d4cfc6',
            color: '#8a8577', outline: 'none', padding: '2px 0',
          }}
        />
      </div>
      <select
        value={item.status}
        onChange={e => onStatusChange(e.target.value)}
        style={{
          fontFamily: 'sans-serif', fontSize: 12, fontWeight: 600,
          color: STATUS_COLORS[item.status] || '#8a8577',
          background: 'white', border: '1px solid #d4cfc6',
          borderRadius: 6, padding: '5px 8px', cursor: 'pointer', outline: 'none',
        }}
      >
        <option value="Not Started">Not Started</option>
        <option value="Detected">Detected</option>
        <option value="Verified">Verified</option>
        <option value="N/A">N/A</option>
      </select>
    </div>
  )
}
