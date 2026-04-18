import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { BienRepo, BienAnneeRepo } from '../db/repositories/index.js'
import {
  genererExercices,
  calculerLigne230,
  calculerLigne230AnneeCivile,
  calculerFinExercice,
  estExerciceAnneeCivile,
  formaterProrata,
} from '../services/fiscal/CoproService.js'
import { Check, Building2, Plus, Trash2, Info, AlertCircle } from 'lucide-react'

const eur = v => (parseFloat(v)||0).toLocaleString('fr-FR', { minimumFractionDigits:2 }) + ' €'
const exVide = () => ({ chargesPayees:'', dontNonDeduct:'', dontRecup:'', provisionsDeduites:'' })

export default function Copropriete() {
  const { currentProfile, currentAnnee } = useApp()
  const [biens, setBiens]           = useState([])
  const [bienAnnees, setBienAnnees] = useState({})
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!currentProfile || !currentAnnee) return
    const load = async () => {
      setLoading(true)
      const bs = await BienRepo.findByProfile(currentProfile.id)
      setBiens(bs)
      const map = {}
      for (const b of bs) {
        const ba = await BienAnneeRepo.getOrCreate(b.id, currentAnnee.id)
        if ((b.coproDebutJjMm || b.coproFinJjMm) && !ba.copro?.debutJjMm) {
          const updated = await BienAnneeRepo.save({
            ...ba,
            copro: { ...ba.copro, debutJjMm: b.coproDebutJjMm, finJjMm: b.coproFinJjMm }
          })
          map[b.id] = updated
        } else {
          map[b.id] = ba
        }
      }
      setBienAnnees(map)
      setLoading(false)
    }
    load()
  }, [currentProfile?.id, currentAnnee?.id])

  const handleSave = async (bienId, updates) => {
    const ba = bienAnnees[bienId]
    if (!ba) return
    const saved = await BienAnneeRepo.save({ ...ba, ...updates })
    setBienAnnees(prev => ({ ...prev, [bienId]: saved }))
  }

  if (!currentAnnee) return (
    <div className="page-body"><div className="empty-state"><h3>Sélectionnez une année fiscale</h3></div></div>
  )

  return (
    <>
      <div className="page-header">
        <h2>Copropriété</h2>
        <p>Décomptes syndic {currentAnnee.annee} — calcul automatique lignes 229 et 230</p>
      </div>
      <div className="page-body">
        <div className="alert alert-info">
          <Info size={15} style={{ flexShrink:0, marginTop:2 }}/>
          <div>
            Les deux exercices se partagent l'année <strong>{currentAnnee.annee - 1}</strong>.
            Le prorata est calculé en jours exacts sur {currentAnnee.annee - 1}.
            Configurez le format d'exercice (JJ/MM) dans <strong>Paramètres → Biens immobiliers</strong>.
          </div>
        </div>

        {loading
          ? <div className="empty-state"><p>Chargement…</p></div>
          : biens.length === 0
            ? <div className="card"><div className="empty-state"><Building2 size={40}/><h3>Aucun bien</h3></div></div>
            : biens.map(bien => (
                <BienCoproForm
                  key={bien.id}
                  bien={bien}
                  bienAnnee={bienAnnees[bien.id]}
                  annee={currentAnnee.annee}
                  onSave={updates => handleSave(bien.id, updates)}
                />
              ))
        }
      </div>
    </>
  )
}

function BienCoproForm({ bien, bienAnnee, annee, onSave }) {
  const [ex1Data,  setEx1Data]  = useState(exVide())
  const [ex2Data,  setEx2Data]  = useState(exVide())
  const [nbLocaux, setNbLocaux] = useState(1)
  const [prets,    setPrets]    = useState([])
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    if (!bienAnnee) return
    const copro = bienAnnee.copro || {}
    setEx1Data(copro.exercice1Data && Object.keys(copro.exercice1Data).length ? copro.exercice1Data : exVide())
    setEx2Data(copro.exercice2Data && Object.keys(copro.exercice2Data).length ? copro.exercice2Data : exVide())
    setNbLocaux(bienAnnee.nbLocaux || 1)
    setPrets(bienAnnee.prets || [])
  }, [bienAnnee])

  const debutJjMm = bien.coproDebutJjMm || bienAnnee?.copro?.debutJjMm || ''
  const finJjMm   = bien.coproFinJjMm   || bienAnnee?.copro?.finJjMm   || ''

  // Détecter cas exercice = année civile
  const isAnneeCivile = estExerciceAnneeCivile(debutJjMm, finJjMm)

  // Générer les dates des exercices
  const exercicesDates = (!isAnneeCivile && debutJjMm && finJjMm)
    ? genererExercices(debutJjMm, finJjMm, annee)
    : null

  // Calcul en temps réel
  const toNum = data => ({
    chargesPayees:      parseFloat(data.chargesPayees)      || 0,
    dontNonDeduct:      parseFloat(data.dontNonDeduct)      || 0,
    dontRecup:          parseFloat(data.dontRecup)          || 0,
    provisionsDeduites: data.provisionsDeduites != null && data.provisionsDeduites !== ''
      ? parseFloat(data.provisionsDeduites)
      : null,   // null = fallback prorata dans CoproService
  })

  const resultat = isAnneeCivile
    ? calculerLigne230AnneeCivile(toNum(ex1Data), annee)
    : exercicesDates
      ? calculerLigne230(toNum(ex1Data), toNum(ex2Data), exercicesDates, annee)
      : null

  const handleSaveForm = async () => {
    await onSave({
      nbLocaux, prets,
      copro: {
        debutJjMm, finJjMm,
        exercice1Data: ex1Data,
        exercice2Data: isAnneeCivile ? exVide() : ex2Data,
      }
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const upd = (setter, field, val) => setter(prev => ({ ...prev, [field]: val }))
  const addPret    = () => setPrets(p => [...p, { id:crypto.randomUUID(), nom:'', interets:0, assurance:0 }])
  const removePret = i  => setPrets(p => p.filter((_,idx) => idx !== i))
  const updPret    = (i, f, v) => setPrets(p => { const ps=[...p]; ps[i]={...ps[i],[f]:f==='nom'?v:parseFloat(v)||0}; return ps })

  const anneeRef = annee - 1

  return (
    <div className="card">
      <div className="card-title"><Building2 size={18}/> {bien.nom}</div>

      {/* Indicateur format exercice */}
      {debutJjMm && finJjMm ? (
        <div style={{ marginBottom:20, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Format exercice :</span>
          <span className="badge badge-gold">{debutJjMm} → {finJjMm}</span>
          {isAnneeCivile ? (
            <span className="badge badge-blue">Exercice = Année civile → 1 seule colonne</span>
          ) : exercicesDates ? (
            <>
              <span className="badge badge-blue">{exercicesDates.exercice1.label}</span>
              <span className="badge badge-blue">{exercicesDates.exercice2.label}</span>
              <span style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>
                Proratas calculés sur {anneeRef} ({anneeRef % 4 === 0 && (anneeRef % 100 !== 0 || anneeRef % 400 === 0) ? '366 jours — bissextile' : '365 jours'})
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <div className="alert alert-warning" style={{ marginBottom:20 }}>
          <AlertCircle size={14} style={{ flexShrink:0 }}/>
          <span>Format d'exercice non configuré — rendez-vous dans <strong>Paramètres → Biens immobiliers</strong>.</span>
        </div>
      )}

      {/* Saisie des exercices */}
      {(exercicesDates || isAnneeCivile) && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
            Montants des décomptes syndic
          </div>

          <div style={{ display:'grid', gridTemplateColumns: isAnneeCivile ? '1fr' : '1fr 1fr', gap:16 }}>
            {/* Exercice 1 (ou unique si année civile) */}
            <ExerciceColonne
              label={isAnneeCivile
                ? `01/01/${anneeRef} → 31/12/${anneeRef}`
                : exercicesDates?.exercice1.label}
              anneeRef={anneeRef}
              data={ex1Data}
              setter={setEx1Data}
              part={resultat?.part1}
              isAnneeCivile={isAnneeCivile}
              upd={upd}
            />

            {/* Exercice 2 (seulement si pas année civile) */}
            {!isAnneeCivile && exercicesDates && (
              <ExerciceColonne
                label={exercicesDates.exercice2.label}
                anneeRef={anneeRef}
                data={ex2Data}
                setter={setEx2Data}
                part={resultat?.part2}
                isAnneeCivile={false}
                upd={upd}
              />
            )}
          </div>

          {/* Résultat global */}
          {resultat && (
            <ResultatCopro
              resultat={resultat}
              annee={annee}
              anneeRef={anneeRef}
              isAnneeCivile={isAnneeCivile}
            />
          )}
        </div>
      )}

      {/* Prêts */}
      <div style={{ marginBottom:20 }}>
        <div className="flex-between mb-16">
          <div style={{ fontFamily:'var(--font-display)', fontSize:'0.95rem', color:'var(--gold)' }}>Prêts immobiliers</div>
          <button className="btn btn-secondary btn-sm" onClick={addPret}><Plus size={13}/> Ajouter</button>
        </div>
        {prets.length === 0
          ? <p style={{ fontSize:'0.82rem', color:'var(--text-dim)' }}>Saisissez les intérêts via le journal ou centralisez-les ici.</p>
          : prets.map((p, i) => (
            <div key={p.id||i} style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:14, marginBottom:10 }}>
              <div className="flex-between" style={{ marginBottom:10 }}>
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Prêt {i+1}</span>
                <button className="btn btn-danger btn-sm" onClick={() => removePret(i)}><Trash2 size={12}/></button>
              </div>
              <div className="form-grid" style={{ gridTemplateColumns:'2fr 1fr 1fr' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize:'0.68rem' }}>Organisme</label>
                  <input type="text" className="form-input" placeholder="ex : CIC" value={p.nom||''} onChange={e=>updPret(i,'nom',e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize:'0.68rem' }}>Intérêts (€)</label>
                  <input type="number" step="0.01" className="form-input" value={p.interets||''} onChange={e=>updPret(i,'interets',e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize:'0.68rem' }}>Assurance (€)</label>
                  <input type="number" step="0.01" className="form-input" value={p.assurance||''} onChange={e=>updPret(i,'assurance',e.target.value)}/>
                </div>
              </div>
            </div>
          ))
        }
        {prets.length > 0 && (
          <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
            Total ligne 250 : <strong style={{ color:'var(--gold)' }}>
              {eur(prets.reduce((s,p)=>s+(p.interets||0)+(p.assurance||0),0))}
            </strong>
          </div>
        )}
      </div>

      {/* Nb locaux */}
      <div className="form-group" style={{ maxWidth:200, marginBottom:20 }}>
        <label className="form-label">Nombre de locaux</label>
        <input type="number" min="1" className="form-input" value={nbLocaux}
          onChange={e=>setNbLocaux(parseInt(e.target.value)||1)}/>
        <span className="form-hint">Forfait 20€/local → ligne 222</span>
      </div>

      <button className="btn btn-primary" onClick={handleSaveForm}>
        {saved ? <><Check size={15}/> Sauvegardé !</> : <><Check size={15}/> Enregistrer</>}
      </button>
    </div>
  )
}

// ── Colonne d'un exercice ─────────────────────────────────────

function ExerciceColonne({ label, anneeRef, data, setter, part, isAnneeCivile, upd }) {
  return (
    <div style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:16 }}>
      <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text)', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:12 }}>
        {isAnneeCivile ? `Exercice complet ${anneeRef} — prorata = 100%` : `Prorata calculé sur ${anneeRef}`}
      </div>

      {/* Prorata en temps réel */}
      {part && part.prorata > 0 && (
        <div style={{ background:'var(--gold-dim)', borderRadius:6, padding:'5px 10px', marginBottom:12, fontSize:'0.73rem' }}>
          <span style={{ color:'var(--gold)', fontWeight:600 }}>
            {isAnneeCivile ? 'Prorata : 100%' : `Prorata ${anneeRef} : `}
          </span>
          {!isAnneeCivile && (
            <span style={{ color:'var(--text)' }}>
              {part.jours}j / {part.joursAnnee}j = {(part.prorata * 100).toFixed(4)}%
            </span>
          )}
          {part.portionDebut && part.portionFin && !isAnneeCivile && (
            <div style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:3 }}>
              {part.portionDebut} → {part.portionFin}
            </div>
          )}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {[
          { field:'chargesPayees',     label:'Charges totales de l\'exercice (€)',       hint:'Montant total du décompte définitif du syndic' },
          { field:'dontNonDeduct',     label:'Dont non déductibles (€)',                  hint:'Travaux d\'amélioration, agrandissement…' },
          { field:'dontRecup',         label:'Dont récupérables (€)',                     hint:'TEOM, eau, entretien parties communes…' },
          { field:'provisionsDeduites',label:'Provisions déduites en N-1 pour cet exercice (€)',
            hint:'Montant passé en ligne 229 l\'an dernier pour cet exercice. Si vide, estimation par prorata utilisée.' },
        ].map(({ field, label, hint }) => (
          <div key={field} className="form-group">
            <label className="form-label" style={{ fontSize:'0.68rem' }}>{label}</label>
            <input type="number" step="0.01" className="form-input"
              value={data[field]} onChange={e => upd(setter, field, e.target.value)}
              style={field==='provisionsDeduites' ? {borderStyle:'dashed'} : {}}/>
            {hint && <span className="form-hint" style={{ fontSize:'0.65rem' }}>{hint}</span>}
          </div>
        ))}

        {/* Détail du calcul ligne 230 */}
        {part && part.chargesExercice > 0 && (
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, fontSize:'0.75rem', display:'flex', flexDirection:'column', gap:4 }}>
            {/* Taux de non-déductibilité */}
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--text-muted)' }}>Non déductibles + récupérables</span>
              <span style={{ color:'var(--text)' }}>{eur((part.nonDeductTotal||0))}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--text-muted)' }}>Taux non déductible</span>
              <span style={{ color:'var(--text)' }}>{(part.tauxNonDeductible||0).toFixed(2)} %</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--text-muted)' }}>
                Provisions déduites{part.fallbackUtilise ? ' (estimées ⚠️)' : ''}
              </span>
              <span style={{ color: part.fallbackUtilise ? 'var(--warning-text)' : 'var(--text)' }}>
                {eur(part.provisionsDeduites||0)}
              </span>
            </div>
            {/* Formule */}
            <div style={{ fontSize:'0.65rem', color:'var(--text-tertiary)', fontStyle:'italic', margin:'2px 0' }}>
              = provisions × taux non déductible
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:600, borderTop:'1px solid var(--border)', paddingTop:6 }}>
              <span style={{ color:'var(--text-muted)' }}>→ À réintégrer (ligne 230)</span>
              <span style={{ color: (part.aReintegrer||0) > 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                {eur(part.aReintegrer||0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Résultat global 229/230 ───────────────────────────────────

function ResultatCopro({ resultat, annee, anneeRef, isAnneeCivile }) {
  if (!resultat) return null
  return (
    <div style={{ marginTop:16 }}>
      {resultat.alertes.map((a, i) => (
        <div key={i} className={`alert ${a.startsWith('⚠️') ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom:8 }}>{a}</div>
      ))}

      {/* Vérification cohérence prorata */}
      {!isAnneeCivile && (
        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textAlign:'right', marginBottom:10 }}>
          {resultat.part1 && `Ex.1 sur ${anneeRef} : ${(resultat.part1.prorata * 100).toFixed(4)}%`}
          {resultat.part1 && resultat.part2 && ' + '}
          {resultat.part2 && `Ex.2 sur ${anneeRef} : ${(resultat.part2.prorata * 100).toFixed(4)}%`}
          {' = '}
          <strong style={{ color: Math.abs(resultat.totalProrata - 1) < 0.001 ? 'var(--green)' : 'var(--red)' }}>
            {(resultat.totalProrata * 100).toFixed(4)}% {Math.abs(resultat.totalProrata - 1) < 0.001 ? '✓' : '⚠️'}
          </strong>
        </div>
      )}

      <div style={{ background:'var(--bg-card)', border:'2px solid var(--brand-primary)', borderRadius:'var(--radius-sm)', padding:16 }}>
          <div className="kpi-label">Ligne 230 — Montant à réintégrer</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', color: resultat.ligne230 > 0 ? 'var(--danger-text)' : 'var(--success-text)', marginTop:4 }}>
            {eur(resultat.ligne230)}
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:6, lineHeight:1.5 }}>
            = (récupérables + non déductibles) × prorata<br/>
            <span style={{ color:'var(--text-tertiary)' }}>
              Vos provisions ligne 229 sont dans le journal (catégorie charges copro).
              La ligne 230 vient en déduction du total des charges.
            </span>
          </div>
        </div>
    </div>
  )
}
