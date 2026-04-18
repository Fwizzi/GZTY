import {
  AnneeFiscaleRepo, BienRepo, BienAnneeRepo,
  TransactionRepo, RevenuSalarialRepo, RevenuSCPIRepo,
} from '../db/repositories/index.js'
import { agregerTransactions, calculer2044 } from './fiscal/Calcul2044Service.js'
import { calculer2042, calculerAbattement } from './fiscal/Calcul2042Service.js'

export async function chargerDeclaration(profileId, anneeFiscaleId) {
  const anneeFiscale = await AnneeFiscaleRepo.findById(anneeFiscaleId)
  if (!anneeFiscale) throw new Error(`AnneeFiscale ${anneeFiscaleId} introuvable`)
  const annee = anneeFiscale.annee

  const biens = await BienRepo.findByProfile(profileId)
  const resumeBiens = []

  for (const bien of biens) {
    const bienAnnee = await BienAnneeRepo.findByBienEtAnnee(bien.id, anneeFiscaleId)
    if (!bienAnnee) continue
    const transactions = await TransactionRepo.findByBienAnnee(bienAnnee.id)
    const agg    = agregerTransactions(transactions)
    const r2044  = calculer2044(agg, { ...bienAnnee, annee }, annee, anneeFiscale.bareme)
    resumeBiens.push({ bien, bienAnnee, transactions, agg, r2044 })
  }

  const salaires = await RevenuSalarialRepo.findByAnnee(anneeFiscaleId)
  const totalNetImposable = salaires.reduce((s, x) => s + (parseFloat(x.netImposable)||0), 0)
  const totalPAS          = salaires.reduce((s, x) => s + (parseFloat(x.prelSource)||0), 0)

  // CORRECTION anomalie 4 : abattement calculé sur le cumul global
  // Le plafond (ex: 14 426 €) s'applique PAR SALARIÉ, pas par employeur.
  // Un salarié ayant 2 employeurs ne peut pas dépasser le plafond.
  // Règle du mode : si au moins un employeur est en frais réels,
  // on cumule tous les frais réels déclarés (le salarié choisit un seul mode).
  const hasFraisReels = salaires.some(s => s.modeAbattement === 'frais_reels')
  const fraisReelsCumules = salaires.reduce((acc, s) => {
    if (s.modeAbattement !== 'frais_reels') return acc
    Object.entries(s.fraisReels || {}).forEach(([k, v]) => {
      acc[k] = (acc[k] || 0) + (parseFloat(v) || 0)
    })
    return acc
  }, {})
  const { abattementRetenu: totalAbattement } = calculerAbattement(
    totalNetImposable,
    hasFraisReels ? 'frais_reels' : 'forfaitaire',
    fraisReelsCumules,
    anneeFiscale.bareme?.abattementSalaires
  )

  const scpis        = await RevenuSCPIRepo.findByAnnee(anneeFiscaleId)
  const revenusSCPI  = scpis.filter(s => s.typeRevenu === 'foncier')
    .reduce((s, x) => s + (parseFloat(x.revenusNets)||0), 0)

  // Récupérer situation et nbParts depuis le profil
  const { ProfileRepo } = await import('../db/repositories/index.js')
  const profil    = await ProfileRepo.findById(profileId)
  const nbParts   = profil?.nbParts   || 1
  const situation = profil?.situation || 'Célibataire'

  const declaration = calculer2042(
    anneeFiscale,
    resumeBiens.map(b => b.r2044),
    revenusSCPI,
    totalNetImposable,
    totalAbattement,
    totalPAS,
    nbParts,
    situation,
  )

  return { anneeFiscale, resumeBiens, salaires, scpis, declaration, totalNetImposable, totalAbattement, totalPAS, revenusSCPI }
}

export function genererRecapTexte(data) {
  const { anneeFiscale, declaration: d, totalNetImposable } = data
  const annee = anneeFiscale.annee
  const eur = v => Math.round(parseFloat(v)||0).toLocaleString('fr-FR') + ' €'
  const pct = v => ((parseFloat(v)||0)*100).toFixed(1) + ' %'
  return [
    `RÉCAPITULATIF FISCAL ${annee}`,
    '='.repeat(50),
    '',
    'DÉCLARATION 2042',
    `  1AJ  Salaires net imposable     : ${eur(totalNetImposable)}`,
    `  4BA  Revenus fonciers imposables: ${eur(d.case4BA)}`,
    `  4BB  Déficit revenus fonciers   : ${eur(d.case4BB)}`,
    `  4BC  Déficit revenu global      : ${eur(d.case4BC)}`,
    `  4BD  Déficits antérieurs        : ${eur(d.case4BD)}`,
    '',
    'IMPÔTS',
    `  TMI                            : ${pct(d.tmi)}`,
    `  IR salaires seuls              : ${eur(d.irNetSalaires)}`,
    `  IR supplémentaire foncier      : ${eur(d.irSupp)}`,
    `  Prélèvements sociaux 17,2%     : ${eur(d.prelSociaux)}`,
    `  PAS déjà versé                 : ${eur(d.totalPAS)}`,
    `  Impôt restant à payer (estimé) : ${eur(d.impotRestantDu)}`,
    '',
    '⚠️  Simulation indicative — vérifiez sur impots.gouv.fr',
  ].join('\n')
}

export function exporterJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename || `fiscapp-${data.anneeFiscale?.annee}.json`
  a.click(); URL.revokeObjectURL(url)
}
