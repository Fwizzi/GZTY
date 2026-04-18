import { openDB } from 'idb'
import { DB_NAME, DB_VERSION, applySchema } from '../schema.js'

let _db = null

export async function getDB() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      applySchema(db, oldVersion)
    },
    blocked() { console.warn('FiscApp DB blocked — fermer les autres onglets') },
  })
  return _db
}

// ── Helpers génériques ────────────────────────────────────────

export async function findAll(store) {
  const db = await getDB()
  return db.getAll(store)
}

export async function findById(store, id) {
  const db = await getDB()
  return db.get(store, id)
}

export async function findByIndex(store, indexName, value) {
  const db = await getDB()
  return db.getAllFromIndex(store, indexName, value)
}

export async function findOneByIndex(store, indexName, value) {
  const db = await getDB()
  const results = await db.getAllFromIndex(store, indexName, value)
  return results[0] ?? null
}

export async function save(store, entity) {
  const db = await getDB()
  if (!entity.id) entity.id = crypto.randomUUID()
  entity.updatedAt = new Date().toISOString()
  if (!entity.createdAt) entity.createdAt = entity.updatedAt
  await db.put(store, entity)
  return entity
}

export async function deleteById(store, id) {
  const db = await getDB()
  return db.delete(store, id)
}

export async function countAll(store) {
  const db = await getDB()
  return db.count(store)
}
