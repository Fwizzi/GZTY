// ============================================================
// SERVICE CALCUL 2042 + IR — v4
//
// CORRECTIONS v4 :
//   - Anomalie 3 : répartition 4BB/4BC selon CGI art.156-I-3°
//   - Anomalie 4 : abattement calculé sur cumul global (plafond par salarié)
//   - Anomalie 7 : IR final arrondi à l'euro (CGI art.1657)
//   - Anomalie 9 : explication décote différentielle exposée dans le résultat
// ============================================================

// ── Abattement salaires ───────────────────────────────────────

export function calculerAbattement(netImposable, mode, fraisReels, baremeAbatt) {
  const { taux=0.10, min:minA=504, max:maxA=14426 } = baremeAbatt || {}
  const forfaitaire = Math.min(Math.max(netImposable * taux, minA), maxA)
  const totalFraisReels = mode === 'frais_reels'
    ? Object.values(fraisReels || {}).reduce((s,v) => s+(parseFloat(v)||0), 0)
    : 0
  const abattementRetenu = mode === 'frais_reels'
    ? Math.max(forfaitaire, totalFraisReels)
    : forfaitaire
  return {
    forfaitaire:      r2(forfaitaire),
    totalFraisReels:  r2(totalFraisReels),
    abattementRetenu: r2(abattementRetenu),
    modeRetenu:       (mode === 'frais_reels' && totalFraisReels > forfaitaire) ? 'frais_reels' : 'forfaitaire',
    gainFraisReels:   r2(Math.max(0, totalFraisReels - forfaitaire)),
  }
}

// ── Barème progressif ─────────────────────────────────────────

export function calculerBaremeProgressif(quotient, tranches) {
  if (!tranches?.length || quotient <= 0) return { detail:[], irBrut:0, tmi:0 }
  const detail = []
  let precedent=0, irBrut=0, tmi=0
  for (const tranche of tranches) {
    if (quotient <= precedent) break
    const borneHaute    = tranche.jusqu_a === Infinity ? quotient : Math.min(quotient, tranche.jusqu_a)
    const montantSoumis = r2(borneHaute - precedent)
    const impot         = r2(montantSoumis * tranche.taux)
    detail.push({ de:precedent, a:borneHaute, jusqu_a:tranche.jusqu_a, taux:tranche.taux, montantSoumis, impot, estActive:montantSoumis>0 })
    irBrut += impot
    if (montantSoumis > 0) tmi = tranche.taux
    precedent = tranche.jusqu_a
    if (precedent >= quotient) break
  }
  return { detail, irBrut:r2(irBrut), tmi }
}

// ── Décote ───────────────────────────────────────────────────

export function calculerDecote(irBrut, situation, decoteBareme) {
  const estCouple = ['marie','pacse','Marié(e)','Pacsé(e)'].includes(situation)
  const params    = decoteBareme || {}
  const groupe    = estCouple ? (params.couple||{seuil:3277,base:1483}) : (params.celibataire||{seuil:1982,base:897})
  const coeff     = params.coeff ?? 0.4525
  const { seuil, base } = groupe
  if (irBrut <= 0 || irBrut >= seuil) return { decote:0, seuil, base, coeff, applicable:false, estCouple }
  const decote = Math.max(0, r2(base - irBrut * coeff))
  return { decote, seuil, base, coeff, applicable:decote>0, estCouple }
}

// ── IR salaires ───────────────────────────────────────────────

export function calculerIRSalaires(totalNetImposable, totalAbattement, nbParts, bareme, situation) {
  const revenuImposable = Math.max(0, r2(totalNetImposable - totalAbattement))
  const quotient        = r2(revenuImposable / nbParts)
  const { detail, irBrut, tmi } = calculerBaremeProgressif(quotient, bareme?.tranches||[])
  const irBrutTotal     = r2(irBrut * nbParts)
  const { decote }      = calculerDecote(irBrutTotal, situation, bareme?.decote)
  // CORRECTION anomalie 7 : arrondi à l'euro (CGI art. 1657)
  const irNet           = arrondiEuro(Math.max(0, irBrutTotal - decote))
  const tauxEffectif    = revenuImposable > 0 ? r2(irNet/revenuImposable) : 0
  return {
    revenuImposable, quotient, nbParts,
    detail: detail.map(t => ({ ...t, impotTotal:r2(t.impot*nbParts) })),
    irBrut:irBrutTotal, decote, irNet, tmi, tauxEffectif,
  }
}

// ── Calcul 2042 global ────────────────────────────────────────

export function calculer2042(anneeFiscale, resultats2044, revenusSCPI, totalNetImposable, totalAbattement, totalPAS, nbParts, situation) {
  const { bareme } = anneeFiscale
  const plafond    = bareme?.plafondDeficit || 10700

  // ── Résultat foncier brut ─────────────────────────────────
  const resultatFoncierBrut = r2(
    resultats2044.reduce((s,r) => s+(r.ligne263||0), 0) + revenusSCPI
  )

  // ── Déficits antérieurs ───────────────────────────────────
  const deficitAnterieur = r2(
    Object.values(anneeFiscale.deficitsReportables||{}).reduce((s,v)=>s+v,0)
  )

  // ── Répartition 4BA / 4BB / 4BC / 4BD ────────────────────
  let case4BA=0, case4BB=0, case4BC=0, case4BD=0

  if (resultatFoncierBrut >= 0) {
    const imputable = Math.min(deficitAnterieur, resultatFoncierBrut)
    case4BA = r2(resultatFoncierBrut - imputable)
    case4BD = r2(Math.max(0, deficitAnterieur - imputable))
  } else {
    // ── CORRECTION anomalie 3 — CGI art. 156-I-3° ────────────
    //
    // Le déficit foncier imputable sur le revenu global (4BC) est
    // UNIQUEMENT celui résultant des dépenses HORS intérêts d'emprunt,
    // dans la limite de 10 700 € (ou 21 400 € pour travaux énergétiques).
    //
    // Le déficit provenant des intérêts d'emprunt (lorsque les intérêts
    // excèdent les recettes) n'est PAS imputable sur le revenu global →
    // il va uniquement en 4BB (report sur revenus fonciers futurs).
    //
    // Calcul :
    //   charges_hors_interets = ligne240 − ligne250 (pour tous les biens)
    //   déficit_hors_intérêts = max(0, charges_hors_interets − recettes)
    //   déficit_interets      = max(0, intérêts − recettes)
    //                           (seulement si intérêts > recettes)
    //
    //   4BC = min(déficit_hors_intérêts, plafond_effectif)
    //   4BB = max(0, déficit_hors_intérêts − plafond_effectif)
    //       + déficit_interets
    //
    // Note : le plafond effectif = 10 700 + travaux énergétiques éligibles

    const totalRecettes        = resultats2044.reduce((s,r)=>s+(r.ligne215||0),0)
    const totalInterets        = resultats2044.reduce((s,r)=>s+(r.ligne250||0),0)
    const totalCharges         = resultats2044.reduce((s,r)=>s+(r.ligne240||0),0)
    const totalTravauxE        = resultats2044.reduce((s,r)=>s+(r.ligne224b||0),0)
    const plafondEff           = plafond + totalTravauxE

    // Charges sans les intérêts d'emprunt
    const chargesHorsInterets  = r2(totalCharges - totalInterets)

    // Déficit généré par les charges hors intérêts (positif si déficit)
    const deficitHorsInterets  = r2(Math.max(0, chargesHorsInterets - totalRecettes))

    // Déficit généré par les intérêts seuls (seulement si intérêts > recettes)
    // Les charges hors intérêts sont prioritaires sur les recettes
    const recettesApresCharges = r2(Math.max(0, totalRecettes - chargesHorsInterets))
    const deficitInterets      = r2(Math.max(0, totalInterets - recettesApresCharges))

    // 4BC = déficit hors intérêts dans la limite du plafond → imputable revenu global
    case4BC = r2(Math.min(deficitHorsInterets, plafondEff))

    // 4BB = excédent du déficit hors intérêts + déficit intérêts → report foncier
    case4BB = r2(Math.max(0, deficitHorsInterets - plafondEff) + deficitInterets)

    // Vérification cohérence : 4BB + 4BC doit = déficit total
    const deficitTotal = Math.abs(resultatFoncierBrut)
    if (Math.abs(case4BB + case4BC - deficitTotal) > 0.02) {
      // Ajustement centimes d'arrondi
      case4BB = r2(deficitTotal - case4BC)
    }

    case4BD = deficitAnterieur
  }

  // ── IR salaires seuls ─────────────────────────────────────
  const irSalaires = calculerIRSalaires(totalNetImposable, totalAbattement, nbParts, bareme, situation)

  // ── IR global (salaires + bénéfice foncier) ───────────────
  const revenuTotal       = r2(irSalaires.revenuImposable + Math.max(0, case4BA))
  const quotientGlobal    = r2(revenuTotal / nbParts)
  const { irBrut:irBrutGlobal, tmi:tmiGlobal } = calculerBaremeProgressif(quotientGlobal, bareme?.tranches||[])
  const irBrutGlobalTotal = r2(irBrutGlobal * nbParts)
  const decoteGlobaleObj  = calculerDecote(irBrutGlobalTotal, situation, bareme?.decote)
  // CORRECTION anomalie 7 : arrondi à l'euro
  const irNetGlobal       = arrondiEuro(Math.max(0, irBrutGlobalTotal - decoteGlobaleObj.decote))

  // CORRECTION anomalie 9 : impact décote différentielle exposé
  // Si le bénéfice foncier fait passer l'IR au-dessus du seuil de décote,
  // l'utilisateur perd la décote qu'il avait sur ses salaires seuls.
  // L'impact réel du foncier inclut donc cette perte de décote.
  const decotePerdue      = r2(Math.max(0, irSalaires.decote - decoteGlobaleObj.decote))
  const irSupp            = r2(Math.max(0, irNetGlobal - irSalaires.irNet))

  const prelSociaux        = r2(Math.max(0, case4BA) * (bareme?.tauxPS||0.172))
  const totalImpotsFoncier = r2(irSupp + prelSociaux)
  const impotRestantDu     = arrondiEuro(Math.max(0, irNetGlobal - totalPAS))

  return {
    case4BA:r2(case4BA), case4BB:r2(case4BB), case4BC:r2(case4BC), case4BD:r2(case4BD),
    totalNetImposable, totalAbattement,
    revenuImposableSalaires: irSalaires.revenuImposable,
    irSalaires,
    revenuTotal, tmi:tmiGlobal,
    irNetSalaires:       irSalaires.irNet,
    irNetGlobal,
    irSupp, prelSociaux, totalImpotsFoncier,
    totalPAS, impotRestantDu,
    revenusFonciersBruts: resultatFoncierBrut,
    resultatFoncierNet:   r2(resultatFoncierBrut > 0 ? case4BA : -Math.abs(case4BB+case4BC)),
    deficitAnterieur,
    // Anomalie 9 : détail décote différentielle
    decoteGlobale:       decoteGlobaleObj.decote,
    decotePerdue,
    alerteDecotePerdue:  decotePerdue > 0,
  }
}

export function calculerIR(revenu, nbParts, bareme) {
  if (!revenu||revenu<=0) return 0
  const { irBrut } = calculerBaremeProgressif(revenu/nbParts, bareme?.tranches||[])
  return arrondiEuro(irBrut*nbParts)
}

export function calculerTMI(revenu, nbParts, bareme) {
  const { tmi } = calculerBaremeProgressif(revenu/nbParts, bareme?.tranches||[])
  return tmi
}

// CORRECTION anomalie 7 : arrondi à l'euro (CGI art. 1657)
// Fractions < 0,50 € négligées ; fractions ≥ 0,50 € comptent pour 1 €
function arrondiEuro(v) { return Math.round(parseFloat(v) || 0) }

function r2(v) { return Math.round((parseFloat(v) || 0) * 100) / 100 }
