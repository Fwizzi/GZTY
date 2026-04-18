# Guide de déploiement GitHub Pages — FiscApp

## Méthode recommandée (branche gh-pages)

### Étape 1 — Pousser le code sur GitHub

```bash
git init
git add .
git commit -m "FiscApp v1.0.2"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/NOM_REPO.git
git push -u origin main
```

### Étape 2 — Configurer GitHub Pages

1. Aller sur votre dépôt GitHub
2. **Settings** → **Pages**
3. Source : **"Deploy from a branch"**
4. Branch : **`gh-pages`** / `/ (root)`
5. Cliquer **Save**

> ⚠️ NE PAS choisir "GitHub Actions" — choisir "Deploy from a branch: gh-pages"

### Étape 3 — Déclencher le premier déploiement

Le push de l'étape 1 déclenche automatiquement le workflow.
Vérifiez dans **Actions** que le job est vert (2-3 minutes).

Une fois vert, votre app est accessible sur :
```
https://VOTRE_USERNAME.github.io/NOM_REPO/
```

---

## Pourquoi cette méthode ?

| Méthode | Risque | Fiabilité |
|---|---|---|
| GitHub Actions (pages) | Nécessite permissions spéciales | ⚠️ Variable |
| **gh-pages branch** | Aucun | ✅ Toujours fiable |

La branche `gh-pages` est créée automatiquement par le workflow et contient uniquement le build compilé — jamais les fichiers source. GitHub Pages sert cette branche directement.

---

## Dépannage

**Page blanche / erreur main.jsx**
→ La source Pages est sur `main` au lieu de `gh-pages`
→ Fix : Settings → Pages → Branch → `gh-pages`

**Workflow rouge dans Actions**
→ Coller le message d'erreur dans le chat

**L'URL retourne 404**
→ Attendre 2-3 minutes après le premier déploiement
→ Vider le cache navigateur (Ctrl+Shift+R)
