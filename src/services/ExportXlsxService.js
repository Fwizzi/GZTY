// ============================================================
// SERVICE EXPORT XLSX — FiscApp
// Génère un fichier Excel compatible Numbers et Excel
// 3 onglets : Synthèse, Détail par bien, Copropriété
// ============================================================

/**
 * Génère le contenu d'un fichier XLSX à partir des données de déclaration.
 * Utilise la bibliothèque SheetJS (xlsx) disponible en CDN.
 *
 * @param {object} data  Résultat de chargerDeclaration()
 * @returns {Blob}       Fichier .xlsx téléchargeable
 */
export async function exporterXlsx(data) {
  // Import dynamique de SheetJS
  const XLSX = await importSheetJS()
  const wb   = XLSX.utils.book_new()

  const { anneeFiscale, resumeBiens, salaires, scpis, declaration: d,
          totalNetImposable, totalAbattement, totalPAS, revenusSCPI } = data
  const annee    = anneeFiscale.annee
  const anneeD   = anneeFiscale.anneeDeclaration || annee + 1
  const profil   = data.profil || {}

  // ── Onglet 1 : Synthèse ──────────────────────────────────
  const synthese = []
  const addS = (label, val, section) => synthese.push(
    section ? ['', '', '', ''] : [label, val ?? '', '', '']
  )

  synthese.push([`DÉCLARATION FISCALE ${annee} — Revenus ${annee} (formulaires ${anneeD})`, '', '', ''])
  synthese.push([`Généré par FiscApp v2.12.6`, '', '', ''])
  synthese.push([''])
  synthese.push(['DÉCLARATION 2042', '', '', ''])
  synthese.push(['Ligne', 'Libellé', 'Montant (€)', ''])
  synthese.push(['1AJ', 'Salaires net imposable', Math.round(totalNetImposable)])
  synthese.push(['',    'Abattement 10%',          Math.round(totalAbattement)])
  synthese.push(['',    'Revenu imposable salaires',Math.round(d.revenuImposableSalaires||0)])
  synthese.push([''])
  synthese.push(['4BA', 'Revenus fonciers imposables (bénéfice)', Math.round(d.case4BA||0)])
  synthese.push(['4BB', 'Déficit foncier — report sur revenus fonciers', Math.round(d.case4BB||0)])
  synthese.push(['4BC', 'Déficit foncier — imputable revenu global', Math.round(d.case4BC||0)])
  synthese.push(['4BD', 'Déficits antérieurs restant à imputer', Math.round(d.case4BD||0)])
  synthese.push([''])
  synthese.push(['SIMULATION IR', '', '', ''])
  synthese.push(['',    'TMI (tranche marginale)',          `${((d.tmi||0)*100).toFixed(1)} %`])
  synthese.push(['',    'IR net salaires seuls',            Math.round(d.irNetSalaires||0)])
  synthese.push(['',    'IR net global (salaires + foncier)',Math.round(d.irNetGlobal||0)])
  synthese.push(['',    'IR supplémentaire (foncier)',      Math.round(d.irSupp||0)])
  synthese.push(['',    'Prélèvements sociaux 17,2%',       Math.round(d.prelSociaux||0)])
  synthese.push(['',    'PAS déjà prélevé',                 Math.round(totalPAS)])
  synthese.push(['',    'Solde estimé à payer',             Math.round(d.impotRestantDu||0)])
  if (d.alerteDecotePerdue) {
    synthese.push(['',  '⚠️ Perte de décote (foncier)',     Math.round(d.decotePerdue||0)])
  }
  synthese.push([''])

  // Salaires
  if (salaires.length > 0) {
    synthese.push(['SALAIRES', '', '', ''])
    synthese.push(['Employeur', 'Net imposable', 'PAS prélevé', 'Mode abattement'])
    for (const s of salaires) {
      synthese.push([s.employeur||'', Math.round(s.netImposable||0), Math.round(s.prelSource||0), s.modeAbattement||'forfaitaire'])
    }
    synthese.push([''])
  }

  // SCPI
  if (scpis.length > 0) {
    synthese.push(['SCPI', '', '', ''])
    synthese.push(['Nom SCPI', 'Revenus nets', 'Type', 'PAS'])
    for (const s of scpis) {
      synthese.push([s.nom||'', Math.round(s.revenusNets||0), s.typeRevenu||'foncier', Math.round(s.prelSource||0)])
    }
    synthese.push([''])
  }

  synthese.push(['⚠️ Simulation indicative — vérifier sur impots.gouv.fr', '', '', ''])

  const wsSynthese = XLSX.utils.aoa_to_sheet(synthese)
  _styleSheet(wsSynthese, synthese, XLSX)
  wsSynthese['!cols'] = [{ wch:45 }, { wch:42 }, { wch:18 }, { wch:18 }]
  XLSX.utils.book_append_sheet(wb, wsSynthese, `Synthèse ${annee}`)

  // ── Onglet 2 : Détail 2044 par bien ──────────────────────
  const detail = []
  const bienNoms = resumeBiens.map(b => b.bien.nom || `Bien ${b.bien.id?.slice(0,4)}`)

  // En-têtes
  detail.push([`DÉTAIL FORMULAIRE 2044 — Revenus ${annee}`, ...bienNoms, 'TOTAL'])

  const lignes2044 = [
    ['211', 'Loyers bruts encaissés',                         r => r.ligne211 ?? r.ligne215],
    ['215 (E)', 'Total des recettes',                          r => r.ligne215],
    ['221', 'Frais d\'administration et de gestion',          r => r.ligne221],
    ['222', 'Forfait frais de gestion (20€/local)',           r => r.ligne222],
    ['223', 'Primes d\'assurance',                            r => r.ligne223],
    ['224', 'Travaux réparation/entretien',                   r => r.ligne224],
    ['224bis (K)', 'Travaux rénovation énergétique',          r => r.ligne224b],
    ['227', 'Taxes foncières',                                r => r.ligne227],
    ['229', 'Provisions copropriété payées',                  r => r.ligne229],
    ['230', 'Régularisation provisions N-1',                  r => r.ligne230],
    ['240 (F)', 'Total des frais et charges',                 r => r.ligne240],
    ['250 (G)', 'Intérêts d\'emprunt',                        r => r.ligne250],
    ['263 (I)', 'Bénéfice (+) ou déficit (–)',                r => r.ligne263],
  ]

  for (const [code, label, getter] of lignes2044) {
    const vals = resumeBiens.map(b => Math.round(getter(b.r2044) || 0))
    const total = vals.reduce((s, v) => s + v, 0)
    detail.push([`${code} — ${label}`, ...vals, total])
  }

  detail.push([''])
  detail.push(['CASES À REPORTER EN 2042', '', ...Array(bienNoms.length).fill('')])
  detail.push([`Case E — Total recettes`,  ...Array(bienNoms.length).fill(''), Math.round(resumeBiens.reduce((s,b)=>s+(b.r2044.ligne215||0),0))])
  detail.push([`Case F — Total charges`,   ...Array(bienNoms.length).fill(''), Math.round(resumeBiens.reduce((s,b)=>s+(b.r2044.ligne240||0),0))])
  detail.push([`Case G — Intérêts`,        ...Array(bienNoms.length).fill(''), Math.round(resumeBiens.reduce((s,b)=>s+(b.r2044.ligne250||0),0))])
  detail.push([`Case I — Résultat`,        ...Array(bienNoms.length).fill(''), Math.round(resumeBiens.reduce((s,b)=>s+(b.r2044.ligne263||0),0))])

  const wsDetail = XLSX.utils.aoa_to_sheet(detail)
  wsDetail['!cols'] = [{ wch:48 }, ...bienNoms.map(() => ({ wch:18 })), { wch:18 }]
  XLSX.utils.book_append_sheet(wb, wsDetail, `2044 détail`)

  // ── Onglet 3 : Copropriété / Prorata ─────────────────────
  const copro = []
  copro.push([`COPROPRIÉTÉ — Calcul ligne 230 — Déclaration ${anneeD}`, '', '', '', ''])
  copro.push([''])

  for (const { bien, bienAnnee, r2044 } of resumeBiens) {
    const rc = r2044.resultCopro
    if (!rc) continue
    copro.push([`BIEN : ${bien.nom || ''}`, '', '', '', ''])
    copro.push(['Exercice', 'Prorata (jours)', 'Prorata (%)', 'Provisions déduites', 'À réintégrer'])

    const parts = [rc.part1, rc.part2].filter(Boolean)
    for (const p of parts) {
      copro.push([
        p.label || '',
        `${p.jours || '—'}j / ${p.joursAnnee || '—'}j`,
        `${((p.prorata||0)*100).toFixed(4)} %`,
        Math.round(p.provisionsDeduites || 0),
        Math.round(p.aReintegrer || 0),
      ])
    }
    copro.push(['', '', `TOTAL prorata : ${((rc.totalProrata||0)*100).toFixed(4)} %`, '', ''])
    copro.push([`Ligne 229 (provisions payées en ${annee})`, '', '', '', Math.round(r2044.ligne229||0)])
    copro.push([`Ligne 230 (à réintégrer)`, '', '', '', Math.round(r2044.ligne230||0)])
    copro.push([''])
  }

  if (copro.length <= 3) {
    copro.push(['Aucune donnée de copropriété saisie.', '', '', '', ''])
  }

  const wsCopro = XLSX.utils.aoa_to_sheet(copro)
  wsCopro['!cols'] = [{ wch:44 }, { wch:20 }, { wch:20 }, { wch:22 }, { wch:18 }]
  XLSX.utils.book_append_sheet(wb, wsCopro, `Copropriété`)

  // ── Export ───────────────────────────────────────────────
  const buf      = XLSX.write(wb, { bookType:'xlsx', type:'array' })
  return new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Télécharge le Blob xlsx */
export function telechargerXlsx(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Style minimal (titres en gras, séparateurs) ───────────
function _styleSheet(ws, aoa, XLSX) {
  // SheetJS CE ne supporte pas les styles — on laisse la structure parler
  // (titres sur colonne unique, séparateurs = lignes vides)
}

// ── Import SheetJS depuis CDN ─────────────────────────────
async function importSheetJS() {
  if (typeof window !== 'undefined' && window.XLSX) return window.XLSX
  return new Promise((resolve, reject) => {
    const s    = document.createElement('script')
    s.src      = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload   = () => resolve(window.XLSX)
    s.onerror  = reject
    document.head.appendChild(s)
  })
}
