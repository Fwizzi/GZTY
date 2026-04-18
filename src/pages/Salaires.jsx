import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { RevenuSalarialRepo } from '../db/repositories/index.js'
import { calculerAbattement, calculerIRSalaires } from '../services/fiscal/Calcul2042Service.js'
import { Plus, Trash2, Edit2, Check, X, Briefcase, ChevronDown, ChevronUp, Info } from 'lucide-react'

const eur  = v => Math.round(parseFloat(v)||0).toLocaleString('fr-FR') + ' €'
const pct  = v => ((parseFloat(v)||0)*100).toFixed(2) + ' %'

const emptyFrais = () => ({ transport:0, repas:0, formation:0, vetements:0, doubleResid:0, autres:0 })
const emptyForm  = (anneeId) => ({
  anneeFiscaleId: anneeId, employeur:'', netImposable:'', prelSource:'',
  modeAbattement: 'forfaitaire', fraisReels: emptyFrais(), notes:'',
})

export default function Salaires() {
  const { currentProfile, currentAnnee } = useApp()
  const [salaires,  setSalaires]  = useState([])
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(emptyForm(currentAnnee?.id))
  const [editId,    setEditId]    = useState(null)
  const [showIR,    setShowIR]    = useState(false)

  const load = async () => {
    if (currentAnnee) setSalaires(await RevenuSalarialRepo.findByAnnee(currentAnnee.id))
  }
  useEffect(() => { load() }, [currentAnnee?.id])

  if (!currentAnnee) return (
    <div className="page-body"><div className="empty-state"><h3>Sélectionnez une année fiscale</h3></div></div>
  )

  const bareme    = currentAnnee.bareme
  const situation = currentProfile?.situation || 'Célibataire'
  const nbParts   = currentProfile?.nbParts || 1

  // Anomalie 4 : alerte si plusieurs employeurs avec modes différents
  const modesUtilises = [...new Set(salaires.map(s => s.modeAbattement || 'forfaitaire'))]
  const alerteModeMixte = modesUtilises.length > 1

  // ── Totaux ──────────────────────────────────────────────
  const totalNet = salaires.reduce((s, x) => s + (parseFloat(x.netImposable)||0), 0)
  const totalPAS = salaires.reduce((s, x) => s + (parseFloat(x.prelSource)||0), 0)

  // Abattement global = somme des abattements individuels
  const totalAbattement = salaires.reduce((s, x) => {
    const { abattementRetenu } = calculerAbattement(
      parseFloat(x.netImposable)||0,
      x.modeAbattement || 'forfaitaire',
      x.fraisReels || {},
      bareme?.abattementSalaires
    )
    return s + abattementRetenu
  }, 0)

  const irDetail = calculerIRSalaires(totalNet, totalAbattement, nbParts, bareme, situation)

  // ── Abattement du formulaire en cours ──────────────────
  const abattForm = calculerAbattement(
    parseFloat(form.netImposable)||0,
    form.modeAbattement,
    form.fraisReels,
    bareme?.abattementSalaires
  )

  const handleSave = async () => {
    if (!form.employeur || !form.netImposable) { alert('Employeur et net imposable obligatoires'); return }
    await RevenuSalarialRepo.save({
      ...(editId ? {id:editId} : {}),
      anneeFiscaleId:  currentAnnee.id,
      profileId:       currentProfile.id,
      employeur:       form.employeur,
      netImposable:    parseFloat(form.netImposable)||0,
      prelSource:      parseFloat(form.prelSource)||0,
      modeAbattement:  form.modeAbattement,
      fraisReels:      form.fraisReels,
      notes:           form.notes,
    })
    await load()
    setForm(emptyForm(currentAnnee.id)); setShowForm(false); setEditId(null)
  }

  const handleEdit = s => {
    setForm({ ...s, fraisReels: s.fraisReels || emptyFrais() })
    setEditId(s.id); setShowForm(true)
  }
  const handleDelete = async id => {
    if (confirm('Supprimer ?')) { await RevenuSalarialRepo.delete(id); await load() }
  }

  const updateFrais = (field, val) =>
    setForm(f => ({ ...f, fraisReels: { ...f.fraisReels, [field]: parseFloat(val)||0 } }))

  return (
    <>
      <div className="page-header">
        <div className="flex-between">
          <div><h2>Revenus salariaux</h2><p>Année {currentAnnee.annee} — abattement et calcul IR progressif</p></div>
        </div>
      </div>
      <div className="page-body">

        {/* KPIs */}
        <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
          <div className="kpi-card">
            <div className="kpi-label">Net imposable total <span className="case-ref">1AJ</span></div>
            <div className="kpi-value">{eur(totalNet)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Abattement retenu</div>
            <div className="kpi-value gold">− {eur(totalAbattement)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Revenu imposable</div>
            <div className="kpi-value">{eur(irDetail.revenuImposable)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">IR net (salaires seuls)</div>
            <div className="kpi-value negative">{eur(irDetail.irNet)}</div>
            <div className="kpi-sub">TMI {pct(irDetail.tmi)} · Taux eff. {pct(irDetail.tauxEffectif)}</div>
          </div>
        </div>

        {/* Anomalie 4 : alerte mode mixte */}
        {alerteModeMixte && (
          <div className="alert alert-warning">
            ⚠️ <strong>Mode d'abattement incohérent :</strong> vous avez des employeurs en abattement forfaitaire et d'autres en frais réels.
            Un salarié doit choisir <strong>un seul mode</strong> pour l'ensemble de ses salaires.
            Le calcul global applique les frais réels à tous les salaires cumulés.
          </div>
        )}

        {/* Tableau détail IR par tranche */}
        {salaires.length > 0 && (
          <div className="card">
            <div className="flex-between" style={{ marginBottom: showIR ? 16 : 0, cursor:'pointer' }}
              onClick={() => setShowIR(v => !v)}>
              <div className="card-title" style={{ marginBottom:0 }}>
                Détail calcul IR par tranche
              </div>
              {showIR ? <ChevronUp size={16} style={{color:'var(--text-muted)'}}/> : <ChevronDown size={16} style={{color:'var(--text-muted)'}}/>}
            </div>

            {showIR && (
              <>
                <div className="alert alert-info" style={{ marginBottom:16 }}>
                  <Info size={14} style={{flexShrink:0}}/>
                  <span>Calcul sur le quotient familial : {eur(irDetail.revenuImposable)} ÷ {nbParts} part{nbParts>1?'s':''} = {eur(irDetail.quotient)}</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tranche</th>
                        <th>Taux</th>
                        <th className="text-right">De</th>
                        <th className="text-right">À</th>
                        <th className="text-right">Montant soumis</th>
                        <th className="text-right">Impôt (× {nbParts} part{nbParts>1?'s':''})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {irDetail.detail.map((t, i) => (
                        <tr key={i} style={{ opacity: t.estActive ? 1 : 0.35 }}>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{
                                width:10, height:10, borderRadius:'50%', flexShrink:0,
                                background: t.estActive
                                  ? `hsl(${40 + i * 30}, 80%, 55%)`
                                  : 'var(--border)'
                              }}/>
                              Tranche {i + 1}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontFamily:'var(--font-display)', color: t.estActive ? 'var(--gold)' : 'var(--text-dim)' }}>
                              {pct(t.taux)}
                            </span>
                          </td>
                          <td className="amount muted">{eur(t.de)}</td>
                          <td className="amount muted">
                            {t.jusqu_a === Infinity ? '∞' : eur(t.jusqu_a)}
                          </td>
                          <td className="amount">{t.estActive ? eur(t.montantSoumis) : '—'}</td>
                          <td className="amount" style={{ color: t.estActive ? 'var(--red)' : 'var(--text-dim)', fontWeight: t.estActive ? 600 : 400 }}>
                            {t.estActive ? eur(t.impotTotal) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop:'2px solid var(--border)' }}>
                        <td colSpan={5} style={{ padding:'12px 14px', color:'var(--text-muted)' }}>
                          IR brut
                        </td>
                        <td className="amount" style={{ fontWeight:700 }}>{eur(irDetail.irBrut)}</td>
                      </tr>
                      {irDetail.decote > 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding:'6px 14px', color:'var(--text-muted)', fontSize:'0.82rem' }}>
                            Décote appliquée
                          </td>
                          <td className="amount positive" style={{ fontSize:'0.82rem' }}>− {eur(irDetail.decote)}</td>
                        </tr>
                      )}
                      <tr style={{ background:'var(--gold-dim)' }}>
                        <td colSpan={5} style={{ padding:'12px 14px', color:'var(--gold)', fontWeight:600 }}>
                          IR net (salaires seuls)
                        </td>
                        <td className="amount" style={{ color:'var(--gold)', fontWeight:700, fontSize:'1.1rem' }}>
                          {eur(irDetail.irNet)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:16 }}>
                  {[
                    { label:'TMI',            val: pct(irDetail.tmi),          color:'var(--gold)' },
                    { label:'Taux effectif',  val: pct(irDetail.tauxEffectif),  color:'var(--text)' },
                    { label:'PAS déjà versé', val: eur(totalPAS),              color:'var(--blue)'  },
                  ].map((item,i) => (
                    <div key={i} style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
                      <div style={{ fontSize:'0.68rem', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:4 }}>{item.label}</div>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', color:item.color }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Formulaire ajout/édition */}
        {showForm && (
          <div className="card">
            <div className="card-title">{editId ? <Edit2 size={16}/> : <Plus size={16}/>} {editId ? 'Modifier' : 'Ajouter'} un employeur</div>

            <div className="form-grid" style={{ marginBottom:20 }}>
              <div className="form-group">
                <label className="form-label">Employeur *</label>
                <input type="text" className="form-input" placeholder="Nom de l'entreprise"
                  value={form.employeur} onChange={e=>setForm(f=>({...f,employeur:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Net imposable (€) * <span className="case-ref">1AJ</span></label>
                <input type="number" className="form-input" placeholder="ex : 35000"
                  value={form.netImposable} onChange={e=>setForm(f=>({...f,netImposable:e.target.value}))}/>
                <span className="form-hint">Cumul annuel sur votre dernière fiche de paie</span>
              </div>
              <div className="form-group">
                <label className="form-label">Prélèvement à la source (€) <span className="case-ref">8HV</span></label>
                <input type="number" className="form-input" placeholder="ex : 2000"
                  value={form.prelSource} onChange={e=>setForm(f=>({...f,prelSource:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input type="text" className="form-input" value={form.notes}
                  onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
              </div>
            </div>

            {/* Mode abattement */}
            <div style={{ height:1, background:'var(--border)', margin:'0 0 20px' }}/>
            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
              Mode d'abattement
            </div>

            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              {[
                { val:'forfaitaire', label:'Abattement forfaitaire 10%', hint:`Min ${eur(bareme?.abattementSalaires?.min)} · Max ${eur(bareme?.abattementSalaires?.max)}` },
                { val:'frais_reels', label:'Frais réels',                hint:'Si supérieurs à l\'abattement forfaitaire' },
              ].map(opt => (
                <label key={opt.val} style={{
                  flex:1, padding:'12px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                  border: form.modeAbattement === opt.val ? '2px solid var(--gold)' : '1px solid var(--border)',
                  background: form.modeAbattement === opt.val ? 'var(--gold-dim)' : 'var(--bg-input)',
                  display:'flex', flexDirection:'column', gap:4,
                }}>
                  <input type="radio" name="modeAbatt" value={opt.val}
                    checked={form.modeAbattement === opt.val}
                    onChange={() => setForm(f => ({...f, modeAbattement: opt.val}))}
                    style={{ display:'none' }}/>
                  <span style={{ fontWeight:500, color: form.modeAbattement === opt.val ? 'var(--gold)' : 'var(--text)', fontSize:'0.875rem' }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>{opt.hint}</span>
                </label>
              ))}
            </div>

            {/* Aperçu abattement en temps réel */}
            {form.netImposable && (
              <div style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:16, fontSize:'0.82rem', display:'flex', gap:16, flexWrap:'wrap' }}>
                <span style={{color:'var(--text-muted)'}}>Forfaitaire : <strong style={{color:'var(--text)'}}>{eur(abattForm.forfaitaire)}</strong></span>
                {form.modeAbattement === 'frais_reels' && (
                  <span style={{color:'var(--text-muted)'}}>Frais réels : <strong style={{color:'var(--text)'}}>{eur(abattForm.totalFraisReels)}</strong></span>
                )}
                <span style={{color:'var(--text-muted)'}}>→ Retenu : <strong style={{color:'var(--gold)'}}>{eur(abattForm.abattementRetenu)}</strong>
                  <span style={{color:'var(--text-dim)', marginLeft:6}}>({abattForm.modeRetenu})</span>
                </span>
                {abattForm.gainFraisReels > 0 && (
                  <span style={{color:'var(--green)'}}>Gain frais réels : +{eur(abattForm.gainFraisReels)}</span>
                )}
              </div>
            )}

            {/* Frais réels détaillés */}
            {form.modeAbattement === 'frais_reels' && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:12 }}>
                  Détail des frais réels
                </div>
                <div className="form-grid">
                  {[
                    { field:'transport',   label:'Transport domicile-travail (€)',  hint:'Véhicule perso (barème km) ou transports en commun' },
                    { field:'repas',       label:'Frais de repas (€)',               hint:'Si repas obligatoire hors domicile' },
                    { field:'formation',   label:'Formation professionnelle (€)',    hint:'Dépenses engagées pour maintenir l\'emploi' },
                    { field:'vetements',   label:'Vêtements de travail (€)',         hint:'Tenues spécifiques obligatoires uniquement' },
                    { field:'doubleResid', label:'Double résidence (€)',             hint:'Si domicile fiscal ≠ lieu de travail pour raison professionnelle' },
                    { field:'autres',      label:'Autres frais (€)',                 hint:'Frais professionnels justifiés' },
                  ].map(({ field, label, hint }) => (
                    <div key={field} className="form-group">
                      <label className="form-label" style={{fontSize:'0.72rem'}}>{label}</label>
                      <input type="number" step="0.01" className="form-input"
                        value={form.fraisReels[field] || ''}
                        onChange={e => updateFrais(field, e.target.value)}/>
                      <span className="form-hint" style={{fontSize:'0.65rem'}}>{hint}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:12, padding:'10px 14px', background:'var(--gold-dim)', border:'1px solid var(--gold)', borderRadius:6, fontSize:'0.82rem' }}>
                  <strong style={{color:'var(--gold)'}}>Total frais réels : {eur(abattForm.totalFraisReels)}</strong>
                  {abattForm.totalFraisReels < abattForm.forfaitaire && (
                    <span style={{color:'var(--text-muted)', marginLeft:12}}>
                      ⚠️ Inférieur au forfaitaire ({eur(abattForm.forfaitaire)}) — l'abattement forfaitaire sera retenu automatiquement
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="btn-group mt-16">
              <button className="btn btn-primary" onClick={handleSave}><Check size={15}/> Enregistrer</button>
              <button className="btn btn-secondary" onClick={()=>{setShowForm(false);setEditId(null);setForm(emptyForm(currentAnnee.id))}}><X size={15}/> Annuler</button>
            </div>
          </div>
        )}

        {!showForm && (
          <div className="mb-16">
            <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditId(null);setForm(emptyForm(currentAnnee.id))}}>
              <Plus size={15}/> Ajouter un employeur
            </button>
          </div>
        )}

        {/* Liste des salaires */}
        {salaires.length === 0
          ? <div className="card"><div className="empty-state"><Briefcase size={40}/><h3>Aucun revenu salarial pour {currentAnnee.annee}</h3></div></div>
          : <div className="card" style={{padding:0}}><div className="table-wrap"><table>
              <thead>
                <tr>
                  <th>Employeur</th>
                  <th className="text-right">Net imposable <span style={{color:'var(--gold)'}}>1AJ</span></th>
                  <th>Abattement</th>
                  <th className="text-right">Revenu imposable</th>
                  <th className="text-right">PAS <span style={{color:'var(--gold)'}}>8HV</span></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {salaires.map(s => {
                  const ab = calculerAbattement(
                    parseFloat(s.netImposable)||0,
                    s.modeAbattement || 'forfaitaire',
                    s.fraisReels || {},
                    bareme?.abattementSalaires
                  )
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.employeur}</strong>
                        {s.notes && <span className="muted" style={{marginLeft:8,fontSize:'0.78rem'}}>{s.notes}</span>}
                      </td>
                      <td className="amount positive">{eur(s.netImposable)}</td>
                      <td>
                        <span className={`badge ${ab.modeRetenu==='frais_reels'?'badge-green':'badge-gold'}`}>
                          {ab.modeRetenu === 'frais_reels' ? 'Frais réels' : '10% forfait'}
                        </span>
                        <span style={{marginLeft:8,fontSize:'0.78rem',color:'var(--text-muted)'}}>{eur(ab.abattementRetenu)}</span>
                      </td>
                      <td className="amount">{eur((parseFloat(s.netImposable)||0) - ab.abattementRetenu)}</td>
                      <td className="amount" style={{color:'var(--gold)'}}>{eur(s.prelSource)}</td>
                      <td>
                        <div className="btn-group" style={{justifyContent:'flex-end'}}>
                          <button className="btn btn-secondary btn-sm" onClick={()=>handleEdit(s)}><Edit2 size={13}/></button>
                          <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(s.id)}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'2px solid var(--border)'}}>
                  <td style={{padding:'12px 14px',fontWeight:600}}>TOTAL</td>
                  <td className="amount positive" style={{fontWeight:700}}>{eur(totalNet)}</td>
                  <td><span style={{fontSize:'0.82rem',color:'var(--text-muted)'}}>− {eur(totalAbattement)}</span></td>
                  <td className="amount" style={{fontWeight:700}}>{eur(irDetail.revenuImposable)}</td>
                  <td className="amount" style={{color:'var(--gold)',fontWeight:700}}>{eur(totalPAS)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table></div></div>
        }

        {/* Cases 2042 */}
        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>Déclaration 2042</div>
          <div className="declaration-box">
            <span className="case-code">1AJ</span>
            <span className="case-label">Salaires, pensions — Déclarant 1</span>
            <span className="case-value">{eur(totalNet)}</span>
          </div>
          <div className="declaration-box">
            <span className="case-code">8HV</span>
            <span className="case-label">Prélèvement à la source versé</span>
            <span className="case-value text-gold">{eur(totalPAS)}</span>
          </div>
          {salaires.some(s => s.modeAbattement === 'frais_reels') && (
            <div className="declaration-box">
              <span className="case-code">1AK</span>
              <span className="case-label">Frais réels (si supérieurs à l'abattement forfaitaire)</span>
              <span className="case-value">{eur(salaires.filter(s=>s.modeAbattement==='frais_reels').reduce((sum,s) => {
                const ab = calculerAbattement(parseFloat(s.netImposable)||0,'frais_reels',s.fraisReels||{},bareme?.abattementSalaires)
                return sum + (ab.modeRetenu === 'frais_reels' ? ab.totalFraisReels : 0)
              }, 0))}</span>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
