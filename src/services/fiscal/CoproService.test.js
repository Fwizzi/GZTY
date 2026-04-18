// Tests unitaires CoproService — exécutés avec Node directement
import {
  genererExercices, calculerProrata, calculerChargesCopro,
  calculerLignes2044Copro, getMetaExercices
} from './CoproService.js'

let passed = 0, failed = 0
const assert = (label, condition, got, expected) => {
  if (condition) { console.log(`  ✓ ${label}`); passed++ }
  else { console.error(`  ✗ ${label} — attendu: ${expected}, obtenu: ${got}`); failed++ }
}

// ── Test 1 : génération des exercices ─────────────────────────
console.log('\n[1] genererExercices — début 01/05, année 2026')
const { ex1, ex2 } = genererExercices(1, 5, 2026)
assert('ex1.dateDebut', ex1.dateDebut === '2024-05-01', ex1.dateDebut, '2024-05-01')
assert('ex1.dateFin',   ex1.dateFin   === '2025-04-30', ex1.dateFin,   '2025-04-30')
assert('ex2.dateDebut', ex2.dateDebut === '2025-05-01', ex2.dateDebut, '2025-05-01')
assert('ex2.dateFin',   ex2.dateFin   === '2026-04-30', ex2.dateFin,   '2026-04-30')

// ── Test 2 : génération exercices 01/07 ───────────────────────
console.log('\n[2] genererExercices — début 01/07, année 2025')
const { ex1: e1b, ex2: e2b } = genererExercices(1, 7, 2025)
assert('ex1.dateDebut', e1b.dateDebut === '2023-07-01', e1b.dateDebut, '2023-07-01')
assert('ex1.dateFin',   e1b.dateFin   === '2024-06-30', e1b.dateFin,   '2024-06-30')
assert('ex2.dateDebut', e2b.dateDebut === '2024-07-01', e2b.dateDebut, '2024-07-01')
assert('ex2.dateFin',   e2b.dateFin   === '2025-06-30', e2b.dateFin,   '2025-06-30')

// ── Test 3 : prorata exercice 01/05 sur année 2026 ────────────
console.log('\n[3] calculerProrata — exercice 01/05/2024→30/04/2025 sur 2026')
// Chevauchement : 01/01/2026 → 30/04/2026 = 120 jours (jan31+fev28+mar31+avr30)
// Durée exercice : 01/05/2024→30/04/2025 = 365 jours
const p1 = calculerProrata({ dateDebut: '2024-05-01', dateFin: '2025-04-30' }, 2026)
assert('prorata ex1 ≈ 0.3288', Math.abs(p1 - 0.3288) < 0.001, p1, '≈0.3288')

console.log('\n[3b] calculerProrata — exercice 01/05/2025→30/04/2026 sur 2026')
// Chevauchement : 01/05/2026→31/12/2026 = 245 jours
// Durée exercice : 365 jours
const p2 = calculerProrata({ dateDebut: '2025-05-01', dateFin: '2026-04-30' }, 2026)
assert('prorata ex2 ≈ 0.6712', Math.abs(p2 - 0.6712) < 0.001, p2, '≈0.6712')
assert('somme prorata ≈ 1', Math.abs(p1 + p2 - 1) < 0.01, p1+p2, '≈1')

// ── Test 4 : prorata exercice 01/07 sur année 2025 ────────────
console.log('\n[4] calculerProrata — exercice 01/07/2023→30/06/2024 sur 2025')
// Chevauchement : 01/01/2025→30/06/2024 = 0 jours (exercice terminé en 2024)
const p3 = calculerProrata({ dateDebut: '2023-07-01', dateFin: '2024-06-30' }, 2025)
assert('prorata ex1 sur 2025 = 0 (exercice clôturé avant 2025)', p3 === 0, p3, 0)

const p4 = calculerProrata({ dateDebut: '2024-07-01', dateFin: '2025-06-30' }, 2025)
assert('prorata ex2 sur 2025 ≈ 0.496', Math.abs(p4 - 0.496) < 0.01, p4, '≈0.496')

// ── Test 5 : calcul charges déductibles ───────────────────────
console.log('\n[5] calculerChargesCopro — exercice 01/05, 2026')
const result = calculerChargesCopro(
  { dateDebut:'2024-05-01', dateFin:'2025-04-30', chargesPayees:1200, dontNonDeduct:100, dontRecup:200 },
  { dateDebut:'2025-05-01', dateFin:'2026-04-30', chargesPayees:1300, dontNonDeduct:50,  dontRecup:150 },
  2026
)
assert('totalDeductible > 0',       result.totalDeductible > 0, result.totalDeductible, '>0')
assert('coherent = true',           result.coherent, result.coherent, true)
assert('somme prorata ≈ 1',         Math.abs(result.sommeProratas - 1) < 0.02, result.sommeProratas, '≈1')
// Ex1 : (1200-100-200)*0.3288 = 900*0.3288 ≈ 295.92
// Ex2 : (1300-50-150)*0.6712  = 1100*0.6712 ≈ 738.32
// Total ≈ 1034.24
assert('totalDeductible ≈ 1034',    Math.abs(result.totalDeductible - 1034) < 5, result.totalDeductible, '≈1034')

// ── Test 6 : lignes 2044 ──────────────────────────────────────
console.log('\n[6] calculerLignes2044Copro')
const ex1test = { dateDebut:'2023-07-01', dateFin:'2024-06-30', chargesPayees:800, dontNonDeduct:100, dontRecup:200 }
const lignes = calculerLignes2044Copro(500, ex1test, null, 2025)
assert('ligne229 >= 500',        lignes.ligne229 >= 500, lignes.ligne229, '>=500')
assert('ligne230 >= 0',          lignes.ligne230 >= 0, lignes.ligne230, '>=0')

// ── Test 7 : cas exercice annuel (01/01) ──────────────────────
console.log('\n[7] Exercice calé sur année civile — début 01/01')
const { ex1: ea, ex2: eb } = genererExercices(1, 1, 2026)
assert('ex1 = 2024',   ea.dateDebut === '2024-01-01' && ea.dateFin === '2024-12-31', ea, '2024-01-01→2024-12-31')
assert('ex2 = 2025',   eb.dateDebut === '2025-01-01' && eb.dateFin === '2025-12-31', eb, '2025-01-01→2025-12-31')
const pa = calculerProrata(ea, 2026)
const pb = calculerProrata(eb, 2026)
assert('ex1 prorata sur 2026 = 0 (terminé en 2024)', pa === 0, pa, 0)
assert('ex2 prorata sur 2026 = 0 (terminé en 2025)', pb === 0, pb, 0)

// ── Résumé ────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`)
console.log(`Résultats : ${passed} ✓  ${failed} ✗  (${passed+failed} tests)`)
if (failed > 0) process.exit(1)
