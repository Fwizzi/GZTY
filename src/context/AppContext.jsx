import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ProfileRepo, AnneeFiscaleRepo, BienRepo, BienAnneeRepo } from '../db/repositories/index.js'
import { getAnneesDisponibles, getBareme } from '../services/fiscal/BaremeService.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [profiles,       setProfiles]       = useState([])
  const [currentProfile, setCurrentProfile] = useState(null)
  const [anneesFiscales, setAnneesFiscales] = useState([])
  const [currentAnnee,   setCurrentAnneeRaw] = useState(null)
  const [loading,        setLoading]        = useState(true)

  // ── Chargement initial ────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const profs = await ProfileRepo.findAll()
      setProfiles(profs)
      if (profs.length > 0) setCurrentProfile(profs[0])
      setLoading(false)
    }
    init()
  }, [])

  // ── Chargement années quand profil change ─────────────────
  useEffect(() => {
    if (!currentProfile) { setAnneesFiscales([]); setCurrentAnneeRaw(null); return }
    AnneeFiscaleRepo.findByProfile(currentProfile.id).then(annees => {
      const sorted = annees.sort((a, b) => b.annee - a.annee)
      setAnneesFiscales(sorted)
      // Sélectionner l'année la plus récente par défaut
      if (sorted.length > 0) setCurrentAnneeRaw(sorted[0])
    })
  }, [currentProfile?.id])

  // ── Changement d'année : wrapper qui assure le rechargement ─
  const setCurrentAnnee = useCallback((annee) => {
    // Force un nouveau render même si même id (données potentiellement modifiées)
    setCurrentAnneeRaw(null)
    setTimeout(() => setCurrentAnneeRaw(annee), 0)
  }, [])

  // ── Ouvrir/créer une année ────────────────────────────────
  const ouvrirAnnee = useCallback(async (anneeNum) => {
    if (!currentProfile) return null

    // 1. Créer ou récupérer l'AnneeFiscale
    let af = await AnneeFiscaleRepo.findByProfileAndAnnee(currentProfile.id, anneeNum)
    if (!af) {
      af = await AnneeFiscaleRepo.save({
        profileId:        currentProfile.id,
        annee:            anneeNum,
        anneeDeclaration: anneeNum + 1,
        statut:           'en_cours',
        bareme:           getBareme(anneeNum),
        deficitsReportables: {},
        notes: '',
      })
    }

    // 2. Créer BienAnnee pour chaque bien du profil (si inexistant)
    const biens = await BienRepo.findByProfile(currentProfile.id)
    for (const bien of biens) {
      const existing = await BienAnneeRepo.findByBienEtAnnee(bien.id, af.id)
      if (!existing) {
        await BienAnneeRepo.save({
          bienId:         bien.id,
          anneeFiscaleId: af.id,
          nbLocaux:       1,
          regime:         'reel',
          copro: {
            debutJjMm:      bien.coproDebutJjMm || '',
            finJjMm:        bien.coproFinJjMm   || '',
            exercice1Data:  {},
            exercice2Data:  {},
          },
          prets: [],
        })
      }
    }

    // 3. Rafraîchir la liste et sélectionner
    const annees = await AnneeFiscaleRepo.findByProfile(currentProfile.id)
    const sorted = annees.sort((a, b) => b.annee - a.annee)
    setAnneesFiscales(sorted)
    setCurrentAnnee(af)
    return af
  }, [currentProfile])

  // ── Dupliquer une année (ou créer vierge si pas d'année source) ───
  const dupliquerAnnee = useCallback(async (anneeTarget) => {
    if (!currentProfile) return null

    // Si l'année existe déjà : juste la sélectionner
    const existing = await AnneeFiscaleRepo.findByProfileAndAnnee(currentProfile.id, anneeTarget)
    if (existing) {
      const annees = await AnneeFiscaleRepo.findByProfile(currentProfile.id)
      const sorted = annees.sort((a, b) => b.annee - a.annee)
      setAnneesFiscales(sorted)
      setCurrentAnneeRaw(existing)
      return existing
    }

    // 1. Créer la nouvelle AnneeFiscale
    const newAf = await AnneeFiscaleRepo.save({
      profileId:           currentProfile.id,
      annee:               anneeTarget,
      anneeDeclaration:    anneeTarget + 1,
      statut:              'en_cours',
      bareme:              getBareme(anneeTarget),
      deficitsReportables: currentAnnee?.deficitsReportables || {},
      notes:               '',
    })

    // 2. Dupliquer depuis l'année source ou créer vierge
    const biens = await BienRepo.findByProfile(currentProfile.id)
    if (currentAnnee) {
      const bienAnneesSrc = await BienAnneeRepo.findByAnneeFiscale(currentAnnee.id)
      for (const ba of bienAnneesSrc) {
        const bien = biens.find(b => b.id === ba.bienId)
        await BienAnneeRepo.save({
          bienId: ba.bienId, anneeFiscaleId: newAf.id,
          nbLocaux: ba.nbLocaux || 1, regime: ba.regime || 'reel',
          copro: {
            debutJjMm:     bien?.coproDebutJjMm || ba.copro?.debutJjMm || '',
            finJjMm:       bien?.coproFinJjMm   || ba.copro?.finJjMm   || '',
            exercice1Data: {}, exercice2Data: {},
          },
          prets: (ba.prets || []).map(p => ({ ...p, id: crypto.randomUUID(), interets: 0, assurance: 0 })),
        })
      }
    } else {
      for (const bien of biens) {
        await BienAnneeRepo.save({
          bienId: bien.id, anneeFiscaleId: newAf.id,
          nbLocaux: 1, regime: 'reel',
          copro: { debutJjMm: bien.coproDebutJjMm || '', finJjMm: bien.coproFinJjMm || '', exercice1Data: {}, exercice2Data: {} },
          prets: [],
        })
      }
    }

    // 3. Rafraîchir la liste PUIS sélectionner directement (sans reset à null)
    const annees = await AnneeFiscaleRepo.findByProfile(currentProfile.id)
    const sorted = annees.sort((a, b) => b.annee - a.annee)
    setAnneesFiscales(sorted)
    setCurrentAnneeRaw(newAf)
    return newAf
  }, [currentAnnee, currentProfile])

  // ── Refresh helpers ───────────────────────────────────────
  const refreshProfiles = useCallback(async () => {
    const profs = await ProfileRepo.findAll()
    setProfiles(profs)
    if (currentProfile) {
      const updated = profs.find(p => p.id === currentProfile.id)
      if (updated) setCurrentProfile(updated)
    }
  }, [currentProfile])

  const refreshAnnees = useCallback(async () => {
    if (!currentProfile) return
    const annees = await AnneeFiscaleRepo.findByProfile(currentProfile.id)
    const sorted = annees.sort((a, b) => b.annee - a.annee)
    setAnneesFiscales(sorted)
    if (currentAnnee) {
      const updated = sorted.find(a => a.id === currentAnnee.id)
      if (updated) setCurrentAnneeRaw(updated)
    }
  }, [currentProfile, currentAnnee])

  return (
    <AppContext.Provider value={{
      // Profils
      profiles, currentProfile, setCurrentProfile, refreshProfiles,
      // Années
      anneesFiscales, currentAnnee, setCurrentAnnee,
      ouvrirAnnee, dupliquerAnnee, refreshAnnees,
      anneesDisponibles: getAnneesDisponibles(),
      // État
      loading,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
