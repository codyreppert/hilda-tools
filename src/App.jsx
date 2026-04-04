import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import ExtensionEmailGenerator from './tools/ExtensionEmailGenerator.jsx'
import DocumentReview from './tools/DocumentReview.jsx'
import ClientDocumentDashboard from './tools/ClientDocumentDashboard.jsx'

function Nav() {
  const location = useLocation()

  const tools = [
    { path: '/extension-email', label: 'Extension Notices' },
    { path: '/document-review', label: 'Document Review' },
    { path: '/client-dashboard', label: 'Client Dashboard' },
  ]

  return (
    <nav style={{
      background: '#1a1a2e',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      borderBottom: '1px solid rgba(247,244,239,0.08)',
    }}>
      <Link to="/" style={{
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
    </nav>
  )
}

function Home() {
  return (
    <div style={{ padding: '48px 32px', maxWidth: 600 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#e8a96a', fontFamily: 'sans-serif', marginBottom: 8 }}>
        CPA Workflow Tools
      </div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400, color: '#1a1a2e', marginBottom: 12 }}>
        Welcome, Hilda.
      </h1>
      <p style={{ fontFamily: 'sans-serif', fontSize: 15, color: '#8a8577', lineHeight: 1.7, marginBottom: 32 }}>
        Your AI-powered workflow tools. More coming soon.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ToolCard
          to="/extension-email"
          icon="✉"
          title="Extension Notice Generator"
          desc="Generate personalized extension deadline emails for clients in seconds."
        />
        <ToolCard
          to="/document-review"
          icon="📋"
          title="Document Extraction & Review"
          desc="Upload client PDFs and extract all tax figures into an organized working paper."
        />
        <ToolCard
          to="/client-dashboard"
          icon="📂"
          title="Client Document Dashboard"
          desc="Track document collection status across all clients. AI-powered Drive scanning coming soon."
        />
      </div>
    </div>
  )
}

function ToolCard({ to, icon, title, desc }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'white',
        border: '1px solid #d4cfc6',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4722a'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(196,114,42,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#d4cfc6'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{ fontSize: 28, width: 48, height: 48, background: '#ede9e1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>{title}</div>
          <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#8a8577', lineHeight: 1.5 }}>{desc}</div>
        </div>
        <div style={{ marginLeft: 'auto', color: '#c4722a', fontSize: 18 }}>→</div>
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
