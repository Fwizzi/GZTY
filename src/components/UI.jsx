// ============================================================
// COMPOSANTS UI — FiscApp Design System v3
// ============================================================

import { useState } from 'react'
import { Info, AlertTriangle, CheckCircle, XCircle, HelpCircle, X } from 'lucide-react'

// ── Alert ─────────────────────────────────────────────────────

export function Alert({ type = 'info', title, children, dismissible, onDismiss }) {
  const icons = { info: Info, warning: AlertTriangle, success: CheckCircle, danger: XCircle }
  const Icon = icons[type] || Info
  return (
    <div className={`alert alert-${type}`} role="alert">
      <Icon size={16} className="alert-icon"/>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>}
        {children}
      </div>
      {dismissible && (
        <button onClick={onDismiss} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', opacity:0.7, padding:2 }}>
          <X size={14}/>
        </button>
      )}
    </div>
  )
}

// ── Tooltip / Aide contextuelle ───────────────────────────────

export function HelpTooltip({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position:'relative', display:'inline-flex' }}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{ background:'none', border:'none', cursor:'help', color:'var(--text-tertiary)', padding:0, display:'flex', alignItems:'center' }}>
        <HelpCircle size={13}/>
      </button>
      {open && (
        <span style={{
          position:'absolute', bottom:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)',
          background: 'var(--neutral-900)', color:'var(--neutral-100)',
          padding:'6px 10px', borderRadius:'var(--radius-sm)', fontSize:'0.72rem',
          whiteSpace:'nowrap', maxWidth:240, lineHeight:1.4, zIndex:200,
          boxShadow:'var(--shadow-lg)', pointerEvents:'none',
        }}>
          {text}
          <span style={{
            position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)',
            border:'4px solid transparent', borderTopColor:'var(--neutral-900)',
          }}/>
        </span>
      )}
    </span>
  )
}

// ── FormField — wrapper avec label, hint, error ───────────────

export function FormField({ label, required, caseRef, hint, error, children, help }) {
  return (
    <div className="form-group">
      <label className="form-label">
        <span className={required ? 'form-label-required' : ''}>{label}</span>
        {caseRef && <span className="case-ref">{caseRef}</span>}
        {help && <HelpTooltip text={help}/>}
      </label>
      {children}
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error"><XCircle size={12}/> {error}</span>}
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────────────────

export function SectionHeader({ icon, title, action }) {
  return (
    <div className="flex-between mb-4">
      <div className="section-header" style={{ marginBottom:0 }}>
        {icon && <span>{icon}</span>}
        {title}
      </div>
      {action}
    </div>
  )
}

// ── Stat / KPI card inline ────────────────────────────────────

export function StatRow({ label, value, color, sub }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
      <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{label}</span>
      <div style={{ textAlign:'right' }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.9rem', fontWeight:600, color: color || 'var(--text-primary)' }}>{value}</span>
        {sub && <div style={{ fontSize:'0.68rem', color:'var(--text-tertiary)' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Progress steps ────────────────────────────────────────────

export function ProgressSteps({ steps }) {
  const done = steps.filter(s => s.done).length
  const pct  = Math.round((done / steps.length) * 100)
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-tertiary)', marginBottom: 6 }}>
        <span>{done} / {steps.length} sections remplies</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-bar" style={{ marginBottom:10 }}>
        <div className="progress-bar-fill" style={{ width:`${pct}%`, ...(pct === 100 ? { background:'var(--success-text)' } : {}) }}/>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.8rem', color: step.done ? 'var(--success-text)' : 'var(--text-tertiary)' }}>
            {step.done
              ? <CheckCircle size={13}/>
              : <div style={{ width:13, height:13, borderRadius:'50%', border:'1.5px solid var(--border)', flexShrink:0 }}/>
            }
            {step.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── RadioGroup ────────────────────────────────────────────────

export function RadioGroup({ options, value, onChange, name }) {
  return (
    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
      {options.map(opt => (
        <label key={opt.value} style={{
          flex:1, minWidth:160, padding:'12px 14px',
          borderRadius:'var(--radius)', cursor:'pointer',
          border: value === opt.value ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
          background: value === opt.value ? 'var(--brand-subtle)' : 'var(--bg-input)',
          transition:'all var(--duration-fast)',
          display:'flex', flexDirection:'column', gap:3,
        }}>
          <input type="radio" name={name} value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value)} style={{ display:'none' }}/>
          <span style={{ fontWeight:500, fontSize:'0.875rem', color: value === opt.value ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
            {opt.label}
          </span>
          {opt.hint && <span style={{ fontSize:'0.72rem', color:'var(--text-tertiary)' }}>{opt.hint}</span>}
        </label>
      ))}
    </div>
  )
}

// ── Modal / Popup ─────────────────────────────────────────────

export function Modal({ title, children, onClose, width = 420 }) {
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center',
      padding:'var(--space-4)', backdropFilter:'blur(3px)',
    }} onClick={onClose}>
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)', padding:'var(--space-6)',
        width:'100%', maxWidth:width, boxShadow:'var(--shadow-xl)',
        maxHeight:'90vh', overflowY:'auto',
      }} onClick={e => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom:'var(--space-5)' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.15rem', color:'var(--text-primary)' }}>{title}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Accordion ─────────────────────────────────────────────────

export function Accordion({ title, subtitle, children, defaultOpen = false, action }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', marginBottom:'var(--space-4)', overflow:'hidden' }}>
      <div
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'var(--space-4) var(--space-5)', cursor:'pointer', background:'var(--bg-card)', userSelect:'none' }}
        onClick={() => setOpen(v => !v)}>
        <div>
          <div style={{ fontWeight:500, fontSize:'0.9rem', color:'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize:'0.75rem', color:'var(--text-tertiary)', marginTop:2 }}>{subtitle}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
          {action}
          <span style={{ color:'var(--text-tertiary)', fontSize:'0.9rem', transition:'transform 200ms', transform: open ? 'rotate(180deg)' : 'none', display:'inline-block' }}>▾</span>
        </div>
      </div>
      {open && (
        <div style={{ padding:'var(--space-5)', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-card)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Amount display ────────────────────────────────────────────

export function Amount({ value, size = 'md', color }) {
  const n = Math.round(parseFloat(value) || 0)
  const formatted = n.toLocaleString('fr-FR') + ' €'
  const sizes = { sm:'0.82rem', md:'1rem', lg:'1.25rem', xl:'1.6rem' }
  const autoColor = !color ? (n > 0 ? 'var(--success-text)' : n < 0 ? 'var(--danger-text)' : 'var(--text-primary)') : color
  return (
    <span style={{ fontFamily:'var(--font-mono)', fontSize:sizes[size], fontWeight:600, color: autoColor }}>
      {formatted}
    </span>
  )
}
