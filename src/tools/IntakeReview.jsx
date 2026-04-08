import { useState, useEffect } from 'react'
import { useDarkMode } from '../App'

const API = '/api/intake'

const COMPLEXITY_COLORS = {
  simple:      { bg: '#d1fae5', text: '#065f46' },
  moderate:    { bg: '#fef3c7', text: '#92400e' },
  complex:     { bg: '#ffedd5', text: '#9a3412' },
  very_complex:{ bg: '#fee2e2', text: '#991b1b' },
}

const OUTCOME_COLORS = {
  New:       { bg: '#f1f5f9', text: '#475569' },
  Accepted:  { bg: '#d1fae5', text: '#065f46' },
  Declined:  { bg: '#f1f5f9', text: '#94a3b8' },
  'More Info':{ bg: '#dbeafe', text: '#1e40af' },
}

function ComplexityBadge({ complexity }) {
  const c = COMPLEXITY_COLORS[complexity] || COMPLEXITY_COLORS.moderate
  const label = complexity === 'very_complex' ? 'Very Complex' : (complexity || 'Moderate')
  const display = label.charAt(0).toUpperCase() + label.slice(1).replace('_', ' ')
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontFamily: 'sans-serif', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 20,
    }}>{display}</span>
  )
}

function OutcomeChip({ outcome }) {
  const o = OUTCOME_COLORS[outcome] || OUTCOME_COLORS.New
  return (
    <span style={{
      background: o.bg, color: o.text,
      fontFamily: 'sans-serif', fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 12,
    }}>{outcome || 'New'}</span>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FieldRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 160, flexShrink: 0 }}>{label}</div>
      <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#1a1a2e', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

export default function IntakeReview() {
  const { darkMode } = useDarkMode()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [emailText, setEmailText] = useState('')
  const [copied, setCopied] = useState(false)
  const [updatingOutcome, setUpdatingOutcome] = useState(false)

  useEffect(() => {
    fetchRecords()
  }, [])

  useEffect(() => {
    if (selected) {
      setEmailText(selected.fields['Draft Email'] || '')
      setCopied(false)
    }
  }, [selected?.id])

  async function fetchRecords() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}?action=read`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setRecords(data.records || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function setOutcome(outcome) {
    if (!selected) return
    setUpdatingOutcome(true)
    try {
      const res = await fetch(`${API}?action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: selected.id, outcome }),
      })
      if (!res.ok) throw new Error('Update failed')
      setRecords(prev => prev.map(r => r.id === selected.id ? { ...r, fields: { ...r.fields, Outcome: outcome } } : r))
      setSelected(prev => ({ ...prev, fields: { ...prev.fields, Outcome: outcome } }))
    } catch (e) {
      alert('Failed to update: ' + e.message)
    } finally {
      setUpdatingOutcome(false)
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText(emailText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const filtered = records.filter(r =>
    (r.fields['Name'] || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.fields['Email'] || '').toLowerCase().includes(search.toLowerCase())
  )

  const f = selected?.fields || {}

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 49px)', overflow: 'hidden', background: darkMode ? '#0a0a0e' : 'transparent' }}>
      {/* Left panel */}
      <div style={{ width: 280, flexShrink: 0, background: darkMode ? '#0a0a0e' : '#1a1a2e', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${darkMode ? 'rgba(232,229,224,0.08)' : 'rgba(247,244,239,0.08)'}` }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', marginBottom: 6 }}>Tool 04</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f7f4ef', marginBottom: 16 }}>Client Intake</div>
          <input
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${darkMode ? 'rgba(232,229,224,0.12)' : 'rgba(247,244,239,0.12)'}`, background: darkMode ? 'rgba(232,229,224,0.06)' : 'rgba(255,255,255,0.06)',
              color: '#f7f4ef', fontFamily: 'sans-serif', fontSize: 13, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577' }}>Loading…</div>
          )}
          {error && (
            <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: 13, color: '#f87171' }}>{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577' }}>No submissions yet</div>
          )}
          {filtered.map(r => {
            const isSelected = selected?.id === r.id
            return (
              <div
                key={r.id}
                onClick={() => setSelected(r)}
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(247,244,239,0.05)',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(196,114,42,0.14)' : 'transparent',
                  borderLeft: isSelected ? '3px solid #c4722a' : '3px solid transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600, color: '#f7f4ef', marginBottom: 4 }}>
                  {r.fields['Name'] || 'Unknown'}
                </div>
                <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#8a8577', marginBottom: 8 }}>
                  {formatDate(r.fields['Submitted At'])}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <ComplexityBadge complexity={r.fields['Complexity']} />
                  <OutcomeChip outcome={r.fields['Outcome']} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(247,244,239,0.08)' }}>
          <button
            onClick={fetchRecords}
            style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f7f4ef' }}>
        {!selected ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c8c3bb', marginBottom: 8 }}>Select a submission</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#c8c3bb' }}>Click a prospect in the left panel to review their intake</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '32px 36px', maxWidth: 780 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, color: '#1a1a2e', margin: '0 0 6px' }}>
                  {f['Name']}
                </h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577' }}>{formatDate(f['Submitted At'])}</span>
                  <span style={{ color: '#d4cfc6' }}>·</span>
                  <ComplexityBadge complexity={f['Complexity']} />
                  <OutcomeChip outcome={f['Outcome']} />
                </div>
              </div>
            </div>

            {/* Prospect Answers */}
            <div style={card}>
              <div style={cardTitle}>Prospect Answers</div>
              <FieldRow label="Email" value={f['Email']} />
              <FieldRow label="Phone" value={f['Phone']} />
              <FieldRow label="State" value={f['State']} />
              <FieldRow label="Filing Status" value={f['Filing Status']} />
              <FieldRow label="Dependents" value={f['Dependents']} />
              <FieldRow label="Business Owner" value={f['Business Owner'] ? 'Yes' : 'No'} />
              {f['Business Owner'] && <>
                <FieldRow label="Business Type" value={f['Business Type']} />
                <FieldRow label="Revenue Range" value={f['Revenue Range']} />
                <FieldRow label="Employees" value={f['Employees']} />
              </>}
              <FieldRow label="Income Sources" value={f['Income Sources']} />
              <FieldRow label="Life Changes" value={f['Life Changes']} />
              <FieldRow label="Service Needed" value={f['Service Needed']} />
              <FieldRow label="Urgency" value={f['Urgency']} />
              <FieldRow label="Prior CPA" value={f['Prior CPA'] ? 'Yes' : 'No'} />
              {f['Prior CPA'] && <FieldRow label="Switching Reason" value={f['Prior CPA Reason']} />}
              <FieldRow label="IRS Issues" value={f['IRS Issues'] ? 'Yes' : 'No'} />
              <FieldRow label="How They Heard" value={f['How Heard']} />
              <FieldRow label="Additional Notes" value={f['Additional Notes']} />
              <FieldRow label="Submitted Via" value={f['Mode']} />
            </div>

            {/* Internal Assessment */}
            {f['Internal Note'] && (
              <div style={{ ...card, background: '#1a1a2e', borderColor: 'transparent' }}>
                <div style={{ ...cardTitle, color: '#e8a96a' }}>Internal Assessment (Hilda Only)</div>
                <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#c8c3bb', lineHeight: 1.7 }}>
                  {f['Internal Note']}
                </div>
              </div>
            )}

            {/* Draft Email */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={cardTitle}>Draft Response Email</div>
                <button
                  onClick={copyEmail}
                  style={{
                    padding: '7px 14px',
                    background: copied ? '#3d7a5e' : '#1a1a2e',
                    color: 'white', border: 'none', borderRadius: 8,
                    fontFamily: 'sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {f['Draft Email Subject'] && (
                <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#8a8577', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject: </span>
                  <span style={{ color: '#e8a96a' }}>{f['Draft Email Subject']}</span>
                </div>
              )}
              <textarea
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
                rows={12}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #d4cfc6',
                  fontFamily: 'sans-serif', fontSize: 13, lineHeight: 1.65, resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box', background: '#faf9f7', color: '#1a1a2e',
                }}
              />
            </div>

            {/* Outcome buttons */}
            <div style={{ ...card, background: '#fff' }}>
              <div style={cardTitle}>Update Outcome</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <OutcomeButton
                  label="Accept"
                  active={f['Outcome'] === 'Accepted'}
                  color="#3d7a5e"
                  onClick={() => setOutcome('Accepted')}
                  disabled={updatingOutcome}
                />
                <OutcomeButton
                  label="Decline"
                  active={f['Outcome'] === 'Declined'}
                  color="#6b7280"
                  onClick={() => setOutcome('Declined')}
                  disabled={updatingOutcome}
                />
                <OutcomeButton
                  label="Request More Info"
                  active={f['Outcome'] === 'More Info'}
                  color="#1e40af"
                  onClick={() => setOutcome('More Info')}
                  disabled={updatingOutcome}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OutcomeButton({ label, active, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 18px',
        background: active ? color : 'white',
        color: active ? 'white' : color,
        border: `2px solid ${color}`,
        borderRadius: 8, fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

const card = {
  background: 'white',
  border: '1px solid #d4cfc6',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 16,
}

const cardTitle = {
  fontFamily: 'Georgia, serif',
  fontSize: 16,
  fontWeight: 600,
  color: '#1a1a2e',
  marginBottom: 14,
}
