// ============================================================
// SERVICE IMPORT / EXPORT JSON — FiscApp v2
// ============================================================

import {
  ProfileRepo, AnneeFiscaleRepo, BienRepo, BienAnneeRepo,
  TransactionRepo, RevenuSalarialRepo, RevenuSCPIRepo,
} from '../db/repositories/index.js'

export const FISCAPP_EXPORT_VERSION = '2.1'

// ── Export ───────────────────────────────────────────────────

/**
 * Exporte toutes les données d'un profil + ses années en JSON.
 */
export async function exporterProfil(profileId) {
  const profile  = await ProfileRepo.findById(profileId)
  if (!profile)  throw new Error(`Profil ${profileId} introuvable`)

  const annees   = await AnneeFiscaleRepo.findByProfile(profileId)
  const biens    = await BienRepo.findByProfile(profileId)
  const anneesData = []

  for (const af of annees) {
    const biensDonnees = []
    for (const bien of biens) {
      const bienAnnee = await BienAnneeRepo.findByBienEtAnnee(bien.id, af.id)
      const transactions = bienAnnee
        ? await TransactionRepo.findByBienAnnee(bienAnnee.id)
        : []
      biensDonnees.push({
        nom:            bien.nom,
        adresse:        bien.adresse || '',
        type:           bien.type,
        coproDebutJjMm: bien.coproDebutJjMm || '',
        coproFinJjMm:   bien.coproFinJjMm   || '',
        bienAnnee:      bienAnnee ? {
          nbLocaux:  bienAnnee.nbLocaux,
          regime:    bienAnnee.regime,
          prets:     bienAnnee.prets     || [],
          copro:     bienAnnee.copro     || {},
        } : null,
        transactions: transactions.map(tx => ({
          date:        tx.date,
          titre:       tx.titre,
          montant:     tx.montant,
          sens:        tx.sens,
          categorie:   tx.categorie,
          notes:       tx.notes || '',
          groupeId:    tx.groupeId    || null,
          groupeType:  tx.groupeType  || null,
          groupeIndex: tx.groupeIndex ?? null,
          groupeTitre: tx.groupeTitre || null,
        })),
      })
    }

    const salaires = await RevenuSalarialRepo.findByAnnee(af.id)
    const scpi     = await RevenuSCPIRepo.findByAnnee(af.id)

    anneesData.push({
      annee:               af.annee,
      anneeDeclaration:    af.anneeDeclaration,
      statut:              af.statut,
      bareme:              af.bareme,
      deficitsReportables: af.deficitsReportables || {},
      notes:               af.notes || '',
      biens:               biensDonnees,
      salaires:            salaires.map(s => ({
        employeur:        s.employeur,
        netImposable:     s.netImposable,
        prelSource:       s.prelSource,
        modeAbattement:   s.modeAbattement,
        fraisReels:       s.fraisReels || {},
        notes:            s.notes || '',
      })),
      scpi: scpi.map(s => ({
        nom:          s.nom,
        revenusNets:  s.revenusNets,
        typeRevenu:   s.typeRevenu,
        prelSource:   s.prelSource || 0,
        notes:        s.notes || '',
      })),
    })
  }

  return {
    version:    FISCAPP_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      nom:       profile.nom,
      situation: profile.situation,
      nbParts:   profile.nbParts,
    },
    annees: anneesData,
  }
}

/** Télécharge le JSON dans le navigateur */
export function telechargerJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename || `fiscapp-export-${new Date().getFullYear()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Validation ────────────────────────────────────────────────

/**
 * Valide la structure d'un fichier JSON importé.
 * Retourne { ok, errors, warnings, preview }
 */
export function validerImport(data) {
  const errors   = []
  const warnings = []

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok:false, errors:['Le fichier n\'est pas un objet JSON valide.'], warnings:[], preview:null }
  }

  // Détecter si c'est un fichier de résultats de calcul (debug) plutôt qu'un fichier d'import
  // Le fichier debug contient "declaration", "resumeBiens", "salaires" à la racine
  if (data.declaration && data.resumeBiens !== undefined) {
    return {
      ok: false,
      errors: [
        'Ce fichier est un export de résultats de calcul (debug), pas un fichier d\'import.',
        'Pour exporter vos données, utilisez le bouton "Exporter mes données (JSON)" dans Paramètres → Profils & Années.',
      ],
      warnings: [],
      preview: null,
    }
  }

  // Version
  if (!data.version) {
    warnings.push('Version non spécifiée — le fichier peut provenir d\'une ancienne version.')
  } else if (!data.version.startsWith('2.')) {
    warnings.push(`Version ${data.version} — certains champs peuvent être absents.`)
  }

  // Profil
  if (!data.profile) {
    errors.push('Champ "profile" manquant. Ce fichier ne semble pas être un export FiscApp valide.')
  } else {
    if (!data.profile.nom)     errors.push('profile.nom manquant.')
    if (!data.profile.nbParts) warnings.push('profile.nbParts absent — 1 part sera utilisé par défaut.')
  }

  // Années
  if (!Array.isArray(data.annees) || data.annees.length === 0) {
    errors.push('Le champ "annees" est vide ou absent.')
  } else {
    data.annees.forEach((af, i) => {
      const pfx = `annees[${i}]`
      if (!af.annee || typeof af.annee !== 'number') errors.push(`${pfx}.annee doit être un nombre.`)
      if (!Array.isArray(af.biens))                  warnings.push(`${pfx}.biens absent ou non-tableau.`)
      if (!Array.isArray(af.salaires))               warnings.push(`${pfx}.salaires absent.`)
      if (af.biens) {
        af.biens.forEach((bien, j) => {
          if (!bien.nom)         warnings.push(`${pfx}.biens[${j}].nom absent.`)
          if (!Array.isArray(bien.transactions)) warnings.push(`${pfx}.biens[${j}].transactions absent.`)
        })
      }
    })
  }

  // Résumé pour la preview
  const preview = errors.length === 0 ? {
    profileNom:  data.profile?.nom || '?',
    nbAnnees:    data.annees?.length || 0,
    annees:      (data.annees||[]).map(af => ({
      annee:      af.annee,
      nbBiens:    (af.biens||[]).length,
      nbTx:       (af.biens||[]).reduce((s,b)=>s+(b.transactions||[]).length,0),
      nbSalaires: (af.salaires||[]).length,
      nbSCPI:     (af.scpi||[]).length,
    })),
    exportedAt:  data.exportedAt || null,
  } : null

  return { ok:errors.length === 0, errors, warnings, preview }
}

// ── Import ────────────────────────────────────────────────────

/**
 * Stratégies d'import :
 *   'replace' : supprime le profil existant et recrée tout depuis le JSON
 *   'merge'   : ajoute les années manquantes au profil existant (ne touche pas aux années déjà présentes)
 */
export async function importerDonnees(data, strategieImport, profileId) {
  const { ok, errors } = validerImport(data)
  if (!ok) throw new Error(`Import invalide : ${errors.join(', ')}`)

  // ── Stratégie REPLACE ─────────────────────────────────────
  if (strategieImport === 'replace') {
    // Effacer toutes les données du profil cible
    if (profileId) await supprimerDonneesProfil(profileId)

    // Créer ou mettre à jour le profil
    const profile = await ProfileRepo.save(
      profileId
        ? { id:profileId, nom:data.profile.nom, situation:data.profile.situation||'Célibataire', nbParts:data.profile.nbParts||1 }
        : {              nom:data.profile.nom, situation:data.profile.situation||'Célibataire', nbParts:data.profile.nbParts||1 }
    )
    return await _importerAnnees(data.annees, profile.id)
  }

  // ── Stratégie MERGE ───────────────────────────────────────
  if (strategieImport === 'merge') {
    if (!profileId) throw new Error('profileId requis pour la stratégie merge.')
    const anneesExistantes = await AnneeFiscaleRepo.findByProfile(profileId)
    const anneesExistanteSet = new Set(anneesExistantes.map(a=>a.annee))

    // N'importer que les années absentes
    const anneesAImporter = data.annees.filter(af => !anneesExistanteSet.has(af.annee))
    if (anneesAImporter.length === 0) {
      return { nbAnneesImportees:0, message:'Toutes les années existent déjà — aucun import effectué.' }
    }
    return await _importerAnnees(anneesAImporter, profileId)
  }

  throw new Error(`Stratégie inconnue : ${strategieImport}`)
}

// ── Helpers internes ──────────────────────────────────────────

async function supprimerDonneesProfil(profileId) {
  const biens  = await BienRepo.findByProfile(profileId)
  const annees = await AnneeFiscaleRepo.findByProfile(profileId)

  // Supprimer transactions → bienAnnees → salaires → scpi → annees → biens
  for (const af of annees) {
    const bas = await BienAnneeRepo.findByAnneeFiscale(af.id)
    for (const ba of bas) await TransactionRepo.deleteAllForBienAnnee(ba.id)
    for (const ba of bas) await BienAnneeRepo.delete(ba.id)
    const sals = await RevenuSalarialRepo.findByAnnee(af.id)
    for (const s of sals) await RevenuSalarialRepo.delete(s.id)
    const scpis = await RevenuSCPIRepo.findByAnnee(af.id)
    for (const s of scpis) await RevenuSCPIRepo.delete(s.id)
    await AnneeFiscaleRepo.delete(af.id)
  }
  for (const b of biens) await BienRepo.delete(b.id)
}

async function _importerAnnees(anneesData, profileId) {
  const biensCrees = {}   // nom → id (pour partager entre années)
  let nbTx = 0, nbAnnees = 0

  for (const afData of anneesData) {
    // Créer l'AnneeFiscale
    const af = await AnneeFiscaleRepo.save({
      profileId,
      annee:               afData.annee,
      anneeDeclaration:    afData.anneeDeclaration || afData.annee + 1,
      statut:              afData.statut || 'en_cours',
      bareme:              afData.bareme || null,
      deficitsReportables: afData.deficitsReportables || {},
      notes:               afData.notes || '',
    })

    // Biens + BienAnnees + Transactions
    for (const bienData of (afData.biens||[])) {
      // Réutiliser un bien déjà créé (même nom) pour éviter les doublons inter-années
      let bienId = biensCrees[bienData.nom]
      if (!bienId) {
        const bien = await BienRepo.save({
          profileId,
          nom:            bienData.nom,
          adresse:        bienData.adresse || '',
          type:           bienData.type || 'location_nue',
          coproDebutJjMm: bienData.coproDebutJjMm || '',
          coproFinJjMm:   bienData.coproFinJjMm   || '',
        })
        bienId = bien.id
        biensCrees[bienData.nom] = bienId
      }

      if (bienData.bienAnnee) {
        const ba = await BienAnneeRepo.save({
          bienId,
          anneeFiscaleId: af.id,
          nbLocaux:       bienData.bienAnnee.nbLocaux || 1,
          regime:         bienData.bienAnnee.regime   || 'reel',
          prets:          bienData.bienAnnee.prets    || [],
          copro:          bienData.bienAnnee.copro    || {},
        })

        for (const tx of (bienData.transactions||[])) {
          await TransactionRepo.save({
            bienAnneeId: ba.id,
            date:        tx.date,
            titre:       tx.titre || tx.libelle || '',  // compat ancien format
            montant:     tx.montant || 0,
            sens:        tx.sens,
            categorie:   tx.categorie,
            notes:       tx.notes || '',
            groupeId:    tx.groupeId    || null,
            groupeType:  tx.groupeType  || null,
            groupeIndex: tx.groupeIndex ?? null,
            groupeTitre: tx.groupeTitre || null,
          })
          nbTx++
        }
      }
    }

    // Salaires
    for (const sal of (afData.salaires||[])) {
      await RevenuSalarialRepo.save({
        anneeFiscaleId:  af.id,
        profileId,
        employeur:       sal.employeur,
        netImposable:    sal.netImposable,
        prelSource:      sal.prelSource || 0,
        modeAbattement:  sal.modeAbattement || 'forfaitaire',
        fraisReels:      sal.fraisReels || {},
        notes:           sal.notes || '',
      })
    }

    // SCPI
    for (const scpi of (afData.scpi||[])) {
      await RevenuSCPIRepo.save({
        anneeFiscaleId: af.id,
        profileId,
        nom:            scpi.nom,
        revenusNets:    scpi.revenusNets,
        typeRevenu:     scpi.typeRevenu || 'foncier',
        prelSource:     scpi.prelSource || 0,
        notes:          scpi.notes || '',
      })
    }

    nbAnnees++
  }

  return {
    nbAnneesImportees: nbAnnees,
    nbTransactions:    nbTx,
    message: `Import réussi — ${nbAnnees} année${nbAnnees>1?'s':''}, ${nbTx} transaction${nbTx>1?'s':''}.`,
  }
}

// Helpers repo (ajouter méthodes manquantes si nécessaire)
// Ces méthodes doivent exister dans repositories/index.js
async function safeDelete(repo, id) {
  try { await repo.delete(id) } catch(e) { console.warn('delete failed', id, e) }
}
