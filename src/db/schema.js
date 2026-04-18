// ============================================================
// SCHEMA IndexedDB — FiscApp v2
// Version: 2 — migration depuis v1 incluse
// ============================================================

export const DB_NAME = 'fiscapp'
export const DB_VERSION = 2

export const STORES = {
  PROFILES:           'profiles',
  ANNEES_FISCALES:    'anneesFiscales',
  BIENS:              'biens',
  BIEN_ANNEES:        'bienAnnees',
  TRANSACTIONS:       'transactions',
  REVENUS_SALARIAUX:  'revenusSalariaux',
  REVENUS_SCPI:       'revenusSCPI',
}

/**
 * Crée ou met à jour tous les object stores et leurs index.
 * Appelé automatiquement par idb lors d'un upgrade.
 */
export function applySchema(db, oldVersion) {
  // ── Profiles ──────────────────────────────────────────────
  if (!db.objectStoreNames.contains(STORES.PROFILES)) {
    db.createObjectStore(STORES.PROFILES, { keyPath: 'id' })
  }

  // ── Années fiscales ───────────────────────────────────────
  if (!db.objectStoreNames.contains(STORES.ANNEES_FISCALES)) {
    const s = db.createObjectStore(STORES.ANNEES_FISCALES, { keyPath: 'id' })
    s.createIndex('profileId',       'profileId',              { unique: false })
    s.createIndex('profileId_annee', ['profileId', 'annee'],   { unique: true  })
  }

  // ── Biens (caractéristiques stables) ─────────────────────
  if (!db.objectStoreNames.contains(STORES.BIENS)) {
    const s = db.createObjectStore(STORES.BIENS, { keyPath: 'id' })
    s.createIndex('profileId', 'profileId', { unique: false })
  }

  // ── BienAnnee (paramètres annuels d'un bien) ──────────────
  if (!db.objectStoreNames.contains(STORES.BIEN_ANNEES)) {
    const s = db.createObjectStore(STORES.BIEN_ANNEES, { keyPath: 'id' })
    s.createIndex('bienId',              'bienId',                          { unique: false })
    s.createIndex('anneeFiscaleId',      'anneeFiscaleId',                  { unique: false })
    s.createIndex('bienId_anneeId',      ['bienId', 'anneeFiscaleId'],      { unique: true  })
  }

  // ── Transactions ──────────────────────────────────────────
  if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
    const s = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' })
    s.createIndex('bienAnneeId',          'bienAnneeId',          { unique: false })
    s.createIndex('bienAnneeId_date',     ['bienAnneeId', 'date'],{ unique: false })
    s.createIndex('bienAnneeId_categorie',['bienAnneeId','categorie'],{ unique: false })
  }

  // ── Revenus salariaux ─────────────────────────────────────
  if (!db.objectStoreNames.contains(STORES.REVENUS_SALARIAUX)) {
    const s = db.createObjectStore(STORES.REVENUS_SALARIAUX, { keyPath: 'id' })
    s.createIndex('anneeFiscaleId',             'anneeFiscaleId',                     { unique: false })
    s.createIndex('anneeFiscaleId_profileId',   ['anneeFiscaleId', 'profileId'],      { unique: false })
  }

  // ── Revenus SCPI ──────────────────────────────────────────
  if (!db.objectStoreNames.contains(STORES.REVENUS_SCPI)) {
    const s = db.createObjectStore(STORES.REVENUS_SCPI, { keyPath: 'id' })
    s.createIndex('anneeFiscaleId',             'anneeFiscaleId',                     { unique: false })
    s.createIndex('anneeFiscaleId_profileId',   ['anneeFiscaleId', 'profileId'],      { unique: false })
  }
}
