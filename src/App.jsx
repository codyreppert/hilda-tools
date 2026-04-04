import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import ExtensionEmailGenerator from './tools/ExtensionEmailGenerator.jsx'
import DocumentReview from './tools/DocumentReview.jsx'
import ClientDocumentDashboard from './tools/ClientDocumentDashboard.jsx'

function Nav() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const tools = [
    { path: '/extension-email', label: 'Extension Notices' },
    { path: '/document-review', label: 'Document Review' },
    // { path: '/client-dashboard', label: 'Client Dashboard' },
  ]

  function closeMenu() { setMenuOpen(false) }

  return (
    <nav style={{
      background: '#1a1a2e',
      borderBottom: '1px solid rgba(247,244,239,0.08)',
      position: 'relative',
    }}>
      <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <Link to="/" onClick={closeMenu} style={{
          fontFamily: 'Georgia, serif',
          fontSize: 15,
          fontWeight: 600,
          color: '#f7f4ef',
          textDecoration: 'none',
          paddingRight: 28,
          borderRight: '1px solid rgba(247,244,239,0.1)',
          marginRight: 20,
          paddingTop: 16,
          paddingBottom: 16,
          whiteSpace: 'nowrap',
        }}>
          ✦ Hilda Tools
        </Link>

        {/* Desktop nav links */}
        <div className="nav-desktop-links">
          {tools.map(t => (
            <Link
              key={t.path}
              to={t.path}
              style={{
                fontFamily: 'sans-serif',
                fontSize: 13,
                color: location.pathname === t.path ? '#e8a96a' : '#8a8577',
                textDecoration: 'none',
                padding: '16px 14px',
                borderBottom: location.pathname === t.path ? '2px solid #c4722a' : '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          {tools.map(t => (
            <Link
              key={t.path}
              to={t.path}
              onClick={closeMenu}
              style={{
                display: 'block',
                padding: '14px 24px',
                fontFamily: 'sans-serif',
                fontSize: 14,
                color: location.pathname === t.path ? '#e8a96a' : '#c8c3bb',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(247,244,239,0.06)',
                background: location.pathname === t.path ? 'rgba(196,114,42,0.08)' : 'transparent',
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}

function Home() {
  return (
    <div className="home-pad" style={{ padding: '52px 40px', maxWidth: 920 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', marginBottom: 10 }}>
        CPA Workflow Tools
      </div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 400, color: '#1a1a2e', marginBottom: 10 }}>
        Welcome, Hilda.
      </h1>
      <p style={{ fontFamily: 'sans-serif', fontSize: 15, color: '#8a8577', lineHeight: 1.7, marginBottom: 40, maxWidth: 500 }}>
        Your AI-powered tax workflow tools. Select a tool to get started.
      </p>
      <div className="home-tool-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ToolCard
          to="/extension-email"
          number="01"
          icon="✉"
          title="Extension Notice Generator"
          desc="Generate personalized extension follow-up emails in seconds. Select return type, check off missing documents, choose a tone — and it's ready to send."
          bullets={['Personal & business returns', 'Warm, firm, gentle, or urgent tone', 'Auto-logs to Airtable']}
        />
        <ToolCard
          to="/document-review"
          number="02"
          icon="📋"
          title="Document Extraction & Review"
          desc="Upload client PDFs and extract every tax figure into a clean, organized working paper. Flags contribution limit issues and year-over-year variances automatically."
          bullets={['AI-powered PDF extraction', 'Contribution limit checks', 'Export to Google Sheets']}
        />
      </div>
    </div>
  )
}

function ToolCard({ to, number, icon, title, desc, bullets }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', display: 'flex' }}>
      <div style={{
        background: 'white',
        border: '1px solid #d4cfc6',
        borderRadius: 14,
        padding: '28px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        flex: 1,
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.15s',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#c4722a'
          e.currentTarget.style.boxShadow = '0 4px 28px rgba(196,114,42,0.13)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#d4cfc6'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'none'
        }}
      >
        {/* Icon + number */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 34, width: 64, height: 64, background: '#ede9e1', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
          <div style={{ fontFamily: 'sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#c4722a', opacity: 0.55 }}>
            {number}
          </div>
        </div>

        {/* Title + description */}
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600, color: '#1a1a2e', marginBottom: 10, lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577', lineHeight: 1.7 }}>{desc}</div>
        </div>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'sans-serif', fontSize: 12, color: '#6a6560' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c4722a', flexShrink: 0, opacity: 0.7 }} />
              {b}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 6, color: '#c4722a', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600 }}>
          Open tool <span style={{ fontSize: 16 }}>→</span>
        </div>
      </div>
    </Link>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/extension-email" element={<ExtensionEmailGenerator />} />
            <Route path="/document-review" element={<DocumentReview />} />
            <Route path="/client-dashboard" element={<ClientDocumentDashboard />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
