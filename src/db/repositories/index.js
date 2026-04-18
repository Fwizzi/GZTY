import { STORES } from '../schema.js'
import { findAll, findById, findByIndex, findOneByIndex, save, deleteById } from './base.js'
import { getBareme } from '../../services/fiscal/BaremeService.js'

// ── Profiles ──────────────────────────────────────────────────

export const ProfileRepo = {
  findAll:    ()     => findAll(STORES.PROFILES),
  findById:   (id)   => findById(STORES.PROFILES, id),
  save:       (p)    => save(STORES.PROFILES, p),
  delete:     (id)   => deleteById(STORES.PROFILES, id),
}

// ── Années fiscales ───────────────────────────────────────────

export const AnneeFiscaleRepo = {
  findAll: () =>
    findAll(STORES.ANNEES_FISCALES),

  findById: (id) =>
    findById(STORES.ANNEES_FISCALES, id),

  findByProfile: (profileId) =>
    findByIndex(STORES.ANNEES_FISCALES, 'profileId', profileId),

  findByProfileAndAnnee: (profileId, annee) =>
    findOneByIndex(STORES.ANNEES_FISCALES, 'profileId_annee', [profileId, annee]),

  save: (a) => save(STORES.ANNEES_FISCALES, a),

  delete: (id) => deleteById(STORES.ANNEES_FISCALES, id),

  /**
   * Crée une AnneeFiscale avec le barème officiel snapshot.
   * Si elle existe déjà pour ce profil/année, la retourne sans modifier.
   */
  async getOrCreate(profileId, annee) {
    const existing = await AnneeFiscaleRepo.findByProfileAndAnnee(profileId, annee)
    if (existing) return existing
    const bareme = getBareme(annee)
    return AnneeFiscaleRepo.save({
      profileId,
      annee,
      anneeDeclaration: bareme.anneeDeclaration,
      statut: 'en_cours',
      bareme,
      deficitsReportables: {},   // { 2020: 0, 2021: 0, ... }
      notes: '',
    })
  },

  /**
   * Duplique une année vers l'année suivante.
   * Copie : structure bienAnnees (sans transactions), paramètres.
   * Ne copie PAS : transactions, salaires, SCPI.
   */
  async dupliquer(anneeId, anneeTarget, profileId) {
    const src = await AnneeFiscaleRepo.findById(anneeId)
    if (!src) throw new Error(`AnneeFiscale ${anneeId} introuvable`)

    const existing = await AnneeFiscaleRepo.findByProfileAndAnnee(profileId, anneeTarget)
    if (existing) throw new Error(`L'année ${anneeTarget} existe déjà pour ce profil`)

    // Créer la nouvelle année avec barème mis à jour
    const newAnnee = await AnneeFiscaleRepo.save({
      profileId,
      annee: anneeTarget,
      anneeDeclaration: anneeTarget + 1,
      statut: 'en_cours',
      bareme: getBareme(anneeTarget),
      deficitsReportables: src.deficitsReportables || {},
      notes: '',
    })

    // Dupliquer les bienAnnees
    const bienAnneesSrc = await BienAnneeRepo.findByAnneeFiscale(anneeId)
    for (const ba of bienAnneesSrc) {
      await BienAnneeRepo.save({
        bienId: ba.bienId,
        anneeFiscaleId: newAnnee.id,
        nbLocaux: ba.nbLocaux,
        regime: ba.regime,
        copro: {
          nomSyndic: ba.copro?.nomSyndic || '',
          exercices: (ba.copro?.exercices || []).map(ex => ({
            ...ex,
            chargesPayees: 0,
            dontNonDeduct: 0,
            dontRecup: 0,
          })),
        },
        prets: (ba.prets || []).map(p => ({
          ...p,
          id: crypto.randomUUID(),
          interets: 0,
          assurance: 0,
        })),
      })
    }

    return newAnnee
  },
}

// ── Biens ─────────────────────────────────────────────────────

export const BienRepo = {
  findAll:         ()          => findAll(STORES.BIENS),
  findById:        (id)        => findById(STORES.BIENS, id),
  findByProfile:   (profileId) => findByIndex(STORES.BIENS, 'profileId', profileId),
  save:            (b)         => save(STORES.BIENS, b),
  delete:          (id)        => deleteById(STORES.BIENS, id),
}

// ── BienAnnee ─────────────────────────────────────────────────

export const BienAnneeRepo = {
  findAll:           ()              => findAll(STORES.BIEN_ANNEES),
  findById:          (id)            => findById(STORES.BIEN_ANNEES, id),
  findByBien:        (bienId)        => findByIndex(STORES.BIEN_ANNEES, 'bienId', bienId),
  findByAnneeFiscale:(anneeId)       => findByIndex(STORES.BIEN_ANNEES, 'anneeFiscaleId', anneeId),

  findByBienEtAnnee: (bienId, anneeId) =>
    findOneByIndex(STORES.BIEN_ANNEES, 'bienId_anneeId', [bienId, anneeId]),

  save: (ba) => save(STORES.BIEN_ANNEES, ba),
  delete: (id) => deleteById(STORES.BIEN_ANNEES, id),

  async getOrCreate(bienId, anneeFiscaleId) {
    const existing = await BienAnneeRepo.findByBienEtAnnee(bienId, anneeFiscaleId)
    if (existing) return existing
    return BienAnneeRepo.save({
      bienId,
      anneeFiscaleId,
      nbLocaux: 1,
      regime: 'reel',
      copro: { nomSyndic: '', exercices: [] },
      prets: [],
    })
  },
}

// ── Transactions ──────────────────────────────────────────────

export const CATEGORIES_TX = {
  loyer:              { label: 'Loyers encaissés',                  sens: 'recette', ligne2044: 211 },
  charges_locataire:  { label: 'Charges locataire (transparentes)',  sens: 'recette', ligne2044: null },
  assurance:          { label: 'Assurance (PNO, GLI…)',             sens: 'charge',  ligne2044: 223 },
  assurance_emprunt:  { label: 'Assurance emprunt',                 sens: 'charge',  ligne2044: 250 },
  charges_copro:      { label: 'Charges de copropriété',            sens: 'charge',  ligne2044: 229 },
  taxe_fonciere:      { label: 'Taxe foncière',                     sens: 'charge',  ligne2044: 227 },
  travaux:            { label: 'Travaux',                           sens: 'charge',  ligne2044: 224 },
  travaux_energetique:{ label: 'Travaux rénovation énergétique',    sens: 'charge',  ligne2044: '224b' },
  frais_gestion:      { label: 'Frais de gestion (agence)',         sens: 'charge',  ligne2044: 221 },
  interets_emprunt:   { label: 'Intérêts d\'emprunt',               sens: 'charge',  ligne2044: 250 },
  frais_bancaires:    { label: 'Frais bancaires',                   sens: 'charge',  ligne2044: 250 },
  autre:              { label: 'Autre charge',                      sens: 'charge',  ligne2044: 221 },
}

export const TransactionRepo = {
  findAll:           ()            => findAll(STORES.TRANSACTIONS),
  findById:          (id)          => findById(STORES.TRANSACTIONS, id),
  findByBienAnnee:   (bienAnneeId) => findByIndex(STORES.TRANSACTIONS, 'bienAnneeId', bienAnneeId),
  save:              (t)           => save(STORES.TRANSACTIONS, t),
  delete:            (id)          => deleteById(STORES.TRANSACTIONS, id),

  async deleteAllForBienAnnee(bienAnneeId) {
    const txs = await TransactionRepo.findByBienAnnee(bienAnneeId)
    for (const t of txs) await deleteById(STORES.TRANSACTIONS, t.id)
  },
}

// ── Revenus salariaux ─────────────────────────────────────────

export const RevenuSalarialRepo = {
  findAll:           ()           => findAll(STORES.REVENUS_SALARIAUX),
  findById:          (id)         => findById(STORES.REVENUS_SALARIAUX, id),
  findByAnnee:       (anneeId)    => findByIndex(STORES.REVENUS_SALARIAUX, 'anneeFiscaleId', anneeId),
  save:              (r)          => save(STORES.REVENUS_SALARIAUX, r),
  delete:            (id)         => deleteById(STORES.REVENUS_SALARIAUX, id),
}

// ── Revenus SCPI ──────────────────────────────────────────────

export const RevenuSCPIRepo = {
  findAll:           ()           => findAll(STORES.REVENUS_SCPI),
  findById:          (id)         => findById(STORES.REVENUS_SCPI, id),
  findByAnnee:       (anneeId)    => findByIndex(STORES.REVENUS_SCPI, 'anneeFiscaleId', anneeId),
  save:              (r)          => save(STORES.REVENUS_SCPI, r),
  delete:            (id)         => deleteById(STORES.REVENUS_SCPI, id),
}
