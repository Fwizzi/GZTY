import { useApp } from '../context/AppContext'
import { useAnnee } from '../hooks/useAnnee'
import { genererRecapTexte, exporterJSON } from '../services/DeclarationService'
import { Alert, ProgressSteps, StatRow, Amount } from '../components/UI.jsx'
import { Copy, Download, TrendingUp, Home, Briefcase, FileText, ArrowRight, Plus } from 'lucide-react'

const pct = v => ((parseFloat(v) || 0) * 100).toFixed(0) + ' %'

export default function Dashboard() {
  const { currentProfile, currentAnnee, anneesFiscales, ouvrirAnnee, setCurrentAnnee } = useApp()
  const { data, loading, error } = useAnnee(currentProfile?.id, currentAnnee?.id)

  // ── Pas de profil ─────────────────────────────────────────
  if (!currentProfile) return null

  // ── Pas d'année ───────────────────────────────────────────
  if (!currentAnnee) return (
    <>
      <div className="page-header">
        <h2 className="page-title">Tableau de bord</h2>
        <p className="page-subtitle">Bienvenue, {currentProfile.nom}. Commencez par créer une année fiscale.</p>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="empty-state">
            <FileText size={40} className="empty-state-icon"/>
            <h3>Aucune année fiscale</h3>
            <p>Créez votre première année pour démarrer votre déclaration.</p>
            <div className="btn-group" style={{ justifyContent:'center' }}>
              {[2024, 2025, 2026].map(a => (
                <button key={a} className="btn btn-primary" onClick={() => ouvrirAnnee(a)}>
                  <Plus size={14}/> Année {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (loading) return (
    <>
      <div className="page-header">
        <h2 className="page-title">Tableau de bord</h2>
        <p className="page-subtitle">Calcul en cours…</p>
      </div>
      <div className="page-body">
        <div className="card"><div className="empty-state"><p>Chargement des données…</p></div></div>
      </div>
    </>
  )

  if (error) return (
    <div className="page-body">
      <Alert type="danger">{error}</Alert>
    </div>
  )

  if (!data) return null

  const { declaration: d, resumeBiens, salaires } = data
  const annee = currentAnnee.annee

  // Étapes de complétion
  const steps = [
    { label: 'Revenus salariaux renseignés', done: d.totalNetImposable > 0 },
    { label: 'Au moins un bien et des opérations', done: resumeBiens.some(b => b.transactions.length > 0) },
    { label: 'Prélèvement à la source renseigné', done: d.totalPAS > 0 },
    { label: 'Résultat foncier calculé', done: d.revenusFonciersBruts !== undefined },
  ]

  const handleCopy = () => {
    navigator.clipboard.writeText(genererRecapTexte(data)).then(() => alert('Récapitulatif copié !'))
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h2 className="page-title">Bonjour, {currentProfile.nom.split(' ')[0]} 👋</h2>
            <p className="page-subtitle">
              Votre situation fiscale pour <strong>{annee}</strong> — déclaration à déposer en {currentAnnee.anneeDeclaration}
            </p>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={handleCopy}><Copy size={14}/> Copier le récapitulatif</button>
            <button className="btn btn-secondary" onClick={() => exporterJSON(data)} title="Exporte les résultats de calcul (debug)"><Download size={14}/> Résultats (debug)</button>
          </div>
        </div>
      </div>

      <div className="page-body">

        {/* KPIs principaux */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">💼 Revenus salariaux</div>
            <div className="kpi-value">{Math.round(d.totalNetImposable).toLocaleString('fr-FR')} €</div>
            <div className="kpi-sub">Net imposable — case 1AJ</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">🏠 Résultat foncier net</div>
            <div className={`kpi-value ${d.case4BA > 0 ? 'positive' : d.case4BB > 0 || d.case4BC > 0 ? 'negative' : ''}`}>
              {Math.round(d.revenusFonciersBruts).toLocaleString('fr-FR')} €
            </div>
            <div className="kpi-sub">{d.case4BA > 0 ? 'Bénéfice → case 4BA' : 'Déficit → cases 4BB/4BC'}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">📊 Tranche marginale</div>
            <div className="kpi-value brand">{pct(d.tmi)}</div>
            <div className="kpi-sub">Sur vos derniers euros</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">💰 Impôts sur le foncier</div>
            <div className="kpi-value negative">{Math.round(d.totalImpotsFoncier).toLocaleString('fr-FR')} €</div>
            <div className="kpi-sub">IR + prél. sociaux 17,2%</div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'var(--space-5)', alignItems:'start' }}>

          {/* Colonne gauche */}
          <div>
            {/* Cases à déclarer */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><FileText size={18} className="card-title-icon"/> Cases à reporter dans votre déclaration</div>
                <span className="badge badge-brand">2042</span>
              </div>
              <p style={{ fontSize:'0.82rem', color:'var(--text-tertiary)', marginBottom:'var(--space-4)' }}>
                Cliquez sur une case pour copier sa valeur — puis collez-la sur <strong>impots.gouv.fr</strong>
              </p>
              {[
                { code:'4BA', label:'Revenus fonciers (bénéfice)', val: d.case4BA, color: d.case4BA > 0 ? 'var(--success-text)' : undefined },
                { code:'4BB', label:'Déficit revenus fonciers', val: d.case4BB },
                { code:'4BC', label:'Déficit revenu global', val: d.case4BC },
                { code:'4BD', label:'Déficits antérieurs', val: d.case4BD },
              ].map(c => (
                <div key={c.code}
                  className="case-fiscale"
                  onClick={() => navigator.clipboard.writeText(String(Math.round(parseFloat(c.val)||0)))}
                  title="Cliquer pour copier">
                  <span className="case-fiscale-code">{c.code}</span>
                  <span className="case-fiscale-label">{c.label}</span>
                  <span className="case-fiscale-montant" style={{ color: c.color }}>{Math.round(parseFloat(c.val)||0).toLocaleString('fr-FR')} €</span>
                </div>
              ))}
            </div>

            {/* Détail par bien */}
            {resumeBiens.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title"><Home size={18} className="card-title-icon"/> Vos biens immobiliers</div>
                </div>
                {resumeBiens.map(({ bien, r2044 }) => (
                  <div key={bien.id} style={{ marginBottom:'var(--space-5)', paddingBottom:'var(--space-5)', borderBottom:'1px solid var(--border-subtle)' }}>
                    <div className="flex-between mb-4">
                      <span style={{ fontWeight:500, color:'var(--text-primary)', fontSize:'0.9rem' }}>{bien.nom}</span>
                      <Amount value={r2044.resultatFoncier} size="md"/>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'var(--space-2)' }}>
                      {[
                        { label:'Loyers', val: r2044.ligne215, color:'var(--success-text)' },
                        { label:'Charges', val: -r2044.ligne240 },
                        { label:'Intérêts', val: -r2044.ligne250 },
                      ].map((item, i) => (
                        <div key={i} style={{ background:'var(--bg-hover)', borderRadius:'var(--radius-sm)', padding:'8px 10px' }}>
                          <div style={{ fontSize:'0.65rem', color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>{item.label}</div>
                          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem', fontWeight:600, color: item.color || 'var(--text-primary)' }}>
                            {Math.round(parseFloat(item.val)||0).toLocaleString('fr-FR')} €
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Colonne droite — simulation + progression */}
          <div>
            {/* Progression */}
            <div className="card">
              <div className="card-header" style={{ marginBottom:'var(--space-4)' }}>
                <div className="card-title">Avancement</div>
              </div>
              <ProgressSteps steps={steps}/>
              {steps.every(s => s.done) && (
                <div className="mt-4">
                  <Alert type="success">
                    Toutes les sections sont remplies. Votre déclaration est prête !
                  </Alert>
                </div>
              )}
            </div>

            {/* Simulation impôt */}
            <div className="card">
              <div className="card-header" style={{ marginBottom:'var(--space-4)' }}>
                <div className="card-title"><TrendingUp size={16} className="card-title-icon"/> Simulation impôt</div>
              </div>

              <StatRow label="Revenu total imposable"    value={`${Math.round(d.revenuTotal).toLocaleString('fr-FR')} €`}/>
              <StatRow label="IR sur salaires seuls"     value={`${Math.round(d.irNetSalaires).toLocaleString('fr-FR')} €`}/>
              <StatRow label="IR supplémentaire foncier" value={`${Math.round(d.irSupp).toLocaleString('fr-FR')} €`}       color="var(--danger-text)"/>
              <StatRow label="Prélèvements sociaux"      value={`${Math.round(d.prelSociaux).toLocaleString('fr-FR')} €`}  color="var(--danger-text)"/>
              <StatRow label="PAS déjà prélevé"          value={`− ${Math.round(d.totalPAS).toLocaleString('fr-FR')} €`}   color="var(--success-text)"/>

              <div style={{ marginTop:'var(--space-4)', padding:'var(--space-3) var(--space-4)', background: d.impotRestantDu > 0 ? 'var(--danger-bg)' : 'var(--success-bg)', borderRadius:'var(--radius)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'0.85rem', fontWeight:500, color: d.impotRestantDu > 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                  Solde estimé à payer
                </span>
                <Amount value={d.impotRestantDu} size="lg" color={d.impotRestantDu > 0 ? 'var(--danger-text)' : 'var(--success-text)'}/>
              </div>

              <p style={{ fontSize:'0.72rem', color:'var(--text-tertiary)', marginTop:'var(--space-3)', lineHeight:1.4 }}>
                ⚠️ Estimation indicative. Vérifiez sur impots.gouv.fr avant validation.
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
