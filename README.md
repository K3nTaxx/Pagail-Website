# AD Couverture Rénove

Site vitrine d'une seule page, pour ordinateur (1440 à 1920 px). Vite, GSAP, Lenis et OGL.

## En local

```bash
npm install
npm run dev
```

`npm run build` produit la version de production dans `dist`, et `npm run preview` la sert en local.

## Mettre en ligne sur Netlify

1. Sur Netlify : **Add new project**, **Import an existing project**, puis choisir ce dépôt. Tous les réglages sont déjà dans `netlify.toml`, il n'y a rien à remplir.
2. Une fois le site créé : **Forms**, **Enable form detection**, puis relancer un déploiement. Sans cette étape, le formulaire de devis ne reçoit rien.
3. Toujours dans **Forms** : ajouter une notification par e-mail pour recevoir les demandes de devis.

## Avis Google

Les avis se remplissent dans `public/donnees/avis.json`. Le bloc reste masqué tant que la liste est vide.

```json
{ "lienFiche": "https://…", "avis": [{ "auteur": "Prénom N.", "date": "mars 2026", "texte": "…" }] }
```
