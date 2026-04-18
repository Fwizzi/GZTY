import { useState } from 'react'

const eur = v => {
  const n = Math.round(parseFloat(v) || 0)
  return n.toLocaleString('fr-FR') + ' €'
}

/**
 * Composant case fiscale — reproduit visuellement une case de formulaire DGFiP.
 * Clic → copie la valeur dans le presse-papier.
 */
export function CaseFiscale({ code, label, value, source, color, hint }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(String(Math.round(parseFloat(value) || 0)))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const colorClass = color || (
    parseFloat(value) > 0 ? '' :
    parseFloat(value) < 0 ? 'negative' : ''
  )

  return (
    <div className="case-fiscale" onClick={handleCopy} title={hint || `Cliquer pour copier la valeur de la case ${code}`}>
      <span className="case-fiscale-code">{code}</span>
      <span className="case-fiscale-label">{label}</span>
      <span className="case-fiscale-dots"/>
      {source && <span className="case-source">{source}</span>}
      <span className={`case-fiscale-montant ${colorClass}`}>{eur(value)}</span>
      <button
        className={`case-fiscale-copy ${copied ? 'copied' : ''}`}
        onClick={e => { e.stopPropagation(); handleCopy() }}>
        {copied ? '✓ Copié' : 'Copier'}
      </button>
    </div>
  )
}

/**
 * Cadre thématique d'un formulaire fiscal (ex: "Traitements et salaires")
 */
export function CadreFiscal({ titre, icone, children }) {
  return (
    <div className="cadre-fiscal">
      <div className="cadre-fiscal-header">
        {icone && <span>{icone}</span>}
        {titre}
      </div>
      {children}
    </div>
  )
}

/**
 * En-tête du formulaire fiscal (ex: "2042")
 */
export function FormulaireFiscal({ numero, titre, sousTitre, children }) {
  return (
    <div className="form-fiscal">
      <div className="form-fiscal-header">
        <div className="form-fiscal-numero">{numero}</div>
        <div>
          <div className="form-fiscal-titre">{titre}</div>
          {sousTitre && <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', marginTop:2 }}>{sousTitre}</div>}
        </div>
      </div>
      <div className="form-fiscal-body">
        {children}
      </div>
    </div>
  )
}
