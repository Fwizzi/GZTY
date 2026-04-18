import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { RevenuSCPIRepo } from '../db/repositories/index.js'
import { Plus, Trash2, Edit2, Check, X, TrendingUp } from 'lucide-react'

const eur = v => Math.round(parseFloat(v)||0).toLocaleString('fr-FR') + ' €'
const empty = (anneeId) => ({ anneeFiscaleId:anneeId, nom:'', typeRevenu:'foncier', montantInvesti:'', revenusBruts:'', revenusNets:'', notes:'' })

export default function SCPI() {
  const { currentProfile, currentAnnee } = useApp()
  const [scpis, setScpis]     = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(empty(currentAnnee?.id))
  const [editId, setEditId]   = useState(null)

  const load = async () => { if(currentAnnee) setScpis(await RevenuSCPIRepo.findByAnnee(currentAnnee.id)) }
  useEffect(() => { load() }, [currentAnnee?.id])

  if (!currentAnnee) return <div className="page-body"><div className="empty-state"><h3>Sélectionnez une année fiscale</h3></div></div>

  const totalNets = scpis.filter(s=>s.typeRevenu==='foncier').reduce((s,x)=>s+(parseFloat(x.revenusNets)||0),0)

  const handleSave = async () => {
    if (!form.nom || !form.revenusNets) { alert('Nom et revenus nets obligatoires'); return }
    await RevenuSCPIRepo.save({
      ...(editId?{id:editId}:{}),
      anneeFiscaleId: currentAnnee.id,
      profileId: currentProfile.id,
      nom: form.nom, typeRevenu: form.typeRevenu,
      montantInvesti: parseFloat(form.montantInvesti)||0,
      revenusBruts: parseFloat(form.revenusBruts)||0,
      revenusNets: parseFloat(form.revenusNets)||0,
      notes: form.notes,
    })
    await load(); setForm(empty(currentAnnee.id)); setShowForm(false); setEditId(null)
  }
  const handleEdit = s => { setForm({...s}); setEditId(s.id); setShowForm(true) }
  const handleDelete = async id => { if(confirm('Supprimer ?')){ await RevenuSCPIRepo.delete(id); await load() } }

  return (
    <>
      <div className="page-header"><h2>Revenus SCPI</h2><p>Année {currentAnnee.annee} — revenus de parts immobilières</p></div>
      <div className="page-body">
        <div className="alert alert-info">ℹ️ Les montants à saisir figurent sur votre <strong>IFU (Imprimé Fiscal Unique)</strong> transmis par votre SCPI chaque année.</div>

        {scpis.length > 0 && (
          <div className="kpi-grid" style={{gridTemplateColumns:'repeat(2,1fr)'}}>
            <div className="kpi-card"><div className="kpi-label">Revenus nets fonciers SCPI</div><div className="kpi-value positive">{eur(totalNets)}</div><div className="kpi-sub">S'ajoute à la case 4BA</div></div>
            <div className="kpi-card"><div className="kpi-label">Capital total investi</div><div className="kpi-value">{eur(scpis.reduce((s,x)=>s+(parseFloat(x.montantInvesti)||0),0))}</div></div>
          </div>
        )}

        {showForm && (
          <div className="card">
            <div className="card-title">{editId?<Edit2 size={16}/>:<Plus size={16}/>} {editId?'Modifier':'Ajouter'} une SCPI</div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Nom *</label><input type="text" className="form-input" placeholder="ex : Immorente" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Type de revenu</label>
                <select className="form-select" value={form.typeRevenu} onChange={e=>setForm(f=>({...f,typeRevenu:e.target.value}))}>
                  <option value="foncier">Revenus fonciers (2044)</option>
                  <option value="mobilier">Revenus mobiliers (2042)</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Capital investi (€)</label><input type="number" className="form-input" value={form.montantInvesti} onChange={e=>setForm(f=>({...f,montantInvesti:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Revenus bruts (€)</label><input type="number" step="0.01" className="form-input" value={form.revenusBruts} onChange={e=>setForm(f=>({...f,revenusBruts:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Revenus nets à déclarer (€) *</label><input type="number" step="0.01" className="form-input" value={form.revenusNets} onChange={e=>setForm(f=>({...f,revenusNets:e.target.value}))}/><span className="form-hint">Montant net figurant sur votre IFU</span></div>
              <div className="form-group"><label className="form-label">Notes</label><input type="text" className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
            </div>
            <div className="btn-group mt-16">
              <button className="btn btn-primary" onClick={handleSave}><Check size={15}/> Enregistrer</button>
              <button className="btn btn-secondary" onClick={()=>{setShowForm(false);setEditId(null);setForm(empty(currentAnnee.id))}}><X size={15}/> Annuler</button>
            </div>
          </div>
        )}
        {!showForm && <div className="mb-16"><button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditId(null);setForm(empty(currentAnnee.id))}}><Plus size={15}/> Ajouter une SCPI</button></div>}

        {scpis.length === 0
          ? <div className="card"><div className="empty-state"><TrendingUp size={40}/><h3>Aucune SCPI pour {currentAnnee.annee}</h3><p>Si vous détenez des parts, saisissez les données de votre IFU</p></div></div>
          : <div className="card" style={{padding:0}}><div className="table-wrap"><table>
              <thead><tr><th>SCPI</th><th>Type</th><th className="text-right">Capital</th><th className="text-right">Bruts</th><th className="text-right">Nets</th><th></th></tr></thead>
              <tbody>
                {scpis.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.nom}</strong>{s.notes&&<span className="muted" style={{marginLeft:8,fontSize:'0.78rem'}}>{s.notes}</span>}</td>
                    <td><span className={`badge ${s.typeRevenu==='foncier'?'badge-gold':'badge-blue'}`}>{s.typeRevenu==='foncier'?'Foncier':'Mobilier'}</span></td>
                    <td className="amount">{eur(s.montantInvesti)}</td>
                    <td className="amount">{eur(s.revenusBruts)}</td>
                    <td className="amount positive">{eur(s.revenusNets)}</td>
                    <td><div className="btn-group" style={{justifyContent:'flex-end'}}>
                      <button className="btn btn-secondary btn-sm" onClick={()=>handleEdit(s)}><Edit2 size={13}/></button>
                      <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(s.id)}><Trash2 size={13}/></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
        }
      </div>
    </>
  )
}
