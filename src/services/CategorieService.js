// ============================================================
// SERVICE CATÉGORIES — Groupes sémantiques pour l'affichage
// ============================================================

import { CATEGORIES_TX } from '../db/repositories/index.js'

/** Groupes sémantiques — ordre d'affichage */
export const GROUPES_CATEGORIE = [
  {
    id:       'recettes',
    label:    'Recettes',
    emoji:    '↑',
    couleur:  'success',
    cats:     ['loyer', 'charges_locataire'],
  },
  {
    id:       'financier',
    label:    'Charges financières',
    emoji:    '🏦',
    couleur:  'brand',
    cats:     ['interets_emprunt', 'assurance_emprunt', 'frais_bancaires'],
  },
  {
    id:       'courantes',
    label:    'Charges courantes',
    emoji:    '🏠',
    couleur:  'warning',
    cats:     ['charges_copro', 'taxe_fonciere', 'assurance', 'frais_gestion'],
  },
  {
    id:       'travaux',
    label:    'Travaux',
    emoji:    '🔧',
    couleur:  'danger',
    cats:     ['travaux', 'travaux_energetique'],
  },
  {
    id:       'divers',
    label:    'Divers',
    emoji:    '•',
    couleur:  'neutral',
    cats:     ['autre'],
  },
]

/** Map catégorie → groupe */
const CAT_TO_GROUPE = new Map(
  GROUPES_CATEGORIE.flatMap(g => g.cats.map(c => [c, g]))
)

export function groupeDeCategorie(categorie) {
  return CAT_TO_GROUPE.get(categorie) || GROUPES_CATEGORIE.at(-1)
}

/**
 * Regroupe et trie les transactions par groupe sémantique.
 * Chaque groupe expose ses transactions + son total recettes/charges.
 */
export function grouperParCategorie(transactions) {
  const map = new Map(GROUPES_CATEGORIE.map(g => [g.id, { ...g, transactions: [], totalRecettes: 0, totalCharges: 0 }]))

  for (const tx of transactions) {
    const groupe = groupeDeCategorie(tx.categorie)
    const entry  = map.get(groupe.id)
    if (!entry) continue
    entry.transactions.push(tx)
    if (tx.sens === 'recette') entry.totalRecettes += tx.montant || 0
    else                       entry.totalCharges  += tx.montant || 0
  }

  // Ne retourner que les groupes non vides
  return [...map.values()].filter(g => g.transactions.length > 0)
}

/** Trie les transactions selon le critère choisi */
export function trierTransactions(transactions, critere) {
  const copy = [...transactions]
  switch (critere) {
    case 'date_asc':     return copy.sort((a,b) => a.date?.localeCompare(b.date))
    case 'date_desc':    return copy.sort((a,b) => b.date?.localeCompare(a.date))
    case 'montant_desc': return copy.sort((a,b) => (b.montant||0) - (a.montant||0))
    case 'montant_asc':  return copy.sort((a,b) => (a.montant||0) - (b.montant||0))
    case 'categorie':    return copy.sort((a,b) => a.categorie?.localeCompare(b.categorie))
    default:             return copy
  }
}

/** Filtre les transactions par un ensemble de catégories actives */
export function filtrerParCategories(transactions, categoriesActives) {
  if (!categoriesActives.size) return transactions
  return transactions.filter(tx => categoriesActives.has(tx.categorie))
}
