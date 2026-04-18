import { useState, useEffect, useCallback } from 'react'
import { chargerDeclaration } from '../services/DeclarationService.js'

/**
 * Charge et recalcule toutes les données d'une année fiscale.
 * Se re-déclenche à chaque changement d'anneeFiscaleId.
 * Retourne null pendant le chargement pour forcer un re-render propre.
 */
export function useAnnee(profileId, anneeFiscaleId) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const charger = useCallback(async () => {
    if (!profileId || !anneeFiscaleId) {
      setData(null)
      return
    }
    setLoading(true)
    setData(null)   // reset explicite pour éviter affichage de données de l'année précédente
    setError(null)
    try {
      const result = await chargerDeclaration(profileId, anneeFiscaleId)
      setData(result)
    } catch (e) {
      console.error('useAnnee error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [profileId, anneeFiscaleId])

  // Rechargement à chaque changement d'année (anneeFiscaleId est la dépendance clé)
  useEffect(() => {
    charger()
  }, [charger])

  return { data, loading, error, refresh: charger }
}
