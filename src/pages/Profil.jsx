import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ProfileRepo, AnneeFiscaleRepo } from '../db/repositories/index.js'
import { Alert, HelpTooltip } from '../components/UI.jsx'
import { useRef } from 'react'
import {
  Plus, Trash2, Edit2, Check, X, User,
  ChevronDown, ChevronUp, AlertTriangle, Info
} from 'lucide-react'
import { exporterProfil, telechargerJSON, validerImport, importerDonnees } from '../services/ImportExportService.js'

const eur = v => Math.round(parseFloat(v)||0).toLocaleString('fr-FR') + ' €'
const pct = v => ((parseFloat(v)||0)*100).toFixed(2) + ' %'
const emptyProfile = () => ({ nom:'', situation:'Célibataire', nbParts:1 })

export default function Profil() {
  const { profiles, currentProfile, setCurrentProfile, refreshProfiles,
          currentAnnee, anneesFiscales, refreshAnnees } = useApp()

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(emptyProfile())
  const [editId,   setEditId]   = useState(null)

  const handleSaveProfile = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    const saved = await ProfileRepo.save({
      ...(editId ? {id:editId} : {}),
      nom: form.nom, situation: form.situation, nbParts: parseFloat(form.nbParts)||1,
    })
    await refreshProfiles()
    if (!editId) setCurrentProfile(saved)
    setForm(emptyProfile()); setShowForm(false); setEditId(null)
  }

  const handleEdit   = p => { setForm({...p}); setEditId(p.id); setShowForm(true) }
  const handleDelete = async id => {
    if (profiles.length <= 1) { alert('Impossible de supprimer le dernier profil'); return }
    if (confirm('Supprimer ce profil et toutes ses données ?')) {
      await ProfileRepo.delete(id); await refreshProfiles()
    }
  }

  const handleSaveBareme = async (af, bareme) => {
    await AnneeFiscaleRepo.save({ ...af, bareme: { ...bareme, estEstime: false } })
    await refreshAnnees()
  }

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Profils & Années</h2>
        <p className="page-subtitle">Gérez vos profils et les paramètres fiscaux par année</p>
      </div>
      <div className="page-body">

        {/* ── Profils ────────────────────────────────────── */}
        {showForm && (
          <div className="card">
            <div className="card-title">{editId?<Edit2 size={16}/>:<Plus size={16}/>} {editId?'Modifier':'Nouveau'} profil</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nom complet <span className="form-label-required"/></label>
                <input type="text" className="form-input" placeholder="Dupont Jean"
                  value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Situation familiale</label>
                <select className="form-select" value={form.situation} onChange={e=>setForm(f=>({...f,situation:e.target.value}))}>
                  {['Célibataire','Marié(e)','Pacsé(e)','Divorcé(e)','Veuf/Veuve'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Nombre de parts
                  <HelpTooltip text="1 = célibataire · 2 = couple · +0,5 par enfant à charge"/>
                </label>
                <input type="number" step="0.5" min="1" className="form-input" value={form.nbParts}
                  onChange={e=>setForm(f=>({...f,nbParts:e.target.value}))}/>
                <span className="form-hint">Ex : 1 = célibataire · 2 = couple · 2,5 = couple + 1 enfant</span>
              </div>
            </div>
            <div className="btn-group mt-4">
              <button className="btn btn-primary" onClick={handleSaveProfile}><Check size={14}/> Enregistrer</button>
              <button className="btn btn-secondary" onClick={()=>{setShowForm(false);setEditId(null);setForm(emptyProfile())}}><X size={14}/> Annuler</button>
            </div>
          </div>
        )}

        {!showForm && (
          <div className="mb-4">
            <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditId(null);setForm(emptyProfile())}}>
              <Plus size={14}/> Ajouter un profil
            </button>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16, marginBottom:32 }}>
          {profiles.map(p => (
            <div key={p.id} className="card" style={{ marginBottom:0, ...(p.id===currentProfile?.id?{border:'1px solid var(--brand-primary)'}:{}) }}>
              <div className="flex-between" style={{ marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <User size={18} style={{ color: p.id===currentProfile?.id ? 'var(--brand-primary)' : 'var(--text-tertiary)' }}/>
                  <strong>{p.nom}</strong>
                  {p.id===currentProfile?.id && <span className="badge badge-brand">Actif</span>}
                </div>
                <div className="btn-group">
                  <button className="btn btn-ghost btn-sm" onClick={()=>handleEdit(p)}><Edit2 size={13}/></button>
                  <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(p.id)}><Trash2 size={13}/></button>
                </div>
              </div>
              <p className="text-sm text-muted mb-4">{p.situation} · {p.nbParts} part{p.nbParts>1?'s':''}</p>
              {p.id !== currentProfile?.id && (
                <button className="btn btn-secondary w-full" onClick={()=>setCurrentProfile(p)}>Activer ce profil</button>
              )}
            </div>
          ))}
        </div>

        {/* ── Années fiscales ────────────────────────────── */}
        {currentProfile && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Paramètres fiscaux par année</div>
            </div>
            <p className="text-sm text-muted mb-4">
              Chaque année dispose de ses propres barèmes. Cliquez sur une année pour modifier les paramètres, notamment la décote qui change chaque année.
            </p>

            {anneesFiscales.length === 0
              ? <div className="empty-state"><p>Aucune année — créez-en une depuis la sidebar.</p></div>
              : anneesFiscales.map(af => (
                  <AnneeBaremeEditor key={af.id} af={af} isActive={currentAnnee?.id === af.id} onSave={b => handleSaveBareme(af, b)}/>
                ))
            }
          </div>
        )}
      <ImportExportPanel
          currentProfile={currentProfile}
          onImportDone={async () => { await refreshProfiles(); await refreshAnnees() }}
        />
      </div>
    </>
  )
}

// ── Éditeur barème d'une année ────────────────────────────────

function AnneeBaremeEditor({ af, isActive, onSave }) {
  const [open,   setOpen]   = useState(false)
  const [bareme, setBareme] = useState(null)
  const [saved,  setSaved]  = useState(false)

  const startEdit = () => { setBareme(JSON.parse(JSON.stringify(af.bareme))); setOpen(true) }
  const cancel    = () => { setBareme(null); setOpen(false) }

  const handleSave = async () => {
    await onSave(bareme)
    setSaved(true)
    setTimeout(() => { setSaved(false); setOpen(false); setBareme(null) }, 1200)
  }

  const setDecote  = (groupe, field, val) =>
    setBareme(b => ({ ...b, decote: { ...b.decote, [groupe]: { ...b.decote?.[groupe], [field]: parseFloat(val)||0 } } }))
  const setCoeff   = val =>
    setBareme(b => ({ ...b, decote: { ...b.decote, coeff: parseFloat(val)||0 } }))
  const setAbatt   = (field, val) =>
    setBareme(b => ({ ...b, abattementSalaires: { ...b.abattementSalaires, [field]: parseFloat(val)||0 } }))
  const setTranche = (i, field, val) =>
    setBareme(b => { const t=[...b.tranches]; t[i]={...t[i],[field]: field==='taux'?(parseFloat(val)||0)/100:(val===''||val==='Infinity'?Infinity:parseFloat(val)||0)}; return {...b,tranches:t} })

  const b = af.bareme || {}
  const d = b.decote || {}

  return (
    <div style={{ border:'1px solid var(--border-subtle)', borderRadius:'var(--radius)', marginBottom:10, overflow:'hidden', ...(isActive?{borderColor:'var(--brand-primary)'}:{}) }}>

      {/* En-tête */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--bg-hover)', cursor:'pointer' }}
        onClick={() => open ? cancel() : startEdit()}>
        <span style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', color: isActive?'var(--brand-primary)':'var(--text-primary)', minWidth:50 }}>{af.annee}</span>
        <span style={{ flex:1, fontSize:'0.78rem', color:'var(--text-tertiary)' }}>Déclaration {af.anneeDeclaration}</span>
        {isActive  && <span className="badge badge-brand">Active</span>}
        {b.estEstime && <span className="badge badge-warning"><AlertTriangle size={10}/> Estimé</span>}
        <span style={{ color:'var(--text-tertiary)', fontSize:'0.8rem', transform: open?'rotate(180deg)':'none', display:'inline-block', transition:'200ms' }}>▾</span>
      </div>

      {/* Éditeur */}
      {open && bareme && (
        <div style={{ padding:'var(--space-5)', background:'var(--bg-card)', borderTop:'1px solid var(--border-subtle)' }}>

          {b.estEstime && (
            <Alert type="warning" style={{ marginBottom:16 }}>
              Barème estimé d'après {b.anneeReference}. Mettez-le à jour dès la publication de la loi de finances officielle.
            </Alert>
          )}

          {/* ── Section décote ─────────────────────────── */}
          <div style={{ marginBottom:24 }}>
            <div className="section-header">
              <Info size={13}/>
              Décote
              <HelpTooltip text="La décote réduit l'impôt des foyers modestement imposés. Elle s'annule progressivement à mesure que l'impôt brut augmente."/>
            </div>

            <div className="alert alert-info" style={{ marginBottom:16 }}>
              <Info size={14} className="alert-icon"/>
              <div style={{ fontSize:'0.8rem' }}>
                <strong>Formule :</strong> décote = base − (IR brut × coeff), si IR brut &lt; seuil.<br/>
                Ces 3 paramètres changent chaque année avec la loi de finances.
              </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns:'repeat(3, 1fr)', marginBottom:16 }}>

              {/* Coefficient — commun aux deux situations */}
              <div className="form-group" style={{ gridColumn:'span 3', maxWidth:280 }}>
                <label className="form-label">
                  Coefficient de décote (%)
                  <HelpTooltip text="Pourcentage de l'IR brut soustrait de la base. Inchangé à 45,25% depuis de nombreuses années."/>
                </label>
                <input type="number" step="0.01" className="form-input"
                  value={((bareme.decote?.coeff||0)*100).toFixed(2)}
                  onChange={e => setCoeff((parseFloat(e.target.value)||0)/100)}/>
                <span className="form-hint">Valeur en vigueur : 45,25% — modifiez uniquement si la LFI change ce taux</span>
              </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr', gap:20 }}>

              {/* Célibataire */}
              <div style={{ background:'var(--bg-hover)', borderRadius:'var(--radius)', padding:16 }}>
                <div style={{ fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-tertiary)', marginBottom:12 }}>
                  👤 Célibataire / divorcé / veuf
                </div>
                <div className="form-group" style={{ marginBottom:12 }}>
                  <label className="form-label">
                    Seuil de déclenchement (€)
                    <HelpTooltip text="Si l'IR brut dépasse ce montant, la décote ne s'applique plus."/>
                  </label>
                  <input type="number" className="form-input"
                    value={bareme.decote?.celibataire?.seuil||''}
                    onChange={e => setDecote('celibataire','seuil',e.target.value)}/>
                  <span className="form-hint">Revenus 2024 : 1 964 € · Revenus 2025 : 1 982 €</span>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Base forfaitaire (€)
                    <HelpTooltip text="Montant fixe duquel on soustrait (coeff × IR brut). Revu chaque année."/>
                  </label>
                  <input type="number" className="form-input"
                    value={bareme.decote?.celibataire?.base||''}
                    onChange={e => setDecote('celibataire','base',e.target.value)}/>
                  <span className="form-hint">Revenus 2024 : 889 € · Revenus 2025 : 897 €</span>
                </div>
                {/* Prévisualisation */}
                {bareme.decote?.celibataire?.base && bareme.decote?.celibataire?.seuil && (
                  <DecotePreview
                    base={bareme.decote.celibataire.base}
                    seuil={bareme.decote.celibataire.seuil}
                    coeff={bareme.decote?.coeff||0.4525}
                    label="célibataire"
                  />
                )}
              </div>

              {/* Couple */}
              <div style={{ background:'var(--bg-hover)', borderRadius:'var(--radius)', padding:16 }}>
                <div style={{ fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-tertiary)', marginBottom:12 }}>
                  👫 Couple marié ou pacsé
                </div>
                <div className="form-group" style={{ marginBottom:12 }}>
                  <label className="form-label">
                    Seuil de déclenchement (€)
                    <HelpTooltip text="Si l'IR brut du foyer dépasse ce montant, la décote ne s'applique plus."/>
                  </label>
                  <input type="number" className="form-input"
                    value={bareme.decote?.couple?.seuil||''}
                    onChange={e => setDecote('couple','seuil',e.target.value)}/>
                  <span className="form-hint">Revenus 2024 : 3 248 € · Revenus 2025 : 3 277 €</span>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Base forfaitaire (€)
                    <HelpTooltip text="Montant fixe duquel on soustrait (coeff × IR brut) pour un couple."/>
                  </label>
                  <input type="number" className="form-input"
                    value={bareme.decote?.couple?.base||''}
                    onChange={e => setDecote('couple','base',e.target.value)}/>
                  <span className="form-hint">Revenus 2024 : 1 470 € · Revenus 2025 : 1 483 €</span>
                </div>
                {bareme.decote?.couple?.base && bareme.decote?.couple?.seuil && (
                  <DecotePreview
                    base={bareme.decote.couple.base}
                    seuil={bareme.decote.couple.seuil}
                    coeff={bareme.decote?.coeff||0.4525}
                    label="couple"
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── Section abattement salaires ────────────── */}
          <div style={{ marginBottom:24 }}>
            <div className="section-header">Abattement forfaitaire 10% sur salaires</div>
            <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
              <div className="form-group">
                <label className="form-label">Taux (%)<HelpTooltip text="Toujours 10% — prévu par l'article 83 du CGI."/></label>
                <input type="number" step="0.1" className="form-input"
                  value={((bareme.abattementSalaires?.taux||0.10)*100).toFixed(1)}
                  onChange={e => setAbatt('taux',(parseFloat(e.target.value)||0)/100)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Minimum (€)<HelpTooltip text="Revenu 2024 : 504 € — Revenu 2025 : 509 €"/></label>
                <input type="number" className="form-input"
                  value={bareme.abattementSalaires?.min||''}
                  onChange={e => setAbatt('min',e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Maximum (€)<HelpTooltip text="Revenu 2024 : 14 426 € — Revenu 2025 : 14 555 €"/></label>
                <input type="number" className="form-input"
                  value={bareme.abattementSalaires?.max||''}
                  onChange={e => setAbatt('max',e.target.value)}/>
              </div>
            </div>
          </div>

          {/* ── Section autres paramètres ──────────────── */}
          <div style={{ marginBottom:24 }}>
            <div className="section-header">Autres paramètres</div>
            <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
              <div className="form-group">
                <label className="form-label">Taux prélèvements sociaux (%)<HelpTooltip text="17,2% depuis 2018 — inchangé."/></label>
                <input type="number" step="0.1" className="form-input"
                  value={((bareme.tauxPS||0.172)*100).toFixed(1)}
                  onChange={e => setBareme(b => ({...b,tauxPS:(parseFloat(e.target.value)||0)/100}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Plafond déficit foncier (€)<HelpTooltip text="10 700 € par an — + dérogation travaux énergétiques."/></label>
                <input type="number" className="form-input"
                  value={bareme.plafondDeficit||''}
                  onChange={e => setBareme(b => ({...b,plafondDeficit:parseFloat(e.target.value)||0}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Forfait frais gestion (€/local)<HelpTooltip text="20 € par local — ligne 222 de la 2044."/></label>
                <input type="number" className="form-input"
                  value={bareme.forfaitFraisGestion||''}
                  onChange={e => setBareme(b => ({...b,forfaitFraisGestion:parseFloat(e.target.value)||0}))}/>
              </div>
            </div>
          </div>

          {/* ── Tranches IR ────────────────────────────── */}
          <div style={{ marginBottom:20 }}>
            <div className="section-header">Tranches du barème progressif</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>De (€)</th>
                    <th>Jusqu'à (€)</th>
                    <th>Taux (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(bareme.tranches||[]).map((t, i) => (
                    <tr key={i}>
                      <td className="muted">{i===0?'0':((bareme.tranches[i-1]?.jusqu_a||0)+1).toLocaleString('fr-FR')} €</td>
                      <td>
                        {t.jusqu_a === Infinity
                          ? <span className="text-tertiary">Au-delà</span>
                          : <input type="number" className="form-input" style={{width:130}}
                              value={t.jusqu_a||''}
                              onChange={e=>setTranche(i,'jusqu_a',e.target.value)}/>
                        }
                      </td>
                      <td>
                        <input type="number" step="0.5" className="form-input" style={{width:90}}
                          value={((t.taux||0)*100).toFixed(1)}
                          onChange={e=>setTranche(i,'taux',e.target.value)}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleSave}>
              {saved ? <><Check size={14}/> Sauvegardé !</> : <><Check size={14}/> Enregistrer le barème</>}
            </button>
            <button className="btn btn-secondary" onClick={cancel}><X size={14}/> Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Prévisualisation de la décote ────────────────────────────

function DecotePreview({ base, seuil, coeff, label }) {
  const r2 = v => Math.round(v * 100) / 100
  // IR brut de démonstration = seuil × 0.7
  const irEx = Math.round(seuil * 0.7)
  const decote = Math.max(0, r2(base - irEx * coeff))
  const irNet  = r2(irEx - decote)

  return (
    <div style={{ marginTop:12, padding:'8px 12px', background:'var(--brand-subtle)', borderRadius:'var(--radius-sm)', fontSize:'0.72rem', color:'var(--brand-text)' }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>Exemple — {label} :</div>
      <div>IR brut = {irEx.toLocaleString('fr-FR')} €</div>
      <div>Décote = {base.toLocaleString('fr-FR')} − ({irEx.toLocaleString('fr-FR')} × {(coeff*100).toFixed(2)}%) = <strong>{decote.toLocaleString('fr-FR')} €</strong></div>
      <div>IR net = {irNet.toLocaleString('fr-FR')} €</div>
    </div>
  )
}

// ── Panneau Import/Export (ajout en bas de page) ──────────────

export function ImportExportPanel({ currentProfile, onImportDone }) {
  const [phase,       setPhase]      = useState('idle')  // idle | preview | importing | done | error
  const [jsonData,    setJsonData]   = useState(null)
  const [validation,  setValidation] = useState(null)
  const [strategie,   setStrategie]  = useState('replace')
  const [message,     setMessage]    = useState('')
  const [errorMsg,    setErrorMsg]   = useState('')
  const fileRef = useRef(null)

  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const val  = validerImport(data)
      setJsonData(data)
      setValidation(val)
      setPhase('preview')
    } catch (err) {
      setErrorMsg(`Fichier invalide : ${err.message}`)
      setPhase('error')
    }
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!validation?.ok) return
    setPhase('importing')
    try {
      const result = await importerDonnees(jsonData, strategie, strategie==='replace' ? currentProfile?.id : currentProfile?.id)
      setMessage(result.message)
      setPhase('done')
      onImportDone()
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('error')
    }
  }

  const reset = () => { setPhase('idle'); setJsonData(null); setValidation(null); setMessage(''); setErrorMsg('') }

  const handleExport = async () => {
    if (!currentProfile) return
    const { exporterProfil, telechargerJSON } = await import('../services/ImportExportService.js')
    const data = await exporterProfil(currentProfile.id)
    telechargerJSON(data, `fiscapp-${currentProfile.nom.replace(/\s+/g,'-')}-${new Date().getFullYear()}.json`)
  }

  return (
    <div className="card" style={{ marginTop:24 }}>
      <div className="card-header" style={{ marginBottom:16 }}>
        <div className="card-title">Import / Export</div>
      </div>

      {phase === 'idle' && (
        <div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
            <button className="btn btn-primary" onClick={handleExport} disabled={!currentProfile}>
              ↓ Exporter mes données (JSON)
            </button>
            <button className="btn btn-secondary" onClick={()=>fileRef.current?.click()}>
              ↑ Importer un fichier JSON
            </button>
            <input type="file" accept=".json" ref={fileRef} onChange={handleFile} style={{display:'none'}}/>
          </div>
          <p style={{ fontSize:'0.78rem', color:'var(--text-tertiary)', lineHeight:1.5 }}>
            ⚠️ Pour importer, utilisez uniquement un fichier exporté via <strong>"Exporter mes données"</strong> ci-dessus.
            Les fichiers "Résultats (debug)" du Tableau de bord ne sont pas compatibles.
          </p>
        </div>
      )}

      {phase === 'preview' && validation && (
        <div>
          {/* Erreurs bloquantes */}
          {validation.errors.length > 0 && (
            <Alert type="danger" style={{ marginBottom:12 }}>
              <div>
                {validation.errors.map((e,i)=><div key={i}>• {e}</div>)}
              </div>
            </Alert>
          )}
          {/* Avertissements */}
          {validation.warnings.length > 0 && (
            <Alert type="warning" style={{ marginBottom:12 }}>
              <div>
                {validation.warnings.map((w,i)=><div key={i}>• {w}</div>)}
              </div>
            </Alert>
          )}

          {/* Preview */}
          {validation.ok && validation.preview && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:600, fontSize:'0.875rem', marginBottom:8 }}>
                Aperçu : {validation.preview.profileNom}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {validation.preview.annees.map((a,i) => (
                  <div key={i} style={{ display:'flex', gap:12, padding:'8px 12px', background:'var(--bg-hover)', borderRadius:'var(--radius-sm)', fontSize:'0.82rem' }}>
                    <span style={{ fontFamily:'var(--font-display)', minWidth:50, color:'var(--brand-primary)' }}>{a.annee}</span>
                    <span style={{ color:'var(--text-muted)' }}>{a.nbBiens} bien{a.nbBiens>1?'s':''}</span>
                    <span style={{ color:'var(--text-muted)' }}>{a.nbTx} transaction{a.nbTx>1?'s':''}</span>
                    {a.nbSalaires>0 && <span style={{ color:'var(--text-muted)' }}>{a.nbSalaires} salaire{a.nbSalaires>1?'s':''}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stratégie */}
          {validation.ok && currentProfile && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase', marginBottom:8 }}>Stratégie d'import</div>
              <div style={{ display:'flex', gap:10 }}>
                {[
                  { val:'replace', label:'Remplacer', hint:'Efface les données existantes et recrée tout depuis le fichier' },
                  { val:'merge',   label:'Fusionner', hint:'Ajoute uniquement les années absentes — ne touche pas aux données existantes' },
                ].map(opt => (
                  <label key={opt.val} style={{
                    flex:1, padding:'10px 14px', borderRadius:'var(--radius)',
                    border: strategie===opt.val ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                    background: strategie===opt.val ? 'var(--brand-subtle)' : 'var(--bg-input)',
                    cursor:'pointer', display:'flex', flexDirection:'column', gap:3,
                  }}>
                    <input type="radio" value={opt.val} checked={strategie===opt.val} onChange={()=>setStrategie(opt.val)} style={{display:'none'}}/>
                    <span style={{ fontWeight:500, fontSize:'0.85rem', color:strategie===opt.val?'var(--brand-primary)':'var(--text-primary)' }}>{opt.label}</span>
                    <span style={{ fontSize:'0.72rem', color:'var(--text-tertiary)' }}>{opt.hint}</span>
                  </label>
                ))}
              </div>
              {strategie === 'replace' && (
                <Alert type="warning" style={{ marginTop:10 }}>
                  ⚠️ Le remplacement est irréversible. Toutes les données actuelles seront effacées.
                </Alert>
              )}
            </div>
          )}

          <div className="btn-group">
            {validation.ok && (
              <button className="btn btn-primary" onClick={handleImport}>
                <Check size={14}/> Importer
              </button>
            )}
            <button className="btn btn-secondary" onClick={reset}><X size={14}/> Annuler</button>
          </div>
        </div>
      )}

      {phase === 'importing' && (
        <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Import en cours…</div>
      )}

      {phase === 'done' && (
        <div>
          <Alert type="success">{message}</Alert>
          <button className="btn btn-secondary btn-sm mt-4" onClick={reset}>Fermer</button>
        </div>
      )}

      {phase === 'error' && (
        <div>
          <Alert type="danger">{errorMsg}</Alert>
          <button className="btn btn-secondary btn-sm mt-4" onClick={reset}>Réessayer</button>
        </div>
      )}
    </div>
  )
}
