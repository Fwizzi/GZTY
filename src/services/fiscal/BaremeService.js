// ============================================================
// BARÈMES FISCAUX v2 — paramètres corrects par année
// Sources : BOFiP, LFI 2025 (JO 15/02/2025), LFI 2026 (JO 19/02/2026)
// ============================================================

const BAREMES_CONNUS = {
  2024: {
    // LFI 2025 — revalorisation +1,8% — JO 15/02/2025
    tranches: [
      { jusqu_a: 11497,    taux: 0    },
      { jusqu_a: 29315,    taux: 0.11 },
      { jusqu_a: 83823,    taux: 0.30 },
      { jusqu_a: 180294,   taux: 0.41 },
      { jusqu_a: Infinity, taux: 0.45 },
    ],
    // Abattement 10% — déclaration 2025 (revenus 2024)
    abattementSalaires:  { taux: 0.10, min: 504, max: 14426 },
    // Décote — BOFiP BOI-IR-LIQ-20-20-30 — revenus 2024
    decote: {
      celibataire: { seuil: 1964, base: 889  },
      couple:      { seuil: 3248, base: 1470 },
      coeff:       0.4525,
    },
    tauxPS:              0.172,
    plafondDeficit:      10700,
    forfaitFraisGestion: 20,
    anneeDeclaration:    2025,
    estEstime:           false,
  },

  2025: {
    // LFI 2026 — revalorisation +0,9% — JO 19/02/2026
    tranches: [
      { jusqu_a: 11600,    taux: 0    },
      { jusqu_a: 29579,    taux: 0.11 },
      { jusqu_a: 84577,    taux: 0.30 },
      { jusqu_a: 181917,   taux: 0.41 },
      { jusqu_a: Infinity, taux: 0.45 },
    ],
    // Abattement 10% — déclaration 2026 (revenus 2025)
    abattementSalaires:  { taux: 0.10, min: 509, max: 14555 },
    // Décote — economie.gouv.fr & service-public.fr — revenus 2025
    decote: {
      celibataire: { seuil: 1982, base: 897  },
      couple:      { seuil: 3277, base: 1483 },
      coeff:       0.4525,
    },
    tauxPS:              0.172,
    plafondDeficit:      10700,
    forfaitFraisGestion: 20,
    anneeDeclaration:    2026,
    estEstime:           false,
  },

  2026: {
    // Estimé — barème non encore publié — copie 2025 avec estEstime: true
    tranches: [
      { jusqu_a: 11600,    taux: 0    },
      { jusqu_a: 29579,    taux: 0.11 },
      { jusqu_a: 84577,    taux: 0.30 },
      { jusqu_a: 181917,   taux: 0.41 },
      { jusqu_a: Infinity, taux: 0.45 },
    ],
    abattementSalaires:  { taux: 0.10, min: 509, max: 14555 },
    decote: {
      celibataire: { seuil: 1982, base: 897  },
      couple:      { seuil: 3277, base: 1483 },
      coeff:       0.4525,
    },
    tauxPS:              0.172,
    plafondDeficit:      10700,
    forfaitFraisGestion: 20,
    anneeDeclaration:    2027,
    estEstime:           true,
  },
}

/** Retourne un barème complet pour une année */
export function getBareme(annee, baremePersonnalise = null) {
  if (baremePersonnalise && baremePersonnalise.estEstime === false) {
    return { ...baremePersonnalise }
  }
  if (BAREMES_CONNUS[annee]) {
    return { ...BAREMES_CONNUS[annee] }
  }
  const derniere = Math.max(...Object.keys(BAREMES_CONNUS).map(Number))
  return {
    ...BAREMES_CONNUS[derniere],
    anneeDeclaration: annee + 1,
    estEstime:        true,
    anneeReference:   derniere,
  }
}

export function getAnneesDisponibles() {
  const anneeActuelle = new Date().getFullYear()
  const toutes = new Set([
    ...Object.keys(BAREMES_CONNUS).map(Number),
    anneeActuelle,
    anneeActuelle + 1,
  ])
  return [...toutes].sort((a, b) => a - b)
}

export function getAnneesConnues() {
  return Object.keys(BAREMES_CONNUS).map(Number).sort()
}

/** Paramètres de décote par défaut si absents du barème */
export const DECOTE_DEFAUT = {
  celibataire: { seuil: 1982, base: 897  },
  couple:      { seuil: 3277, base: 1483 },
  coeff:       0.4525,
}
