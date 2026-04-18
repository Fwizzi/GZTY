// ============================================================
// SERVICE CALCUL 2044 — v5
//
// CORRECTIONS v5 :
//   - Anomalie 6 : ligne 212 (charges locataire) ajoutée aux recettes
//   - Anomalie 8 : note TEOM exposée dans le résultat
// ============================================================

import { genererExercices, calculerLigne230, estExerciceAnneeCivile, calculerLigne230AnneeCivile } from './CoproService.js'

export function agregerTransactions(transactions) {
  const agg = {
    loyers:0, chargesLocataire:0, assurance:0, assuranceEmprunt:0,
    chargesCopro:0, taxeFonciere:0, travaux:0, travauxEnergetique:0,
    fraisGestion:0, interetsEmprunt:0, fraisBancaires:0, autre:0,
  }
  for (const tx of transactions) {
    const m = Math.abs(parseFloat(tx.montant) || 0)
    switch (tx.categorie) {
      case 'loyer':                agg.loyers             += m; break
      case 'charges_locataire':    agg.chargesLocataire   += m; break
      case 'assurance':            agg.assurance          += m; break
      case 'assurance_emprunt':    agg.assuranceEmprunt   += m; break
      case 'charges_copro':        agg.chargesCopro       += m; break
      case 'taxe_fonciere':        agg.taxeFonciere       += m; break
      case 'travaux':              agg.travaux            += m; break
      case 'travaux_energetique':  agg.travauxEnergetique += m; break
      case 'frais_gestion':        agg.fraisGestion       += m; break
      case 'interets_emprunt':     agg.interetsEmprunt    += m; break
      case 'frais_bancaires':      agg.fraisBancaires     += m; break
      default:                     agg.autre              += m; break
    }
  }
  return agg
}

export function calculer2044(agg, bienAnnee, annee, bareme) {
  const nbLocaux = bienAnnee?.nbLocaux || 1
  const forfait  = bareme?.forfaitFraisGestion || 20

  // ── Recettes ─────────────────────────────────────────────
  //
  // Ligne 211 = loyers bruts encaissés uniquement
  //
  // Ligne 212 = dépenses du PROPRIÉTAIRE payées par le locataire
  //             par convention (cas rarissime en habitation classique)
  //             → NE PAS confondre avec les charges récupérables
  //
  // Charges récupérables (eau, TEOM, entretien…) :
  //   → TRANSPARENTES fiscalement (ni recettes, ni charges)
  //   → Apparaissent uniquement en ligne 230 lors de la régularisation
  //      copropriété de l'année suivante
  //   → La catégorie "charges_locataire" du journal est donc IGNORÉE
  //      dans le calcul 2044 (agg.chargesLocataire non utilisé ici)
  const ligne211 = r(agg.loyers)
  const ligne212 = 0   // Non géré — cas rarissime, saisie manuelle si besoin
  const ligne215 = r(ligne211)  // Total recettes = loyers bruts uniquement

  // ── Charges courantes (lignes 221-230) ───────────────────
  const ligne221  = r(agg.fraisGestion + agg.autre)
  const ligne222  = r(forfait * nbLocaux)
  const ligne223  = r(agg.assurance)
  const ligne224  = r(agg.travaux)
  const ligne224b = r(agg.travauxEnergetique)

  // ANOMALIE 8 — Note TEOM :
  //   La taxe foncière saisie ici NE DOIT PAS inclure la TEOM si elle
  //   est refacturée au locataire (récupérable à 100%). Si la TEOM est
  //   incluse dans le montant saisi, elle sera sur-déduite.
  //   L'app expose un flag pour alerter l'utilisateur.
  const ligne227 = r(agg.taxeFonciere)

  // ── Ligne 229 : provisions versées au syndic en N ────────
  const ligne229 = r(agg.chargesCopro)

  // ── Ligne 230 : régularisation décompte définitif ────────
  const copro = bienAnnee?.copro || {}
  let ligne230    = 0
  let resultCopro = null

  if (copro.debutJjMm && copro.finJjMm) {
    const isAnneeCivile  = estExerciceAnneeCivile(copro.debutJjMm, copro.finJjMm)
    const exercicesDates = isAnneeCivile ? null : genererExercices(copro.debutJjMm, copro.finJjMm, annee)
    resultCopro = isAnneeCivile
      ? calculerLigne230AnneeCivile(copro.exercice1Data || {}, annee)
      : calculerLigne230(copro.exercice1Data || {}, copro.exercice2Data || {}, exercicesDates, annee)
    ligne230 = resultCopro.ligne230
  }

  // ── Total charges (ligne 240) ────────────────────────────
  const ligne240 = r(ligne221 + ligne222 + ligne223 + ligne224 + ligne224b + ligne227 + ligne229 - ligne230)

  // ── Intérêts d'emprunt (ligne 250) ───────────────────────
  const interetsPrets = (bienAnnee?.prets || [])
    .reduce((s, p) => s + (parseFloat(p.interets)||0) + (parseFloat(p.assurance)||0), 0)
  const interetsTx    = r(agg.interetsEmprunt + agg.assuranceEmprunt + agg.fraisBancaires)
  const ligne250      = r(interetsPrets > 0 ? interetsPrets : interetsTx)

  // ── Résultat ─────────────────────────────────────────────
  const ligne261 = r(ligne215 - ligne240 - ligne250)
  const ligne263 = ligne261

  return {
    ligne211, ligne212, ligne215,
    ligne221, ligne222, ligne223, ligne224, ligne224b,
    ligne227, ligne229, ligne230, ligne240, ligne250, ligne261, ligne263,
    caseE: ligne215, caseF: ligne240, caseG: ligne250, caseI: ligne263,
    nbLocaux, resultatFoncier: ligne263, estDeficitaire: ligne263 < 0,
    resultCopro,
    interetsPrets: r(interetsPrets), interetsTx,
    sourceInterets: interetsPrets > 0 ? 'prets' : 'transactions',
    // Flag TEOM pour alerte UI (anomalie 8)
    hasTaxeFonciere: agg.taxeFonciere > 0,
  }
}

function r(v) { return Math.round((parseFloat(v) || 0) * 100) / 100 }
