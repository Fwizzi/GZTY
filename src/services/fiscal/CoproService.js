// ============================================================
// SERVICE COPROPRIÉTÉ v6
//
// RÈGLE FISCALE :
//
//   Ligne 229 = provisions versées au syndic en N
//               → saisies dans le journal (catégorie charges_copro)
//               → ce service ne la calcule pas
//
//   Ligne 230 = régularisation du décompte définitif de N-1
//               → formule CORRECTE (BOFiP BOI-RFPI-BASE-20-60) :
//
//   ligne230 = provisions_déduites_N-1
//              × (récupérables + non_déductibles)
//              / charges_totales_exercice
//
//   Explication :
//     En N-1 vous avez déduit des provisions. Le décompte définitif
//     révèle que X% des charges totales de l'exercice sont non
//     déductibles ou récupérables. Vous devez réintégrer ce même X%
//     de ce que VOUS AVEZ RÉELLEMENT DÉDUIT.
//
//   ANCIEN calcul (approximé, faux) :
//     aReintegrer = (récup + nonDéduit) × prorata
//     → suppose que provisions_déduites = charges_totales × prorata
//     → inexact quand les provisions ne correspondent pas aux charges
//
// ============================================================

// ── Utilitaires dates ─────────────────────────────────────────

function dateUTC(annee, mois1indexed, jour) {
  return new Date(Date.UTC(annee, mois1indexed - 1, jour))
}

function parseISO(str) {
  if (!str || typeof str !== 'string') return null
  const parts = str.split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map(Number)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  return dateUTC(y, m, d)
}

function parseJjMm(jjmm) {
  if (!jjmm || typeof jjmm !== 'string') return null
  const parts = jjmm.split('/')
  if (parts.length !== 2) return null
  const jour = parseInt(parts[0], 10)
  const mois = parseInt(parts[1], 10)
  if (isNaN(jour) || isNaN(mois) || jour < 1 || jour > 31 || mois < 1 || mois > 12) return null
  return { jour, mois }
}

function joursParAnnee(annee) {
  const b = (annee % 4 === 0 && annee % 100 !== 0) || (annee % 400 === 0)
  return b ? 366 : 365
}

function nbJoursInclusif(dateDebut, dateFin) {
  const d1 = dateDebut instanceof Date ? dateDebut : parseISO(dateDebut)
  const d2 = dateFin   instanceof Date ? dateFin   : parseISO(dateFin)
  if (!d1 || !d2) return 0
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1
}

// ── Auto-complétion date fin ──────────────────────────────────

export function calculerFinExercice(debutJjMm, anneeRef) {
  const parsed = parseJjMm(debutJjMm)
  if (!parsed) return null
  const { jour, mois } = parsed
  const anneeDebut = (anneeRef || new Date().getFullYear()) + 1
  const dateDebut  = dateUTC(anneeDebut, mois, jour)
  const dateFin    = new Date(dateDebut.getTime() - 86400000)
  return `${String(dateFin.getUTCDate()).padStart(2,'0')}/${String(dateFin.getUTCMonth()+1).padStart(2,'0')}`
}

// ── Détection exercice = année civile ─────────────────────────

export function estExerciceAnneeCivile(debutJjMm, finJjMm) {
  if (!debutJjMm || !finJjMm) return false
  const d = parseJjMm(debutJjMm)
  const f = parseJjMm(finJjMm)
  if (!d || !f) return false
  return d.jour === 1 && d.mois === 1 && f.jour === 31 && f.mois === 12
}

// ── Génération des deux exercices ────────────────────────────

export function genererExercices(debutJjMm, finJjMm, annee) {
  if (!debutJjMm || !finJjMm) return null
  const debut = parseJjMm(debutJjMm)
  const fin   = parseJjMm(finJjMm)
  if (!debut || !fin) return null
  const dm = `${String(debut.mois).padStart(2,'0')}-${String(debut.jour).padStart(2,'0')}`
  const fm = `${String(fin.mois).padStart(2,'0')}-${String(fin.jour).padStart(2,'0')}`
  return {
    anneeRef: annee - 1,
    exercice1: {
      dateDebut: `${annee-2}-${dm}`, dateFin: `${annee-1}-${fm}`,
      label: `${debutJjMm}/${annee-2} → ${finJjMm}/${annee-1}`,
    },
    exercice2: {
      dateDebut: `${annee-1}-${dm}`, dateFin: `${annee}-${fm}`,
      label: `${debutJjMm}/${annee-1} → ${finJjMm}/${annee}`,
    },
  }
}

// ── Calcul prorata rigoureux ──────────────────────────────────

export function calculerProrataRigoureux(dateDebut, dateFin, anneeRef) {
  const d1 = parseISO(dateDebut)
  const d2 = parseISO(dateFin)
  if (!d1 || !d2 || !anneeRef) {
    return { prorata:0, jours:0, joursAnnee:joursParAnnee(anneeRef||2024), portionDebut:null, portionFin:null }
  }
  const debutAnnee   = dateUTC(anneeRef, 1, 1)
  const finAnnee     = dateUTC(anneeRef, 12, 31)
  const portionDebut = new Date(Math.max(d1.getTime(), debutAnnee.getTime()))
  const portionFin   = new Date(Math.min(d2.getTime(), finAnnee.getTime()))
  if (portionDebut > portionFin) {
    return { prorata:0, jours:0, joursAnnee:joursParAnnee(anneeRef), portionDebut:null, portionFin:null }
  }
  const jours      = nbJoursInclusif(portionDebut, portionFin)
  const joursAnnee = joursParAnnee(anneeRef)
  return {
    prorata: jours / joursAnnee, jours, joursAnnee,
    portionDebut: portionDebut.toISOString().slice(0,10),
    portionFin:   portionFin.toISOString().slice(0,10),
  }
}

export function formaterProrata(p) {
  if (!p || p.prorata === 0) return '0 %'
  return `${p.jours}j / ${p.joursAnnee}j = ${(p.prorata * 100).toFixed(4)}%`
}

// ── Calcul ligne 230 — formule corrigée ───────────────────────
//
// Données attendues par exercice :
//   chargesPayees      = charges totales de l'exercice (décompte définitif)
//   dontNonDeduct      = dont non déductibles (amélioration, agrandissement…)
//   dontRecup          = dont récupérables sur le locataire
//   provisionsDeduites = ce que vous avez réellement passé en ligne 229
//                        pour CET exercice l'année précédente
//                        (si absent → fallback : chargesPayees × prorata)
//
// Formule :
//   tauxNonDeductible = (nonDéduit + récup) / chargesPayees
//   aReintegrer = provisionsDeduites × tauxNonDeductible

export function calculerLigne230(exercice1Data, exercice2Data, exercicesDates, annee) {
  const alertes = []

  if (!exercicesDates) {
    return { ligne230:0, part1:null, part2:null, alertes:['⚠️ Paramètres exercice manquants'] }
  }

  const anneeRef = annee - 1
  const p1 = calculerProrataRigoureux(exercicesDates.exercice1.dateDebut, exercicesDates.exercice1.dateFin, anneeRef)
  const p2 = calculerProrataRigoureux(exercicesDates.exercice2.dateDebut, exercicesDates.exercice2.dateFin, anneeRef)

  const totalProrata = p1.prorata + p2.prorata
  if (Math.abs(totalProrata - 1.0) > 0.001) {
    alertes.push(`⚠️ Prorata total = ${(totalProrata * 100).toFixed(2)}% (attendu 100%) — vérifiez les dates`)
  }

  const calculerPart = (data, p) => {
    const chargesExercice = parseFloat(data?.chargesPayees)  || 0
    const nonDeductibles  = parseFloat(data?.dontNonDeduct)  || 0
    const recuperables    = parseFloat(data?.dontRecup)      || 0
    const nonDeductTotal  = nonDeductibles + recuperables

    // provisionsDeduites = montant total versé en ligne 229 l'an dernier pour CET exercice.
    // Fallback si non renseigné : on estime que l'utilisateur a versé
    // chargesExercice × prorata (proportionnel à la durée de l'exercice dans N-1).
    const provisionsDeduites = data?.provisionsDeduites != null && data.provisionsDeduites !== ''
      ? parseFloat(data.provisionsDeduites) || 0
      : r2(chargesExercice * p.prorata)   // fallback = estimation

    const fallbackUtilise = data?.provisionsDeduites == null || data.provisionsDeduites === ''

    // Taux de non-déductibilité de l'exercice (sur la totalité des charges)
    const tauxNonDeductible = chargesExercice > 0 ? nonDeductTotal / chargesExercice : 0

    // Montant à réintégrer :
    //
    //   Si provisionsDeduites est renseigné (montant total versé pour cet exercice) :
    //     → on applique le prorata pour n'isoler que la part tombant dans N-1
    //     → aReintegrer = provisionsDeduites × prorata × taux
    //
    //   Si fallback (provisionsDeduites estimées = chargesExercice × prorata) :
    //     → le prorata est déjà dans l'estimation, on ne l'applique pas une seconde fois
    //     → aReintegrer = provisionsDeduites_estimées × taux
    //                   = chargesExercice × prorata × taux   (identique)
    //
    const aReintegrer = fallbackUtilise
      ? r2(provisionsDeduites * tauxNonDeductible)                    // fallback : prorata déjà inclus
      : r2(provisionsDeduites * p.prorata * tauxNonDeductible)        // saisi   : on applique le prorata
    const deductible  = r2(Math.max(0, provisionsDeduites * (fallbackUtilise ? 1 : p.prorata) - aReintegrer))

    return {
      prorata: p.prorata, jours: p.jours, joursAnnee: p.joursAnnee,
      chargesExercice: r2(chargesExercice),
      nonDeductibles:  r2(nonDeductibles),
      recuperables:    r2(recuperables),
      nonDeductTotal:  r2(nonDeductTotal),
      tauxNonDeductible: r2(tauxNonDeductible * 100), // en % pour affichage
      provisionsDeduites: r2(provisionsDeduites),
      fallbackUtilise,
      aReintegrer,
      deductible,
      portionDebut: p.portionDebut,
      portionFin:   p.portionFin,
    }
  }

  const part1 = calculerPart(exercice1Data, p1)
  const part2 = calculerPart(exercice2Data, p2)

  // ── Règle fiscale : seul l'exercice 1 contribue à la ligne 230 de l'année N ──
  //
  // L'exercice 1 se clôture en N-1 (ex : 01/11/N-2 → 31/10/N-1).
  // Son décompte définitif est disponible au moment de la déclaration N (printemps N).
  // → On régularise les provisions de l'exercice 1 en ligne 230 de la déclaration N.
  //
  // L'exercice 2 se clôture en N (ex : 01/11/N-1 → 31/10/N).
  // Les deux exercices contribuent au prorata de leur portion dans N-1.
  // Ligne 230 = part1.aReintegrer + part2.aReintegrer

  if (part1.fallbackUtilise && part1.chargesExercice > 0) {
    alertes.push('ℹ️ Exercice 1 : provisions déduites en N-1 non renseignées — estimation utilisée. Pour un calcul exact, renseignez ce champ.')
  }
  if (part2.fallbackUtilise && part2.chargesExercice > 0) {
    alertes.push('ℹ️ Exercice 2 : provisions déduites en N-1 non renseignées — estimation utilisée. Pour un calcul exact, renseignez ce champ.')
  }
  if (!exercice1Data?.chargesPayees && !exercice2Data?.chargesPayees) {
    alertes.push('ℹ️ Aucune charge saisie — renseignez les décomptes syndic')
  }

  const ligne230 = r2(part1.aReintegrer + part2.aReintegrer)

  return {
    ligne230,
    part1: { ...part1, label: exercicesDates.exercice1.label, anneeRef },
    part2: { ...part2, label: exercicesDates.exercice2.label, anneeRef },
    totalProrata,
    anneeRef,
    alertes,
  }
}

// ── Cas exercice = année civile ───────────────────────────────

export function calculerLigne230AnneeCivile(exerciceData, annee) {
  const anneeRef        = annee - 1
  const chargesExercice = parseFloat(exerciceData?.chargesPayees)  || 0
  const nonDeductibles  = parseFloat(exerciceData?.dontNonDeduct)  || 0
  const recuperables    = parseFloat(exerciceData?.dontRecup)      || 0
  const nonDeductTotal  = nonDeductibles + recuperables

  const provisionsDeduites = exerciceData?.provisionsDeduites != null && exerciceData.provisionsDeduites !== ''
    ? parseFloat(exerciceData.provisionsDeduites) || 0
    : chargesExercice   // fallback : exercice = année civile → prorata = 100%

  const fallbackUtilise   = exerciceData?.provisionsDeduites == null || exerciceData.provisionsDeduites === ''
  const tauxNonDeductible = chargesExercice > 0 ? nonDeductTotal / chargesExercice : 0
  const aReintegrer       = r2(provisionsDeduites * tauxNonDeductible)
  const deductible        = r2(Math.max(0, provisionsDeduites - aReintegrer))

  return {
    ligne230: aReintegrer,
    part1: {
      label: `01/01/${anneeRef} → 31/12/${anneeRef}`,
      prorata: 1, jours: joursParAnnee(anneeRef), joursAnnee: joursParAnnee(anneeRef),
      chargesExercice: r2(chargesExercice),
      nonDeductibles: r2(nonDeductibles), recuperables: r2(recuperables),
      nonDeductTotal: r2(nonDeductTotal),
      tauxNonDeductible: r2(tauxNonDeductible * 100),
      provisionsDeduites: r2(provisionsDeduites),
      fallbackUtilise,
      aReintegrer, deductible,
      portionDebut: `${anneeRef}-01-01`, portionFin: `${anneeRef}-12-31`,
    },
    part2: null, totalProrata: 1, anneeRef, alertes: [], estAnneeCivile: true,
  }
}

function r2(v) { return Math.round((parseFloat(v) || 0) * 100) / 100 }
