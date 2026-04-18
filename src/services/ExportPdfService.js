// ============================================================
// SERVICE EXPORT PDF — FiscApp v2
// Charte graphique : fond blanc, titres bleu DGFiP, tableaux
// sobres avec en-têtes colorés — style identique à l'export Excel
// ============================================================

const BLEU      = '#1f4e8c'
const BLEU_HEAD = '#1f4e8c'
const BLEU_ROWS = '#dce6f1'
const BLEU_ALT  = '#eef3fb'
const TEXTE     = '#1a1a1a'
const ROUGE     = '#c0392b'
const VERT      = '#1a6b3c'

const eur0 = v => Math.round(parseFloat(v)||0).toLocaleString('fr-FR')
const pct  = v => `${((parseFloat(v)||0)*100).toFixed(1)} %`

export function imprimerDeclaration(data) {
  const html = genererHTML(data)
  const win  = window.open('', '_blank', 'width=960,height=750')
  win.document.write(html)
  win.document.close()
  // setTimeout nécessaire : laisser le navigateur appliquer les styles
  // avant d'ouvrir la boîte de dialogue d'impression
  win.onload = () => {
    win.focus()
    setTimeout(() => win.print(), 500)
  }
}

export function genererHTML(data) {
  const { anneeFiscale, resumeBiens, salaires, scpis,
          declaration: d, totalNetImposable, totalAbattement, totalPAS } = data
  const annee  = anneeFiscale.annee
  const anneeD = anneeFiscale.anneeDeclaration || annee + 1

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Déclaration fiscale ${annee} — FiscApp</title>
  <style>${genCSS()}</style>
</head>
<body>
${bloc2042(d, salaires, totalNetImposable, totalAbattement, totalPAS, scpis, annee, anneeD)}
<div class="page-break"></div>
${bloc2044(resumeBiens, annee, anneeD)}
</body>
</html>`
}

function genCSS() {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  color: ${TEXTE};
  background: white;
  padding: 14mm 16mm;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
h1 { color: ${BLEU}; font-size: 13pt; font-weight: bold; text-align: center; margin-bottom: 2mm; }
.sous-titre { font-size: 8.5pt; color: ${BLEU}; margin-bottom: 6mm; }
.section { margin-bottom: 8mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
thead tr th { background: ${BLEU_HEAD} !important; color: white !important; font-weight: bold; padding: 2mm 3mm; text-align: left; border: 1px solid ${BLEU}; }
thead tr th.r { text-align: right; }
tbody tr td { padding: 1.8mm 3mm; border: 1px solid #c8d8ed; vertical-align: middle; }
tbody tr:nth-child(even) td { background: ${BLEU_ALT} !important; }
tbody tr:nth-child(odd)  td { background: white; }
.c1 { width: 18mm; font-weight: bold; color: ${BLEU}; }
.c3 { width: 32mm; text-align: right; font-family: 'Courier New', monospace; }
tr.sep td { background: ${BLEU_ROWS} !important; color: ${BLEU} !important; font-weight: bold; text-align: center; border-top: 1.5px solid ${BLEU}; border-bottom: 1.5px solid ${BLEU}; padding: 2mm; }
tr.tot td { background: ${BLEU_ROWS} !important; font-weight: bold !important; border-top: 2px solid ${BLEU}; }
tr.tot .c3 { color: ${TEXTE}; }
tr.bh td { background: ${BLEU_ALT} !important; font-weight: bold !important; color: ${BLEU} !important; border-top: 2px solid ${BLEU}; }
.note { font-size: 7.5pt; color: #888; margin-top: 5mm; border-top: 1px solid #ddd; padding-top: 2mm; }
.alerte { font-size: 8pt; background: #fff8e1; border-left: 3px solid #f59e0b; padding: 2mm 3mm; margin-bottom: 3mm; color: #7c5000; }
.page-break { page-break-after: always; }
@media print {
  body {
    padding: 8mm 10mm;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .page-break { page-break-after: always; }
}`
}

// ── Helpers lignes ────────────────────────────────────────
const hrow = (a,b,c) => `<tr>
  <th class="c1" style="background:${BLEU_HEAD}!important;color:white!important;border:1px solid ${BLEU};width:18mm">${a}</th>
  <th style="background:${BLEU_HEAD}!important;color:white!important;border:1px solid ${BLEU}">${b}</th>
  <th class="c3 r" style="background:${BLEU_HEAD}!important;color:white!important;border:1px solid ${BLEU};text-align:right;width:32mm">${c}</th></tr>`

const sep  = (l,n=3) => `<tr class="sep"><td colspan="${n}" style="background:${BLEU_ROWS}!important;color:${BLEU}!important">${l}</td></tr>`
const drow = (c,l,v)  => `<tr><td class="c1">${c}</td><td>${l}</td><td class="c3">${v}</td></tr>`
const trow = (l,v)    => `<tr class="tot"><td class="c1" style="background:${BLEU_ROWS}!important"></td><td style="background:${BLEU_ROWS}!important;font-weight:bold">${l}</td><td class="c3" style="background:${BLEU_ROWS}!important;font-weight:bold">${v}</td></tr>`

// ── Bloc synthèse 2042 ────────────────────────────────────
function bloc2042(d, salaires, totalNetImposable, totalAbattement, totalPAS, scpis, annee, anneeD) {
  const R = []

  R.push(sep('DÉCLARATION 2042'))
  R.push(hrow('Ligne','Libellé','Montant (€)'))
  R.push(drow('1AJ', 'Salaires net imposable',               eur0(totalNetImposable)))
  R.push(drow('',    'Abattement 10%',                       eur0(totalAbattement)))
  R.push(drow('',    'Revenu imposable salaires',             eur0(d.revenuImposableSalaires||0)))
  R.push(drow('',    '',                                     ''))  // ligne vide

  R.push(drow('4BA', 'Revenus fonciers imposables (bénéfice)',        eur0(d.case4BA||0)))
  R.push(drow('4BB', 'Déficit foncier — report sur revenus fonciers', eur0(d.case4BB||0)))
  R.push(drow('4BC', 'Déficit foncier — imputable revenu global',     eur0(d.case4BC||0)))
  R.push(drow('4BD', 'Déficits antérieurs restant à imputer',         eur0(d.case4BD||0)))

  R.push(sep('SIMULATION IR'))
  R.push(drow('', 'TMI (tranche marginale)',                pct(d.tmi)))
  R.push(drow('', 'IR net salaires seuls',                  eur0(d.irNetSalaires||0)))
  R.push(drow('', 'IR net global (salaires + foncier)',     eur0(d.irNetGlobal||0)))
  R.push(drow('', 'IR supplémentaire (foncier)',            eur0(d.irSupp||0)))
  R.push(drow('', 'Prélèvements sociaux 17,2%',             eur0(d.prelSociaux||0)))
  R.push(drow('', 'PAS déjà prélevé',                       eur0(totalPAS)))
  R.push(trow('Solde estimé à payer',                       eur0(d.impotRestantDu||0)))

  if (salaires.length > 0) {
    R.push(sep('SALAIRES'))
    R.push(hrow('—','Employeur','Net imposable'))
    for (const s of salaires) R.push(drow('', s.employeur||'—', eur0(s.netImposable||0)))
  }

  if (scpis.length > 0) {
    R.push(sep('SCPI'))
    R.push(hrow('—','SCPI','Revenus nets'))
    for (const s of scpis) R.push(drow('', `${s.nom||'?'} (${s.typeRevenu||'foncier'})`, eur0(s.revenusNets||0)))
  }

  const alerte = d.alerteDecotePerdue
    ? `<div class="alerte">⚠️ Perte de décote : vos revenus fonciers font passer l'IR au-dessus du seuil de décote. Impact : ${eur0(d.decotePerdue||0)} €</div>`
    : ''

  return `
<h1>DÉCLARATION FISCALE ${annee} — Revenus ${annee} (formulaires ${anneeD})</h1>
<div class="sous-titre">Généré par FiscApp v2.13.0</div>
${alerte}
<div class="section"><table><tbody>${R.join('')}</tbody></table></div>
<div class="note">⚠️ Simulation indicative — IR arrondi à l'euro (CGI art.1657) — vérifiez sur impots.gouv.fr avant dépôt.</div>`
}

// ── Bloc 2044 par bien ────────────────────────────────────
function bloc2044(resumeBiens, annee, anneeD) {
  const R = []

  R.push(sep('FORMULAIRE 2044 — REVENUS FONCIERS'))
  R.push(hrow('Ligne','Libellé','Montant (€)'))

  for (const { bien, r2044: r } of resumeBiens) {
    R.push(`<tr class="bh"><td colspan="3" style="background:${BLEU_ALT}!important;font-weight:bold;color:${BLEU}!important;border-top:2px solid ${BLEU}">${bien.nom||'Bien'} — ${bien.adresse||''}</td></tr>`)
    R.push(drow('211',     'Loyers bruts encaissés',                    eur0(r.ligne211 ?? r.ligne215)))
    R.push(drow('215 (E)', 'Total des recettes',                        eur0(r.ligne215)))
    if (r.ligne221) R.push(drow('221',     "Frais d'administration et de gestion", eur0(r.ligne221)))
    if (r.ligne222) R.push(drow('222',     'Forfait frais de gestion (20 €/local)',eur0(r.ligne222)))
    if (r.ligne223) R.push(drow('223',     "Primes d'assurance",                   eur0(r.ligne223)))
    if (r.ligne224) R.push(drow('224',     "Travaux de réparation et d'entretien", eur0(r.ligne224)))
    if (r.ligne224b)R.push(drow('224bis',  'Travaux rénovation énergétique',        eur0(r.ligne224b)))
    if (r.ligne227) R.push(drow('227',     `Taxes foncières ${annee}`,              eur0(r.ligne227)))
    if (r.ligne229) R.push(drow('229',     `Provisions copropriété payées en ${annee}`, eur0(r.ligne229)))
    if (r.ligne230) R.push(drow('230',     `Régularisation provisions ${annee-1}`,  eur0(r.ligne230)))
    R.push(trow(`240 (F) — Total frais et charges`,                    eur0(r.ligne240)))
    if (r.ligne250) R.push(drow('250 (G)', "Intérêts d'emprunt",                   eur0(r.ligne250)))
    R.push(trow(`263 (I) — ${r.ligne263 < 0 ? 'Déficit' : 'Bénéfice'} foncier`,   eur0(r.ligne263)))
  }

  const totE = resumeBiens.reduce((s,b)=>s+(b.r2044.ligne215||0),0)
  const totF = resumeBiens.reduce((s,b)=>s+(b.r2044.ligne240||0),0)
  const totG = resumeBiens.reduce((s,b)=>s+(b.r2044.ligne250||0),0)
  const totI = resumeBiens.reduce((s,b)=>s+(b.r2044.ligne263||0),0)

  R.push(sep('CASES À REPORTER EN DÉCLARATION 2042'))
  R.push(drow('E', 'Total des recettes',                              eur0(totE)))
  R.push(drow('F', 'Total des frais et charges',                      eur0(totF)))
  R.push(drow('G', "Intérêts d'emprunt",                              eur0(totG)))
  R.push(trow(`I — ${totI < 0 ? 'Déficit' : 'Bénéfice'} total → 4BA ou 4BB/4BC`, eur0(totI)))

  return `
<h1>DÉCLARATION 2044 — Revenus fonciers ${annee} (formulaires ${anneeD})</h1>
<div class="sous-titre">Généré par FiscApp v2.13.0</div>
<div class="section"><table><tbody>${R.join('')}</tbody></table></div>
<div class="note">⚠️ Simulation indicative — Montants arrondis à l'euro — vérifiez sur impots.gouv.fr avant dépôt.</div>`
}
