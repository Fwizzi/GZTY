import { useApp } from '../context/AppContext'
import { useAnnee } from '../hooks/useAnnee'
import { genererRecapTexte, exporterJSON } from '../services/DeclarationService.js'
import { calculerAbattement } from '../services/fiscal/Calcul2042Service.js'
import { CaseFiscale, CadreFiscal, FormulaireFiscal } from '../components/CaseFiscale.jsx'
import { Copy, Download, Printer, CheckCircle, AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, FileText } from 'lucide-react'
import { exporterXlsx, telechargerXlsx } from '../services/ExportXlsxService.js'
import { imprimerDeclaration } from '../services/ExportPdfService.js'
import { useState } from 'react'

const eur = v => Math.round(parseFloat(v)||0).toLocaleString('fr-FR') + ' €'
const pct = v => ((parseFloat(v)||0)*100).toFixed(1) + ' %'

export default function Declaration() {
  const { currentProfile, currentAnnee } = useApp()
  const { data, loading, error } = useAnnee(currentProfile?.id, currentAnnee?.id)
  const [show2044, setShow2044] = useState(true)
  const [allCopied, setAllCopied] = useState(false)

  if (!currentAnnee) return (
    <div className="page-body"><div className="empty-state"><h3>Sélectionnez une année fiscale</h3></div></div>
  )
  if (loading) return <div className="page-body"><div className="empty-state"><p>Calcul en cours…</p></div></div>
  if (error)   return <div className="page-body"><div className="alert alert-warning">⚠️ {error}</div></div>
  if (!data)   return null

  const { declaration: d, resumeBiens, salaires } = data
  const bareme = currentAnnee.bareme

  // Calcul frais réels pour case 1AK
  const totalFraisReelsDeductibles = salaires.reduce((sum, s) => {
    const ab = calculerAbattement(parseFloat(s.netImposable)||0, s.modeAbattement||'forfaitaire', s.fraisReels||{}, bareme?.abattementSalaires)
    return sum + (ab.modeRetenu === 'frais_reels' ? ab.totalFraisReels : 0)
  }, 0)
  const hasFraisReels = totalFraisReelsDeductibles > 0

  // Checklist
  const checks = [
    { label: 'Revenus salariaux renseignés',           ok: d.totalNetImposable > 0 },
    { label: 'Au moins un bien avec opérations',       ok: resumeBiens.some(b => b.transactions.length > 0) },
    { label: 'Résultat foncier calculé',               ok: d.case4BA !== undefined },
    { label: 'Prélèvement à la source renseigné',      ok: d.totalPAS > 0 },
  ]
  const allOk = checks.every(c => c.ok)

  const handleCopyAll = () => {
    navigator.clipboard.writeText(genererRecapTexte(data)).then(() => {
      setAllCopied(true); setTimeout(() => setAllCopied(false), 2000)
    })
  }

  const handleExportXlsx = async () => {
    try {
      const blob = await exporterXlsx({ ...data, profil: currentProfile })
      const nom = currentProfile?.nom?.replace(/\s+/g,'-') || 'fiscapp'
      telechargerXlsx(blob, `fiscapp-${nom}-${currentAnnee.annee}.xlsx`)
    } catch(e) { alert('Erreur export Excel : ' + e.message) }
  }

  const handleImprimer = () => {
    imprimerDeclaration({ ...data, profil: currentProfile })
  }

  return (
    <>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h2>Déclaration prête</h2>
            <p>Revenus {currentAnnee.annee} — à déposer avant mai {currentAnnee.anneeDeclaration}</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleCopyAll}>
              <Copy size={14}/> {allCopied ? 'Copié !' : 'Tout copier'}
            </button>
            <button className="btn btn-secondary" onClick={handleExportXlsx} title="Export Numbers / Excel">
              <FileSpreadsheet size={14}/> Numbers / Excel
            </button>
            <button className="btn btn-secondary" onClick={handleImprimer} title="Imprimer les formulaires 2044 et 2042">
              <FileText size={14}/> Formulaires PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => exporterJSON(data)} title="Export debug">
              <Download size={12}/> debug
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">

        {/* Checklist */}
        <div className="card" style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            {allOk
              ? <CheckCircle size={18} style={{ color:'var(--green)' }}/>
              : <AlertCircle size={18} style={{ color:'var(--gold)' }}/>
            }
            <span style={{ fontFamily:'var(--font-display)', fontSize:'1rem', color:'var(--text)' }}>
              {allOk ? 'Déclaration prête à compléter' : 'Vérifications en cours'}
            </span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {checks.map((c, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:6, fontSize:'0.78rem',
                padding:'4px 10px', borderRadius:20,
                background: c.ok ? 'rgba(74,222,128,0.08)' : 'rgba(232,184,75,0.08)',
                border: `1px solid ${c.ok ? 'rgba(74,222,128,0.2)' : 'rgba(232,184,75,0.2)'}`,
                color: c.ok ? 'var(--green)' : 'var(--gold)',
              }}>
                {c.ok ? '✓' : '○'} {c.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── FORMULAIRE 2042 ─────────────────────────────── */}
        <FormulaireFiscal
          numero="2042"
          titre="Déclaration des revenus"
          sousTitre={`Revenus ${currentAnnee.annee} — déposée en ${currentAnnee.anneeDeclaration}`}>

          <CadreFiscal titre="Traitements, salaires, pensions et rentes" icone="💼">
            <CaseFiscale
              code="1AJ"
              label="Salaires et pensions — Déclarant 1"
              value={d.totalNetImposable}
              source="Page Salaires"
              color="positive"
              hint="Net imposable annuel figurant sur votre fiche de paie"/>
            {hasFraisReels && (
              <CaseFiscale
                code="1AK"
                label="Frais réels — Déclarant 1"
                value={totalFraisReelsDeductibles}
                source="Page Salaires"
                hint="Total frais réels si supérieurs à l'abattement 10%"/>
            )}
            <CaseFiscale
              code="8HV"
              label="Prélèvement à la source versé — Déclarant 1"
              value={d.totalPAS}
              source="Page Salaires"
              color="gold"
              hint="Total PAS prélevé sur l'année — figurant sur votre avis d'imposition"/>
          </CadreFiscal>

          <CadreFiscal titre="Revenus fonciers" icone="🏠">
            <CaseFiscale
              code="4BA"
              label="Revenus fonciers imposables (bénéfice)"
              value={d.case4BA}
              source="2044 ligne 420"
              color={d.case4BA > 0 ? 'positive' : ''}
              hint="Report depuis la déclaration 2044 — uniquement si bénéfice"/>
            <CaseFiscale
              code="4BB"
              label="Déficit imputable sur les revenus fonciers"
              value={d.case4BB}
              source="2044 ligne 439"
              hint="Part du déficit excédant 10 700 €"/>
            <CaseFiscale
              code="4BC"
              label="Déficit imputable sur le revenu global (max 10 700 €)"
              value={d.case4BC}
              source="2044 ligne 441"
              hint="Part du déficit dans la limite de 10 700 €"/>
            <CaseFiscale
              code="4BD"
              label="Déficits antérieurs non encore imputés"
              value={d.case4BD}
              source="Profil & Années"
              hint="À reporter depuis votre avis d'imposition N-1"/>
          </CadreFiscal>

        </FormulaireFiscal>

        {/* ── FORMULAIRE 2044 ─────────────────────────────── */}
        <div style={{ marginBottom:8 }}>
          <button
            onClick={() => setShow2044(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.82rem', padding:'4px 0' }}>
            {show2044 ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {show2044 ? 'Masquer' : 'Afficher'} le détail 2044
          </button>
        </div>

        {show2044 && resumeBiens.map(({ bien, r2044 }) => (
          <FormulaireFiscal
            key={bien.id}
            numero="2044"
            titre={`Propriétés et revenus fonciers — ${bien.nom}`}
            sousTitre="Pages 2/3 et page 4">

            <CadreFiscal titre="Recettes" icone="📥">
              <CaseFiscale
                code="211 / 215 (E)"
                label="Loyers bruts encaissés — Total des recettes"
                value={r2044.ligne215}
                color="positive"
                hint="Total des loyers perçus dans l'année. Les charges récupérables payées par le locataire sont fiscalement transparentes et n'apparaissent pas ici."/>
            </CadreFiscal>

            <CadreFiscal titre="Frais et charges (lignes 220–230)" icone="📤">
              {r2044.ligne221 > 0 && (
                <CaseFiscale code="221" label="Frais d'administration et de gestion" value={r2044.ligne221}/>
              )}
              <CaseFiscale
                code="222"
                label={`Autres frais de gestion (forfait ${bareme?.forfaitFraisGestion || 20} € × ${r2044.nbLocaux} local)`}
                value={r2044.ligne222}
                hint="Forfait légal — 20 € par local, déductible automatiquement"/>
              {r2044.ligne223 > 0 && (
                <CaseFiscale code="223" label="Primes d'assurances (PNO, GLI…)" value={r2044.ligne223}/>
              )}
              {r2044.ligne224 > 0 && (
                <CaseFiscale code="224" label="Dépenses de réparation et d'entretien (travaux)" value={r2044.ligne224}/>
              )}
              {r2044.ligne224b > 0 && (
                <CaseFiscale code="224b (K)" label="Travaux rénovation énergétique (passage EFG→ABCD)" value={r2044.ligne224b}/>
              )}
              {r2044.ligne227 > 0 && (
                <>
                  <CaseFiscale code="227" label="Taxe foncière (hors ordures ménagères)" value={r2044.ligne227}/>
                  {r2044.hasTaxeFonciere && (
                    <div style={{ padding:'6px 24px 8px', fontSize:'0.72rem', color:'var(--warning-text)', background:'var(--warning-bg)', borderBottom:'1px solid var(--border-subtle)' }}>
                      ⚠️ <strong>TEOM :</strong> si votre avis de taxe foncière inclut la taxe d'enlèvement des ordures ménagères (TEOM),
                      celle-ci est récupérable sur votre locataire à 100% et ne doit pas figurer ligne 227.
                      Déduisez-la du montant saisi.
                    </div>
                  )}
                </>
              )}
              <CaseFiscale
                code="229"
                label="Provisions pour charges de copropriété"
                value={r2044.ligne229}
                source="Page Copropriété"
                hint="Appels de fonds versés au syndic dans l'année"/>
              {r2044.ligne230 !== 0 && (
                <CaseFiscale
                  code="230"
                  label="Régularisation provisions copropriété N-1"
                  value={r2044.ligne230}
                  source="Page Copropriété"
                  color={r2044.ligne230 > 0 ? 'positive' : ''}
                  hint="Charges non déductibles + récupérables de l'exercice clos en N-1"/>
              )}
              <CaseFiscale
                code="240 (F)"
                label="Total des charges (lignes 221 à 229 − 230)"
                value={r2044.ligne240}
                hint="Somme de toutes les charges déductibles"/>
            </CadreFiscal>

            <CadreFiscal titre="Intérêts d'emprunt (ligne 250)" icone="🏦">
              <CaseFiscale
                code="250 (G)"
                label="Intérêts d'emprunt et assurances emprunt"
                value={r2044.ligne250}
                source="Page Copropriété / Journal"
                hint="Total intérêts + assurances emprunt de l'année"/>
            </CadreFiscal>

            <CadreFiscal titre="Résultat (lignes 261–263)" icone="📊">
              <CaseFiscale
                code="261"
                label="Revenus fonciers taxables (215 − 240 − 250)"
                value={r2044.ligne261}
                hint="Calcul automatique"/>
              <CaseFiscale
                code="263 (I)"
                label={r2044.ligne263 >= 0 ? "Bénéfice foncier" : "Déficit foncier"}
                value={r2044.ligne263}
                color={r2044.ligne263 >= 0 ? 'positive' : 'negative'}
                hint="À reporter en page 4 — contribue à la case 420"/>
            </CadreFiscal>

            <CadreFiscal titre="Page 4 — Résultat global" icone="📋">
              <CaseFiscale
                code="420"
                label="Bénéfice ou déficit total (case D + case I)"
                value={r2044.ligne263}
                color={r2044.ligne263 >= 0 ? 'positive' : 'negative'}
                hint="À reporter case 4BA de la déclaration 2042"/>
            </CadreFiscal>

          </FormulaireFiscal>
        ))}

        {/* ── SIMULATION IR ───────────────────────────────── */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>Estimation de l'impôt dû</div>

          <div className="simulation-grid">
            {[
              { label:'Revenu imposable total',               val: eur(d.revenuTotal),             color:'var(--text)' },
              { label:'TMI (tranche marginale)',               val: pct(d.tmi),                     color:'var(--gold)' },
              { label:'IR net sur salaires seuls',            val: eur(d.irNetSalaires),           color:'var(--text)' },
              ...(d.decotePerdue > 0 ? [{ label:'Dont perte de décote (foncier)',   val: eur(d.decotePerdue),            color:'var(--red)'  }] : []),
              { label:'IR supplémentaire (foncier)',          val: eur(d.irSupp),                  color:'var(--red)'  },
              { label:'Prélèvements sociaux 17,2% (foncier)', val: eur(d.prelSociaux),             color:'var(--red)'  },
              { label:'Total impôts foncier',                 val: eur(d.totalImpotsFoncier),      color:'var(--red)'  },
              { label:'PAS déjà prélevé (déduit)',            val: `− ${eur(d.totalPAS)}`,         color:'var(--green)'},
              { label:'Solde estimé à payer',                 val: eur(d.impotRestantDu),          color: d.impotRestantDu > 0 ? 'var(--red)' : 'var(--green)', total:true },
            ].map((row, i) => (
              <div key={i} className={`simulation-row ${row.total ? 'total' : ''}`}>
                <span className="simulation-label">{row.label}</span>
                <span className="simulation-value" style={{ color: row.color }}>{row.val}</span>
              </div>
            ))}
          </div>

          {d.alerteDecotePerdue && (
            <div className="alert alert-warning" style={{ marginTop:12 }}>
              ⚠️ <strong>Décote perdue :</strong> vos revenus fonciers ({eur(d.case4BA)}) font passer votre IR au-dessus du seuil de décote.
              Vous perdez {eur(d.decotePerdue)} de décote que vous auriez eu sur vos salaires seuls.
              Cet impact est inclus dans le calcul ci-dessus.
            </div>
          )}
          <div className="alert alert-warning" style={{ marginTop:12 }}>
            ⚠️ Simulation indicative basée sur le barème {currentAnnee.annee}. Vérifiez sur <strong>impots.gouv.fr</strong> avant de valider votre déclaration.
          </div>
        </div>

      </div>
    </>
  )
}
