// ============================================================
// SERVICE RÉCURRENCE
// Génération de transactions récurrentes (mensuel / trimestriel)
// Logique pure — sans dépendance UI ni base de données
// ============================================================

const MOIS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const TRIMESTRES = ['T1','T2','T3','T4']

// ── Génération ────────────────────────────────────────────────

/**
 * Génère les occurrences d'une transaction récurrente.
 * Chaque occurrence est une transaction indépendante liée par groupeId.
 *
 * @param {object} params
 * @param {string} params.bienAnneeId
 * @param {string} params.groupeTitre   Titre de base (ex: "Loyer Paris")
 * @param {number} params.montant
 * @param {'recette'|'charge'} params.sens
 * @param {string} params.categorie
 * @param {'mensuel'|'trimestriel'} params.type
 * @param {number} params.annee         Année fiscale (pour les dates)
 * @param {string} [params.notes]
 * @returns {object[]}  Tableau de transactions prêtes à insérer (sans id)
 */
export function genererOccurrences({ bienAnneeId, groupeTitre, montant, sens, categorie, type, annee, notes = '' }) {
  const groupeId = crypto.randomUUID()
  const labels   = type === 'mensuel' ? MOIS : TRIMESTRES
  const total    = labels.length   // 12 ou 4

  return labels.map((label, index) => ({
    bienAnneeId,
    titre:       `${groupeTitre} - ${label}`,
    montant:     Math.abs(parseFloat(montant) || 0),
    sens,
    categorie,
    notes,
    date:        dateOccurrence(annee, type, index),
    groupeId,
    groupeType:  type,
    groupeIndex: index,
    groupeTitre,
  }))
}

/**
 * Génère une date représentative pour chaque occurrence.
 * Mensuel   → 1er du mois correspondant
 * Trimestriel → 1er du premier mois du trimestre
 */
function dateOccurrence(annee, type, index) {
  if (type === 'mensuel') {
    const mois = String(index + 1).padStart(2, '0')
    return `${annee}-${mois}-01`
  }
  // Trimestriel : T1→01, T2→04, T3→07, T4→10
  const moisDebut = String(index * 3 + 1).padStart(2, '0')
  return `${annee}-${moisDebut}-01`
}

// ── Opérations groupées ───────────────────────────────────────

/**
 * Applique une mise à jour de montant/catégorie/sens à toutes
 * les occurrences d'un groupe, en conservant leurs titres individuels.
 *
 * @param {object[]} transactions   Toutes les transactions du bienAnnee
 * @param {string}   groupeId
 * @param {object}   updates        { montant?, categorie?, sens?, notes? }
 * @returns {object[]} Transactions modifiées (nouvelles références)
 */
export function mettreAJourGroupe(transactions, groupeId, updates) {
  return transactions.map(tx => {
    if (tx.groupeId !== groupeId) return tx
    return { ...tx, ...updates }
  })
}

/**
 * Supprime toutes les occurrences d'un groupe.
 */
export function supprimerGroupe(transactions, groupeId) {
  return transactions.filter(tx => tx.groupeId !== groupeId)
}

/**
 * Regroupe les transactions par groupeId pour l'affichage.
 * Retourne : { grouped: Map<groupeId, tx[]>, singles: tx[] }
 */
export function regrouperTransactions(transactions) {
  const grouped = new Map()
  const singles = []

  for (const tx of transactions) {
    if (tx.groupeId) {
      if (!grouped.has(tx.groupeId)) grouped.set(tx.groupeId, [])
      grouped.get(tx.groupeId).push(tx)
    } else {
      singles.push(tx)
    }
  }

  // Trier les occurrences dans l'ordre
  for (const [, txs] of grouped) {
    txs.sort((a, b) => (a.groupeIndex ?? 0) - (b.groupeIndex ?? 0))
  }

  return { grouped, singles }
}

/**
 * Vérifie si un groupe existe déjà dans la liste de transactions.
 * Utilisé pour l'anti-doublon.
 */
export function groupeExiste(transactions, groupeId) {
  return transactions.some(tx => tx.groupeId === groupeId)
}

// ── Helpers UI ────────────────────────────────────────────────

/** Résumé d'un groupe pour l'affichage */
export function resumeGroupe(occurrences) {
  if (!occurrences?.length) return null
  const first = occurrences[0]
  const total = occurrences.reduce((s, tx) => s + (tx.montant || 0), 0)
  const allSame = occurrences.every(tx => tx.montant === first.montant)
  return {
    titre:       first.groupeTitre || first.titre,
    type:        first.groupeType,
    count:       occurrences.length,
    totalAnnuel: total,
    montantType: allSame ? 'uniforme' : 'variable',
    montantRef:  first.montant,
    sens:        first.sens,
    categorie:   first.categorie,
    groupeId:    first.groupeId,
  }
}

export { MOIS, TRIMESTRES }
