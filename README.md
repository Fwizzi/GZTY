# FiscApp — Assistant de déclaration fiscale française
> Version 1.0.0 · PWA · Données 100% locales (IndexedDB)

## Déploiement GitHub Pages

```bash
# 1. Init git
git init && git add . && git commit -m "FiscApp v1.0.0"
git remote add origin https://github.com/VOTRE_USERNAME/fiscapp.git
git push -u origin main

# 2. Settings → Pages → Source: GitHub Actions
# 3. URL: https://VOTRE_USERNAME.github.io/fiscapp/
```

Si votre repo s'appelle autrement que `fiscapp`, modifiez `base:` dans `vite.config.js`.

## Dev local
```bash
npm install && npm run dev
```

## Avertissement
Outil indicatif — vérifiez toujours sur impots.gouv.fr
