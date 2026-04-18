import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { BienRepo, BienAnneeRepo } from '../db/repositories/index.js'
import { Plus, Trash2, Edit2, Check, X, Home } from 'lucide-react'
import { calculerFinExercice, estExerciceAnneeCivile } from '../services/fiscal/CoproService.js'

const empty = () => ({ nom:'', adresse:'', type:'location_nue', coproDebutJjMm:'', coproFinJjMm:'' })

export default function Biens() {
  const { currentProfile, currentAnnee, refreshAnnees } = useApp()
  const [biens, setBiens]       = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(empty())
  const [editId, setEditId]     = useState(null)

  const load = async () => { if(currentProfile) setBiens(await BienRepo.findByProfile(currentProfile.id)) }
  useEffect(() => { load() }, [currentProfile])

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    const bien = await BienRepo.save({
      ...(editId ? {id:editId} : {}),
      profileId: currentProfile.id,
      nom: form.nom,
      adresse: form.adresse,
      type: form.type,
      coproDebutJjMm: form.coproDebutJjMm,
      coproFinJjMm: form.coproFinJjMm,
    })
    // Créer automatiquement un BienAnnee pour l'année courante
    if (!editId && currentAnnee) {
      const ba = await BienAnneeRepo.getOrCreate(bien.id, currentAnnee.id)
      // Propager les paramètres copro dans le BienAnnee
      if (form.coproDebutJjMm && form.coproFinJjMm) {
        await BienAnneeRepo.save({
          ...ba,
          copro: { ...ba.copro, debutJjMm: form.coproDebutJjMm, finJjMm: form.coproFinJjMm }
        })
      }
      await refreshAnnees()
    }
    // Si édition : propager les nouvelles dates copro dans tous les BienAnnees existants
    if (editId && (form.coproDebutJjMm || form.coproFinJjMm)) {
      const bienAnnees = await BienAnneeRepo.findByBien(editId)
      for (const ba of bienAnnees) {
        await BienAnneeRepo.save({
          ...ba,
          copro: { ...ba.copro, debutJjMm: form.coproDebutJjMm, finJjMm: form.coproFinJjMm }
        })
      }
    }
    await load(); setForm(empty()); setShowForm(false); setEditId(null)
  }

  const handleEdit = b => {
    setForm({
      nom: b.nom, adresse: b.adresse || '', type: b.type,
      coproDebutJjMm: b.coproDebutJjMm || '',
      coproFinJjMm:   b.coproFinJjMm   || '',
    })
    setEditId(b.id); setShowForm(true)
  }

  const handleDelete = async id => {
    if (confirm('Supprimer ce bien ?')) { await BienRepo.delete(id); await load() }
  }

  const typeLabel = { location_nue:'Location nue (régime réel)', location_meublee:'Location meublée' }

  return (
    <>
      <div className="page-header">
        <h2>Biens immobiliers</h2>
        <p>Paramètres permanents de chaque bien — dont le format de l'exercice de copropriété</p>
      </div>
      <div className="page-body">

        {showForm && (
          <div className="card">
            <div className="card-title">{editId?<Edit2 size={16}/>:<Plus size={16}/>} {editId?'Modifier':'Nouveau'} bien</div>

            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
              Informations générales
            </div>
            <div className="form-grid" style={{ marginBottom:24 }}>
              <div className="form-group">
                <label className="form-label">Nom du bien *</label>
                <input type="text" className="form-input" placeholder="ex : ALFA LES FABRIQUES"
                  value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Type de location</label>
                <select className="form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="location_nue">Location nue (régime réel)</option>
                  <option value="location_meublee">Location meublée</option>
                </select>
              </div>
              <div className="form-group span-2">
                <label className="form-label">Adresse</label>
                <input type="text" className="form-input" placeholder="15 rue des Fabriques, 75011 Paris"
                  value={form.adresse} onChange={e=>setForm(f=>({...f,adresse:e.target.value}))}/>
              </div>
            </div>

            {/* Paramètre copropriété */}
            <div style={{ height:1, background:'var(--border)', margin:'0 0 20px' }}/>
            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
              Exercice comptable de copropriété
            </div>
            <p style={{ fontSize:'0.8rem', color:'var(--text-dim)', marginBottom:16 }}>
              Paramètre permanent du bien. Les années s'ajoutent automatiquement selon l'année fiscale déclarée.
            </p>
            <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr', maxWidth:400 }}>
              <div className="form-group">
                <label className="form-label">Début exercice (JJ/MM)</label>
                <input type="text" className="form-input" placeholder="01/07" maxLength={5}
                  value={form.coproDebutJjMm} onChange={e => {
                    const val = e.target.value
                    setForm(f => {
                      const fin = val.length === 5 ? calculerFinExercice(val) : f.coproFinJjMm
                      return { ...f, coproDebutJjMm: val, coproFinJjMm: fin || f.coproFinJjMm }
                    })
                  }}/>
                <span className="form-hint">ex : 01/07 pour 1er juillet</span>
              </div>
              <div className="form-group">
                <label className="form-label">Fin exercice (JJ/MM)</label>
                <input type="text" className="form-input" placeholder="30/06" maxLength={5}
                  value={form.coproFinJjMm} onChange={e=>setForm(f=>({...f,coproFinJjMm:e.target.value}))}/>
                <span className="form-hint">ex : 30/06 pour 30 juin</span>
              </div>
            </div>

            {/* Aperçu exercices pour l'année courante */}
            {form.coproDebutJjMm && form.coproFinJjMm && currentAnnee && (() => {
              try {
                const { genererExercices } = require('../services/fiscal/CoproService.js')
                const dates = genererExercices(form.coproDebutJjMm, form.coproFinJjMm, currentAnnee.annee)
                return dates ? (
                  <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span style={{ background:'var(--gold-dim)', border:'1px solid var(--gold)', borderRadius:6, padding:'4px 12px', fontSize:'0.75rem', color:'var(--gold)' }}>
                      Exercice 1 pour {currentAnnee.annee} : {dates.exercice1.label}
                    </span>
                    <span style={{ background:'var(--gold-dim)', border:'1px solid var(--gold)', borderRadius:6, padding:'4px 12px', fontSize:'0.75rem', color:'var(--gold)' }}>
                      Exercice 2 pour {currentAnnee.annee} : {dates.exercice2.label}
                    </span>
                  </div>
                ) : null
              } catch { return null }
            })()}

            <div className="btn-group mt-16">
              <button className="btn btn-primary" onClick={handleSave}><Check size={15}/> Enregistrer</button>
              <button className="btn btn-secondary" onClick={()=>{setShowForm(false);setEditId(null);setForm(empty())}}><X size={15}/> Annuler</button>
            </div>
          </div>
        )}

        {!showForm && (
          <div className="mb-16">
            <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditId(null);setForm(empty())}}>
              <Plus size={15}/> Ajouter un bien
            </button>
          </div>
        )}

        {biens.length === 0
          ? <div className="card"><div className="empty-state"><Home size={40}/><h3>Aucun bien immobilier</h3><p>Ajoutez votre premier bien pour commencer</p></div></div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
              {biens.map(b => (
                <div key={b.id} className="card" style={{ marginBottom:0 }}>
                  <div className="flex-between" style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Home size={18} style={{ color:'var(--gold)' }}/>
                      <strong>{b.nom}</strong>
                    </div>
                    <div className="btn-group">
                      <button className="btn btn-secondary btn-sm" onClick={()=>handleEdit(b)}><Edit2 size={13}/></button>
                      <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(b.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>

                  {b.adresse && <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:10 }}>{b.adresse}</p>}

                  <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:'0.82rem' }}>
                    <div className="flex-between">
                      <span style={{ color:'var(--text-muted)' }}>Type</span>
                      <span className="badge badge-blue">{typeLabel[b.type]||b.type}</span>
                    </div>
                    <div className="flex-between">
                      <span style={{ color:'var(--text-muted)' }}>Exercice copro</span>
                      {b.coproDebutJjMm && b.coproFinJjMm
                        ? <span style={{ color:'var(--gold)' }}>{b.coproDebutJjMm} → {b.coproFinJjMm}</span>
                        : <span style={{ color:'var(--text-dim)' }}>Non renseigné</span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
        }

        <div className="alert alert-info mt-16">
          ℹ️ L'exercice copro (JJ/MM) est un paramètre permanent du bien. Les montants des décomptes syndic se saisissent chaque année dans l'onglet <strong>Copropriété</strong>.
        </div>
      </div>
    </>
  )
}
