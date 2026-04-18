import { useState } from 'react'
import { useApp } from './context/AppContext'
import { useTheme } from './hooks/useTheme.js'
import { Modal } from './components/UI.jsx'
import Dashboard    from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Salaires     from './pages/Salaires'
import Biens        from './pages/Biens'
import Copropriete  from './pages/Copropriete'
import SCPI         from './pages/SCPI'
import Declaration  from './pages/Declaration'
import Profil       from './pages/Profil'
import {
  LayoutDashboard, ListOrdered, Briefcase, Home,
  Building2, TrendingUp, FileText, User,
  Menu, ChevronRight, Plus, Sun, Moon, Calendar, Check, X
} from 'lucide-react'

const NAV = [
  { id:'dashboard',    label:'Tableau de bord',    icon:LayoutDashboard, section:'Aperçu' },
  { id:'declaration',  label:'Déclaration prête',  icon:FileText,        section:'Aperçu' },
  { id:'salaires',     label:'Revenus salariaux',   icon:Briefcase,       section:'Saisie' },
  { id:'transactions', label:'Loyers & charges',   icon:ListOrdered,     section:'Saisie' },
  { id:'copropriete',  label:'Copropriété',         icon:Building2,       section:'Saisie' },
  { id:'scpi',         label:'SCPI',                icon:TrendingUp,      section:'Saisie' },
  { id:'biens',        label:'Biens immobiliers',   icon:Home,            section:'Paramètres' },
  { id:'profil',       label:'Profils & années',    icon:User,            section:'Paramètres' },
]

const PAGES = {
  dashboard: Dashboard, transactions: Transactions, salaires: Salaires,
  biens: Biens, copropriete: Copropriete, scpi: SCPI,
  declaration: Declaration, profil: Profil,
}

// ── Popup nouvelle année ──────────────────────────────────────
function PopupNouvelleAnnee({ anneeSource, anneesExistantes, onConfirm, onClose }) {
  const [annee, setAnnee] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    const n = parseInt(annee)
    if (!n || isNaN(n) || String(n).length !== 4) { setError('Entrez une année au format AAAA (ex : 2027)'); return }
    if (n < 2020 || n > 2099) { setError('Année hors plage (2020 – 2099)'); return }
    if (anneesExistantes.includes(n)) { setError(`L'année ${n} existe déjà`); return }
    onConfirm(n)
  }

  return (
    <Modal title="Nouvelle année fiscale" onClose={onClose} width={380}>
      <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:'var(--space-5)', lineHeight:1.6 }}>
        {anneeSource
          ? `La structure de l'année ${anneeSource} sera copiée (biens, prêts, format copropriété). Les données seront vides.`
          : 'Une nouvelle année vierge sera créée.'}
      </p>
      <div className="form-group" style={{ marginBottom: error ? 'var(--space-2)' : 'var(--space-5)' }}>
        <label className="form-label">Année fiscale</label>
        <input
          type="number" className="form-input"
          placeholder="ex : 2027" value={annee}
          onChange={e => { setAnnee(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          autoFocus min="2020" max="2099"
          style={{ fontSize:'1.3rem', textAlign:'center', letterSpacing:'0.15em', fontFamily:'var(--font-display)' }}
        />
      </div>
      {error && <p style={{ fontSize:'0.78rem', color:'var(--danger-text)', marginBottom:'var(--space-4)' }}>⚠️ {error}</p>}
      <div className="btn-group btn-group-right">
        <button className="btn btn-secondary" onClick={onClose}><X size={14}/> Annuler</button>
        <button className="btn btn-primary" onClick={handleConfirm}><Check size={14}/> Créer {annee || '…'}</button>
      </div>
    </Modal>
  )
}

// ── Écran de bienvenue ────────────────────────────────────────
function WelcomeScreen({ onStart }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', padding:'var(--space-6)' }}>
      <div style={{ maxWidth:480, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:'var(--space-8)' }}>
          <div style={{ width:56, height:56, background:'var(--brand-primary)', borderRadius:'var(--radius-lg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto var(--space-4)', fontSize:'1.5rem', fontFamily:'var(--font-display)', color:'white' }}>F</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--text-primary)', marginBottom:'var(--space-2)' }}>FiscApp</div>
          <div style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>Votre assistant pour la déclaration d'impôt française</div>
        </div>

        <div className="card" style={{ marginBottom:'var(--space-4)' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.15rem', color:'var(--text-primary)', marginBottom:'var(--space-5)' }}>
            Préparez votre déclaration en toute sérénité
          </div>
          {[
            { icon:'🏠', title:'Revenus fonciers', text:'Loyers, charges, copropriété — régime réel' },
            { icon:'💼', title:'Revenus salariaux', text:'Net imposable, frais réels, prélèvement à la source' },
            { icon:'📊', title:'SCPI',              text:'Revenus de parts immobilières' },
            { icon:'📋', title:'Déclaration prête', text:'Cases 2042 et 2044 calculées automatiquement' },
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:'var(--space-3)', marginBottom:'var(--space-4)', alignItems:'flex-start' }}>
              <span style={{ fontSize:'1.3rem', flexShrink:0, marginTop:1 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight:500, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:1 }}>{item.title}</div>
                <div style={{ fontSize:'0.78rem', color:'var(--text-tertiary)' }}>{item.text}</div>
              </div>
            </div>
          ))}
          <button className="btn btn-primary w-full" style={{ marginTop:'var(--space-2)', padding:'11px' }} onClick={onStart}>
            Commencer ma déclaration <ArrowRight size={16}/>
          </button>
        </div>

        <p style={{ fontSize:'0.72rem', color:'var(--text-tertiary)', textAlign:'center' }}>
          🔒 Vos données restent sur votre appareil — rien n'est envoyé sur internet
        </p>
      </div>
    </div>
  )
}

function ArrowRight({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
}

// ── App principale ────────────────────────────────────────────
export default function App() {
  const [page,        setPage]        = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showPopup,   setShowPopup]   = useState(false)
  const { theme, toggle: toggleTheme, isDark } = useTheme()

  const {
    currentProfile, loading,
    anneesFiscales, currentAnnee, setCurrentAnnee,
    dupliquerAnnee,
  } = useApp()

  const navigate = id => { setPage(id); setSidebarOpen(false) }
  const PageComponent = PAGES[page] || Dashboard
  const sections = [...new Set(NAV.map(n => n.section))]
  const anneesExistantes = anneesFiscales.map(af => af.annee)

  const handleCreerAnnee = async (anneeTarget) => {
    setShowPopup(false)
    await dupliquerAnnee(anneeTarget)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:'var(--space-4)' }}>
      <div style={{ width:36, height:36, background:'var(--brand-primary)', borderRadius:'var(--radius)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontFamily:'var(--font-display)', fontSize:'1.1rem' }}>F</div>
      <div style={{ color:'var(--text-tertiary)', fontSize:'0.875rem' }}>Chargement…</div>
    </div>
  )

  if (!currentProfile && page !== 'profil') {
    return <WelcomeScreen onStart={() => navigate('profil')}/>
  }

  return (
    <div className="app-shell">
      {showPopup && (
        <PopupNouvelleAnnee
          anneeSource={currentAnnee?.annee || null}
          anneesExistantes={anneesExistantes}
          onConfirm={handleCreerAnnee}
          onClose={() => setShowPopup(false)}
        />
      )}

      <button className="menu-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
        <Menu size={20}/>
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}/>

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">F</div>
          <div>
            <h1>FiscApp</h1>
          </div>
        </div>

        {/* Profil */}
        {currentProfile && (
          <div style={{ padding:'var(--space-3) var(--space-4)', borderBottom:'1px solid var(--border-subtle)', cursor:'pointer', display:'flex', alignItems:'center', gap:'var(--space-3)' }}
            onClick={() => navigate('profil')}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--brand-subtle)', border:'1px solid var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.82rem', color:'var(--brand-primary)', fontFamily:'var(--font-display)', flexShrink:0, fontWeight:600 }}>
              {currentProfile.nom?.charAt(0) || 'U'}
            </div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <div style={{ fontSize:'0.82rem', color:'var(--text-primary)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{currentProfile.nom}</div>
              <div style={{ fontSize:'0.65rem', color:'var(--text-tertiary)' }}>{currentProfile.situation || 'Contribuable'}</div>
            </div>
            <ChevronRight size={13} style={{ color:'var(--text-tertiary)', flexShrink:0 }}/>
          </div>
        )}

        {/* Années fiscales */}
        {currentProfile && (
          <div style={{ padding:'var(--space-3) var(--space-4)', borderBottom:'1px solid var(--border-subtle)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'var(--space-2)' }}>
                <Calendar size={11} style={{ color:'var(--text-tertiary)' }}/>
                <span style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--text-tertiary)', fontWeight:600 }}>Année fiscale</span>
              </div>
              <button
                onClick={() => setShowPopup(true)}
                title="Ajouter une année"
                style={{
                  width:20, height:20, borderRadius:'50%',
                  background:'var(--success-600)', border:'none',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', flexShrink:0,
                }}
              >
                <Plus size={12} color="white" strokeWidth={2.5}/>
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {anneesFiscales.length === 0 ? (
                <p style={{ fontSize:'0.75rem', color:'var(--text-tertiary)', padding:'var(--space-2) 0' }}>
                  Cliquez sur <span style={{ color:'var(--success-text)', fontWeight:600 }}>+</span> pour créer votre première année
                </p>
              ) : anneesFiscales.map(af => (
                <button key={af.id} className={`year-pill ${currentAnnee?.id === af.id ? 'active' : ''}`}
                  onClick={() => setCurrentAnnee(af)}>
                  <span className="year-pill-num">{af.annee}</span>
                  <span className="year-pill-sub">→ {af.anneeDeclaration}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ flex:1, padding:'var(--space-2) var(--space-3)', overflowY:'auto' }}>
          {sections.map(section => (
            <div key={section} className="sidebar-section">
              <div className="sidebar-section-label">{section}</div>
              {NAV.filter(n => n.section === section).map(item => {
                const Icon = item.icon
                return (
                  <div key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
                    <Icon size={15} className="nav-item-icon"/>
                    {item.label}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} style={{ marginBottom:'var(--space-3)' }}>
            {isDark ? <Sun size={13}/> : <Moon size={13}/>}
            {isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          </button>
          <div>v2.12.8 · Données locales · Hors ligne</div>
        </div>
      </aside>

      {/* ── Contenu ─────────────────────────────────────────── */}
      <main className="main-content">
        {currentAnnee && (
          <div className="year-banner">
            <Calendar size={12} style={{ color:'var(--brand-primary)' }}/>
            <span className="year-banner-label">Année fiscale active :</span>
            <span className="year-banner-value">{currentAnnee.annee}</span>
            <span className="year-banner-hint">→ déclaration à déposer en {currentAnnee.anneeDeclaration}</span>
            <span style={{ marginLeft:'auto' }}>
              <span className={`badge ${currentAnnee.statut === 'complete' ? 'badge-success' : currentAnnee.statut === 'archivee' ? 'badge-neutral' : 'badge-warning'}`}>
                {currentAnnee.statut}
              </span>
            </span>
          </div>
        )}
        <PageComponent/>
      </main>
    </div>
  )
}
