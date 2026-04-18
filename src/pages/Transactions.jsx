import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAnnee } from '../hooks/useAnnee'
import { TransactionRepo, CATEGORIES_TX } from '../db/repositories/index.js'
import {
  genererOccurrences, regrouperTransactions,
  resumeGroupe, MOIS, TRIMESTRES,
} from '../services/RecurrenceService.js'
import {
  grouperParCategorie, trierTransactions,
  filtrerParCategories, GROUPES_CATEGORIE, groupeDeCategorie,
} from '../services/CategorieService.js'
import { Alert, HelpTooltip } from '../components/UI.jsx'
import {
  Plus, Trash2, Edit2, Check, X, RefreshCw,
  Layers, Repeat, Calendar, Filter,
} from 'lucide-react'

const eur = v => (parseFloat(v)||0).toLocaleString('fr-FR', { minimumFractionDigits:2 }) + ' €'
const isoToday = () => new Date().toISOString().split('T')[0]
const emptyForm = () => ({
  bienAnneeId:'', date:isoToday(), titre:'', montant:'', categorie:'loyer', notes:'',
  recurrent:false, recurrenceType:'mensuel',
})
const COULEUR_MAP = {
  success: { bg:'var(--success-bg)',  text:'var(--success-text)',  border:'rgba(22,163,74,0.2)'  },
  brand:   { bg:'var(--brand-subtle)',text:'var(--brand-primary)', border:'var(--brand-200)'      },
  warning: { bg:'var(--warning-bg)',  text:'var(--warning-text)',  border:'rgba(217,119,6,0.2)'  },
  danger:  { bg:'var(--danger-bg)',   text:'var(--danger-text)',   border:'rgba(220,38,38,0.2)'  },
  neutral: { bg:'var(--bg-hover)',    text:'var(--text-secondary)',border:'var(--border)'         },
}

export default function Transactions() {
  const { currentProfile, currentAnnee } = useApp()
  const { data, loading, refresh } = useAnnee(currentProfile?.id, currentAnnee?.id)

  // ── Tous les hooks AVANT les gardes ──────────────────────
  const [showForm,     setShowForm]     = useState(false)
  const [form,         setForm]         = useState(emptyForm())
  const [editId,       setEditId]       = useState(null)
  const [filterBien,   setFilterBien]   = useState('')
  const [feedback,     setFeedback]     = useState(null)
  const [viewMode,     setViewMode]     = useState('groupe')
  const [sortCritere,  setSortCritere]  = useState('date_asc')
  const [activeCats,   setActiveCats]   = useState(new Set())
  const [expandedGrps, setExpandedGrps] = useState(new Set())
  const [collapsedSec, setCollapsedSec] = useState(new Set())

  const resumeBiens = data?.resumeBiens || []
  const annee       = currentAnnee?.annee || new Date().getFullYear()

  // Pipeline de données — toujours calculé (hooks ne peuvent pas être conditionnels)
  const allTx = useMemo(() =>
    resumeBiens.flatMap(b => b.transactions.map(t => ({ ...t, _bien:b.bien, _bienAnnee:b.bienAnnee })))
  , [resumeBiens])

  const parBien = useMemo(() =>
    filterBien ? allTx.filter(t => t.bienAnneeId === filterBien) : allTx
  , [allTx, filterBien])

  const triees = useMemo(() =>
    trierTransactions(filtrerParCategories(parBien, activeCats), sortCritere)
  , [parBien, activeCats, sortCritere])

  const { grouped: groupesRecurrence } = useMemo(() => regrouperTransactions(triees), [triees])
  const groupesCat = useMemo(() => grouperParCategorie(triees), [triees])

  const countParCat = useMemo(() => {
    const map = {}
    parBien.forEach(t => { map[t.categorie] = (map[t.categorie]||0)+1 })
    return map
  }, [parBien])

  const totalRecettes = useMemo(() => parBien.filter(t=>t.sens==='recette').reduce((s,t)=>s+(t.montant||0),0), [parBien])
  const totalCharges  = useMemo(() => parBien.filter(t=>t.sens==='charge' ).reduce((s,t)=>s+(t.montant||0),0), [parBien])

  // ── Gardes après tous les hooks ──────────────────────────
  if (!currentAnnee) return (
    <div className="page-body"><div className="empty-state"><h3>Sélectionnez une année fiscale</h3></div></div>
  )
  if (loading) return (
    <div className="page-body"><div className="empty-state"><p>Chargement…</p></div></div>
  )

  // ── Handlers ─────────────────────────────────────────────
  const flash  = (type, msg) => { setFeedback({type,msg}); setTimeout(()=>setFeedback(null),3000) }
  const sensFor = cat => CATEGORIES_TX[cat]?.sens || 'charge'

  const saveTx = async (extraFields={}) => {
    if (!form.bienAnneeId || !form.titre || !form.montant) {
      flash('danger','Bien, titre et montant sont obligatoires.'); return false
    }
    await TransactionRepo.save({
      ...(editId ? {id:editId} : {}),
      bienAnneeId:form.bienAnneeId, date:form.date, titre:form.titre,
      montant:Math.abs(parseFloat(form.montant)||0),
      sens:CATEGORIES_TX[form.categorie]?.sens||'charge',
      categorie:form.categorie, notes:form.notes,
      groupeId:null, groupeType:null, groupeIndex:null, groupeTitre:null,
      ...extraFields,
    })
    return true
  }

  const handleSave = async () => {
    if (form.recurrent && !editId) {
      if (!form.bienAnneeId || !form.titre || !form.montant) { flash('danger','Bien, titre et montant obligatoires.'); return }
      const occs = genererOccurrences({
        bienAnneeId:form.bienAnneeId, groupeTitre:form.titre,
        montant:parseFloat(form.montant), sens:sensFor(form.categorie),
        categorie:form.categorie, type:form.recurrenceType, annee, notes:form.notes,
      })
      for (const o of occs) await TransactionRepo.save(o)
      await refresh(); resetForm()
      flash('success',`${occs.length} occurrences créées pour "${form.titre}".`)
    } else {
      if (!await saveTx()) return
      await refresh(); resetForm()
      flash('success', editId ? 'Transaction modifiée.' : 'Transaction ajoutée.')
    }
  }

  const handleDelete = async id => {
    if (!confirm('Supprimer ?')) return
    await TransactionRepo.delete(id); await refresh()
    flash('success','Supprimé.')
  }

  const handleDeleteGroupe = async (groupeId, titre) => {
    const ids = (groupesRecurrence.get(groupeId)||[]).map(t=>t.id)
    if (!confirm(`Supprimer les ${ids.length} occurrences de "${titre}" ?`)) return
    for (const id of ids) await TransactionRepo.delete(id)
    await refresh(); flash('success',`${ids.length} occurrences supprimées.`)
  }

  const handleUpdateGroupe = async (groupeId, updates) => {
    const txs = groupesRecurrence.get(groupeId)||[]
    for (const tx of txs) await TransactionRepo.save({...tx,...updates})
    await refresh(); flash('success',`${txs.length} occurrences mises à jour.`)
  }

  const handleEdit = tx => {
    setForm({ bienAnneeId:tx.bienAnneeId, date:tx.date||isoToday(), titre:tx.titre||'',
              montant:String(tx.montant), categorie:tx.categorie, notes:tx.notes||'',
              recurrent:false, recurrenceType:'mensuel' })
    setEditId(tx.id); setShowForm(true)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const resetForm = () => { setForm(emptyForm()); setShowForm(false); setEditId(null) }

  const toggleCat = cat => setActiveCats(p => { const n=new Set(p); n.has(cat)?n.delete(cat):n.add(cat); return n })
  const toggleGrp = id  => setExpandedGrps(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleSec = id  => setCollapsedSec(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })

  const sharedGroupProps = {
    groupesRec:groupesRecurrence, expandedGrps,
    onToggleGrp:toggleGrp, onEdit:handleEdit, onDelete:handleDelete,
    onDeleteGroupe:handleDeleteGroupe, onUpdateGroupe:handleUpdateGroupe,
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h2 className="page-title">Loyers & charges</h2>
            <p className="page-subtitle">Année {annee}</p>
          </div>
          <select className="form-select" style={{width:'auto'}} value={filterBien}
            onChange={e=>setFilterBien(e.target.value)}>
            <option value="">Tous les biens</option>
            {resumeBiens.map(b=>(
              <option key={b.bienAnnee.id} value={b.bienAnnee.id}>{b.bien.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="page-body">

        {feedback && (
          <Alert type={feedback.type} dismissible onDismiss={()=>setFeedback(null)}>
            {feedback.msg}
          </Alert>
        )}

        {/* KPIs */}
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div className="kpi-card">
            <div className="kpi-label">Recettes</div>
            <div className="kpi-value positive">{eur(totalRecettes)}</div>
            <div className="kpi-sub">{parBien.filter(t=>t.sens==='recette').length} transactions</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Charges</div>
            <div className="kpi-value negative">{eur(totalCharges)}</div>
            <div className="kpi-sub">{parBien.filter(t=>t.sens==='charge').length} transactions</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Résultat brut</div>
            <div className={`kpi-value ${totalRecettes-totalCharges>=0?'positive':'negative'}`}>
              {eur(totalRecettes-totalCharges)}
            </div>
            <div className="kpi-sub">Avant intérêts d'emprunt</div>
          </div>
        </div>

        {/* Formulaire */}
        {showForm && (
          <FormulaireTransaction
            form={form} setForm={setForm} editId={editId}
            resumeBiens={resumeBiens} annee={annee}
            sensFor={sensFor} onSave={handleSave} onCancel={resetForm}
          />
        )}
        {!showForm && (
          <div className="mb-4">
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}>
              <Plus size={14}/> Ajouter une transaction
            </button>
          </div>
        )}

        {/* Barre contrôles */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            {[
              {id:'groupe', label:'Par catégorie', icon:'⊞'},
              {id:'chrono', label:'Chronologique', icon:'↕'},
            ].map(opt=>(
              <button key={opt.id} onClick={()=>setViewMode(opt.id)} style={{
                display:'flex',alignItems:'center',gap:5,padding:'6px 12px',
                border:'none',cursor:'pointer',fontSize:'0.78rem',fontFamily:'var(--font-body)',
                background:viewMode===opt.id?'var(--brand-primary)':'transparent',
                color:viewMode===opt.id?'white':'var(--text-secondary)',transition:'all 150ms',
              }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>

          {viewMode==='chrono' && (
            <select className="form-select" style={{width:'auto',fontSize:'0.8rem',padding:'6px 10px'}}
              value={sortCritere} onChange={e=>setSortCritere(e.target.value)}>
              <option value="date_asc">Date ↑</option>
              <option value="date_desc">Date ↓</option>
              <option value="montant_desc">Montant ↓</option>
              <option value="montant_asc">Montant ↑</option>
              <option value="categorie">Catégorie A→Z</option>
            </select>
          )}

          {activeCats.size > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:'0.75rem',color:'var(--text-tertiary)'}}>
                <Filter size={12} style={{marginRight:4,verticalAlign:'middle'}}/>
                {triees.length} / {parBien.length} transactions
              </span>
              <button className="btn btn-ghost btn-sm" style={{fontSize:'0.72rem'}}
                onClick={()=>setActiveCats(new Set())}>
                <X size={11}/> Effacer
              </button>
            </div>
          )}
        </div>

        {/* Pills filtres */}
        {parBien.length > 0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
            {GROUPES_CATEGORIE.flatMap(g =>
              g.cats.filter(cat=>(countParCat[cat]||0)>0).map(cat => {
                const c = COULEUR_MAP[g.couleur]
                const actif = activeCats.has(cat)
                return (
                  <button key={cat} onClick={()=>toggleCat(cat)} style={{
                    display:'flex',alignItems:'center',gap:5,padding:'3px 10px',
                    borderRadius:'var(--radius-full)',cursor:'pointer',fontSize:'0.72rem',
                    fontFamily:'var(--font-body)',transition:'all 120ms',
                    border:`1px solid ${actif?c.text:'var(--border)'}`,
                    background:actif?c.bg:'transparent',color:actif?c.text:'var(--text-tertiary)',
                  }}>
                    {CATEGORIES_TX[cat]?.label}
                    <span style={{
                      minWidth:16,height:16,borderRadius:'var(--radius-full)',fontSize:'0.6rem',fontWeight:700,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      background:actif?c.text:'var(--bg-hover)',color:actif?'white':'var(--text-tertiary)',
                    }}>{countParCat[cat]}</span>
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* Contenu */}
        {triees.length === 0
          ? <div className="card"><div className="empty-state">
              <h3>Aucune transaction{activeCats.size>0?' pour ce filtre':''} pour {annee}</h3>
              <p>Ajoutez votre premier loyer ou charge.</p>
            </div></div>
          : viewMode === 'groupe'
            ? <VueGroupee groupesCat={groupesCat} collapsedSec={collapsedSec} onToggleSec={toggleSec} {...sharedGroupProps}/>
            : <VueChrono triees={triees} {...sharedGroupProps}/>
        }
      </div>
    </>
  )
}

// ── Vue groupée ───────────────────────────────────────────────

function VueGroupee({ groupesCat, collapsedSec, onToggleSec, groupesRec, expandedGrps, onToggleGrp, onEdit, onDelete, onDeleteGroupe, onUpdateGroupe }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {groupesCat.map(groupe => {
        const c      = COULEUR_MAP[groupe.couleur]
        const isOpen = !collapsedSec.has(groupe.id)
        const { grouped: grpRec, singles } = regrouperTransactions(groupe.transactions)
        return (
          <div key={groupe.id} style={{border:`1px solid ${c.border}`,borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
            <div onClick={()=>onToggleSec(groupe.id)} style={{
              display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',background:c.bg,
              borderBottom:isOpen?`1px solid ${c.border}`:'none',
            }}>
              <span style={{fontSize:'0.9rem'}}>{groupe.emoji}</span>
              <span style={{fontWeight:600,fontSize:'0.875rem',color:c.text,flex:1}}>{groupe.label}</span>
              {groupe.totalRecettes>0 && <span style={{fontFamily:'var(--font-mono)',fontSize:'0.82rem',color:'var(--success-text)',fontWeight:600}}>+{eur(groupe.totalRecettes)}</span>}
              {groupe.totalCharges>0  && <span style={{fontFamily:'var(--font-mono)',fontSize:'0.82rem',color:'var(--danger-text)',fontWeight:600}}>−{eur(groupe.totalCharges)}</span>}
              <span style={{fontSize:'0.72rem',color:c.text,opacity:0.7}}>{groupe.transactions.length} ligne{groupe.transactions.length>1?'s':''}</span>
              <span style={{color:c.text,opacity:0.6,fontSize:'0.8rem',transform:isOpen?'rotate(180deg)':'none',display:'inline-block',transition:'200ms'}}>▾</span>
            </div>
            {isOpen && (
              <div>
                {[...grpRec.entries()].map(([gid, txs]) => {
                  const r = resumeGroupe(txs)
                  return r ? (
                    <GroupeRow key={gid} resume={r} txs={txs}
                      isOpen={expandedGrps.has(gid)} onToggle={()=>onToggleGrp(gid)}
                      onDelete={()=>onDeleteGroupe(gid,r.titre)} onDeleteTx={onDelete} onEditTx={onEdit}
                      onUpdateAll={u=>onUpdateGroupe(gid,u)} indent/>
                  ) : null
                })}
                {singles.length>0 && (
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <tbody>{singles.map(tx=><TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete}/>)}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Vue chronologique ─────────────────────────────────────────

function VueChrono({ triees, groupesRec, expandedGrps, onToggleGrp, onEdit, onDelete, onDeleteGroupe, onUpdateGroupe }) {
  const { grouped, singles } = useMemo(() => regrouperTransactions(triees), [triees])
  return (
    <div className="card" style={{padding:0}}>
      {[...grouped.entries()].map(([gid,txs]) => {
        const r = resumeGroupe(txs)
        return r ? (
          <GroupeRow key={gid} resume={r} txs={txs}
            isOpen={expandedGrps.has(gid)} onToggle={()=>onToggleGrp(gid)}
            onDelete={()=>onDeleteGroupe(gid,r.titre)} onDeleteTx={onDelete} onEditTx={onEdit}
            onUpdateAll={u=>onUpdateGroupe(gid,u)}/>
        ) : null
      })}
      {singles.length>0 && (
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>{['Date','Titre','Catégorie','Montant',''].map((h,i)=>(
              <th key={i} style={{padding:'8px 14px',textAlign:i>=3?'right':'left',background:'var(--bg-hover)',fontSize:'0.65rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-tertiary)',borderBottom:'1px solid var(--border)'}}>
                {h}
              </th>
            ))}</tr>
          </thead>
          <tbody>{singles.map(tx=><TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} showDate/>)}</tbody>
        </table>
      )}
    </div>
  )
}

// ── Groupe récurrent ──────────────────────────────────────────

function GroupeRow({ resume, txs, isOpen, onToggle, onDelete, onDeleteTx, onEditTx, onUpdateAll, indent }) {
  const [editing,  setEditing]  = useState(false)
  const [gMontant, setGMontant] = useState(String(resume.montantRef))
  const [gCat,     setGCat]     = useState(resume.categorie)

  const apply = async () => {
    await onUpdateAll({ montant:parseFloat(gMontant)||resume.montantRef, categorie:gCat, sens:CATEGORIES_TX[gCat]?.sens||'charge' })
    setEditing(false)
  }

  return (
    <div style={{borderBottom:'1px solid var(--border-subtle)'}}>
      <div onClick={onToggle} style={{display:'flex',alignItems:'center',gap:10,padding:`10px ${indent?24:16}px`,background:'var(--bg-hover)',cursor:'pointer'}}>
        <Layers size={13} style={{color:'var(--brand-primary)',flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontWeight:500,fontSize:'0.85rem',color:'var(--text-primary)'}}>{resume.titre}</span>
            <span className="badge badge-brand" style={{fontSize:'0.62rem'}}><Repeat size={8}/> {resume.type==='mensuel'?'Mensuel':'Trimestriel'}</span>
          </div>
          <div style={{fontSize:'0.72rem',color:'var(--text-tertiary)',marginTop:1}}>
            {CATEGORIES_TX[resume.categorie]?.label} · {resume.count} × {(resume.montantRef||0).toLocaleString('fr-FR')} € = <strong>{eur(resume.totalAnnuel)}/an</strong>
          </div>
        </div>
        <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(v=>!v)}><RefreshCw size={12}/></button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}><Trash2 size={12}/></button>
        </div>
        <span style={{color:'var(--text-tertiary)',fontSize:'0.75rem',transform:isOpen?'rotate(180deg)':'none',display:'inline-block',transition:'200ms',flexShrink:0}}>▾</span>
      </div>

      {editing && (
        <div style={{display:'flex',gap:10,alignItems:'flex-end',padding:'10px 16px',background:'var(--brand-subtle)',flexWrap:'wrap',borderBottom:'1px solid var(--border-subtle)'}}>
          <div style={{fontSize:'0.72rem',fontWeight:600,color:'var(--brand-text)',width:'100%',marginBottom:2}}>
            <RefreshCw size={11}/> Modifier toutes les occurrences
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{fontSize:'0.7rem'}}>Montant (€)</label>
            <input type="number" step="0.01" className="form-input" style={{width:130}} value={gMontant} onChange={e=>setGMontant(e.target.value)}/>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{fontSize:'0.7rem'}}>Catégorie</label>
            <select className="form-select" style={{width:190}} value={gCat} onChange={e=>setGCat(e.target.value)}>
              {Object.entries(CATEGORIES_TX).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="btn-group" style={{marginBottom:0}}>
            <button className="btn btn-primary btn-sm" onClick={apply}><Check size={12}/> Appliquer</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(false)}><X size={12}/> Annuler</button>
          </div>
        </div>
      )}

      {isOpen && (
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <tbody>{txs.map(tx=><TxRow key={tx.id} tx={tx} onEdit={onEditTx} onDelete={onDeleteTx} isOccurrence showDate/>)}</tbody>
        </table>
      )}
    </div>
  )
}

// ── Ligne transaction ──────────────────────────────────────────

function TxRow({ tx, onEdit, onDelete, isOccurrence, showDate }) {
  const cat    = CATEGORIES_TX[tx.categorie]
  const groupe = groupeDeCategorie(tx.categorie)
  const c      = COULEUR_MAP[groupe?.couleur||'neutral']
  const pad    = isOccurrence ? '8px 14px 8px 32px' : '10px 14px'
  return (
    <tr style={{borderBottom:'1px solid var(--border-subtle)',transition:'background 120ms'}}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      {showDate && (
        <td style={{padding:pad,width:80,fontSize:'0.75rem',color:'var(--text-tertiary)',whiteSpace:'nowrap'}}>
          {tx.date ? new Date(tx.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '—'}
        </td>
      )}
      <td style={{padding:pad}}>
        <div style={{fontSize:'0.875rem',color:'var(--text-primary)'}}>{tx.titre}</div>
        {tx.notes && <div style={{fontSize:'0.7rem',color:'var(--text-tertiary)'}}>{tx.notes}</div>}
      </td>
      <td style={{padding:'10px 8px',whiteSpace:'nowrap'}}>
        <span style={{display:'inline-flex',alignItems:'center',padding:'2px 7px',borderRadius:'var(--radius-full)',border:`1px solid ${c.border}`,background:c.bg,color:c.text,fontSize:'0.65rem',fontWeight:500}}>
          {cat?.label||tx.categorie}
        </span>
      </td>
      <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'var(--font-mono)',fontSize:'0.875rem',fontWeight:600,color:tx.sens==='recette'?'var(--success-text)':'var(--danger-text)',whiteSpace:'nowrap'}}>
        {tx.sens==='recette'?'+':'−'} {(tx.montant||0).toLocaleString('fr-FR',{minimumFractionDigits:2})} €
      </td>
      <td style={{padding:'10px 8px',width:72}}>
        <div style={{display:'flex',gap:3,justifyContent:'flex-end'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>onEdit(tx)}><Edit2 size={12}/></button>
          <button className="btn btn-danger btn-sm" onClick={()=>onDelete(tx.id)}><Trash2 size={12}/></button>
        </div>
      </td>
    </tr>
  )
}

// ── Formulaire ────────────────────────────────────────────────

function FormulaireTransaction({ form, setForm, editId, resumeBiens, annee, sensFor, onSave, onCancel }) {
  const sf = (f,v) => setForm(p=>({...p,[f]:v}))
  return (
    <div className="card">
      <div className="card-title">{editId?<Edit2 size={15}/>:<Plus size={15}/>} {editId?'Modifier':'Nouvelle transaction'}</div>

      <div className="form-grid" style={{marginBottom:16}}>
        <div className="form-group">
          <label className="form-label">Bien <span className="form-label-required"/></label>
          <select className="form-select" value={form.bienAnneeId} onChange={e=>sf('bienAnneeId',e.target.value)}>
            <option value="">Choisir…</option>
            {resumeBiens.map(b=><option key={b.bienAnnee.id} value={b.bienAnnee.id}>{b.bien.nom}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Catégorie <span className="form-label-required"/></label>
          <select className="form-select" value={form.categorie} onChange={e=>sf('categorie',e.target.value)}>
            {GROUPES_CATEGORIE.map(g=>(
              <optgroup key={g.id} label={g.label}>
                {g.cats.map(cat=><option key={cat} value={cat}>{CATEGORIES_TX[cat]?.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Titre <span className="form-label-required"/>
            {form.recurrent && <HelpTooltip text="Sera suffixé par le mois ou trimestre."/>}
          </label>
          <input type="text" className="form-input" placeholder={form.recurrent?'ex : Loyer Paris':'ex : Loyer mars 2025'}
            value={form.titre} onChange={e=>sf('titre',e.target.value)}/>
        </div>
        <div className="form-group">
          <label className="form-label">Montant (€) <span className="form-label-required"/></label>
          <input type="number" step="0.01" min="0" className="form-input" placeholder="850"
            value={form.montant} onChange={e=>sf('montant',e.target.value)}/>
          <span className={`form-hint ${sensFor(form.categorie)==='recette'?'text-success':'text-danger'}`}>
            {sensFor(form.categorie)==='recette'?'↑ Recette':'↓ Charge'}
          </span>
          {form.categorie === 'taxe_fonciere' && (
            <span className="form-hint" style={{color:'var(--warning-text)'}}>
              ⚠️ Ne pas inclure la TEOM (ordures ménagères) si vous la refacturez à votre locataire — elle n'est pas déductible pour vous dans ce cas.
            </span>
          )}
        </div>
        {!form.recurrent && (
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={form.date} onChange={e=>sf('date',e.target.value)}/>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Note</label>
          <input type="text" className="form-input" placeholder="Optionnel" value={form.notes} onChange={e=>sf('notes',e.target.value)}/>
        </div>
      </div>

      {!editId && (
        <div style={{borderTop:'1px solid var(--border-subtle)',paddingTop:14,marginBottom:14}}>
          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',userSelect:'none'}}>
            <input type="checkbox" checked={form.recurrent} onChange={e=>sf('recurrent',e.target.checked)}
              style={{width:15,height:15,accentColor:'var(--brand-primary)'}}/>
            <Repeat size={14} style={{color:'var(--brand-primary)'}}/>
            <span style={{fontWeight:500,fontSize:'0.875rem'}}>Revenu ou charge récurrent(e)</span>
            <HelpTooltip text="Génère 12 lignes mensuelles ou 4 lignes trimestrielles."/>
          </label>
          {form.recurrent && (
            <div style={{marginTop:12,marginLeft:25}}>
              <div style={{display:'flex',gap:10,marginBottom:10}}>
                {[{val:'mensuel',label:'Mensuel',hint:'12 lignes'},{val:'trimestriel',label:'Trimestriel',hint:'4 lignes'}].map(opt=>(
                  <label key={opt.val} style={{
                    flex:1,padding:'10px 14px',borderRadius:'var(--radius)',cursor:'pointer',
                    border:form.recurrenceType===opt.val?'2px solid var(--brand-primary)':'1px solid var(--border)',
                    background:form.recurrenceType===opt.val?'var(--brand-subtle)':'var(--bg-input)',
                    display:'flex',flexDirection:'column',gap:3,
                  }}>
                    <input type="radio" name="rt" value={opt.val} checked={form.recurrenceType===opt.val}
                      onChange={()=>sf('recurrenceType',opt.val)} style={{display:'none'}}/>
                    <span style={{fontWeight:500,fontSize:'0.85rem',color:form.recurrenceType===opt.val?'var(--brand-primary)':'var(--text-primary)'}}>{opt.label}</span>
                    <span style={{fontSize:'0.7rem',color:'var(--text-tertiary)'}}>{opt.hint}</span>
                  </label>
                ))}
              </div>
              {form.titre && (
                <div style={{padding:'10px 14px',background:'var(--bg-hover)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border-subtle)'}}>
                  <div style={{fontSize:'0.68rem',fontWeight:600,color:'var(--text-tertiary)',textTransform:'uppercase',marginBottom:6}}>Aperçu des titres</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {(form.recurrenceType==='mensuel'?MOIS:TRIMESTRES).map((l,i)=>(
                      <span key={i} className="badge badge-neutral" style={{fontSize:'0.68rem'}}>{form.titre} - {l}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="btn-group">
        <button className="btn btn-primary" onClick={onSave}>
          {form.recurrent&&!editId
            ? <><Repeat size={13}/> Créer {form.recurrenceType==='mensuel'?'12':'4'} occurrences</>
            : <><Check size={13}/> {editId?'Enregistrer':'Ajouter'}</>}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}><X size={13}/> Annuler</button>
      </div>
    </div>
  )
}
