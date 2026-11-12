# Duculty Couverture

Site vitrine : l'accueil et une page par prestation. Ordinateur et téléphone. Vite, GSAP, Lenis et OGL.

## En local

```bash
npm install
npm run dev
```

`npm run build` produit la version de production dans `dist`, et `npm run preview` la sert en local.

## Où changer quoi

- **Nom, téléphone, e-mail, zone, villes, title et meta description de l'accueil :** `src/data/entreprise.json`. Ils sont recopiés partout à la construction (barre, pied de page, mentions, schema.org, `llms.txt`). L'adresse de la fiche Google va dans `ficheGoogle` : le lien « Voir nos avis sur Google » et le « sameAs » de schema.org apparaissent dès qu'elle est remplie.
- **Barre, barre d'appel, menu, pied de page, mentions légales :** `src/partials`, communs à toutes les pages.
- **Pages prestations :** `prestations/<adresse>/index.html`. Elles sont écrites par `scripts/pages.py`, qui reste sur le poste de travail avec les photos d'origine et n'est pas dans le dépôt. Une petite correction peut se faire directement dans le fichier HTML.

## Mettre en ligne sur Netlify

1. Sur Netlify : **Add new project**, **Import an existing project**, puis choisir ce dépôt. Tous les réglages sont déjà dans `netlify.toml`, il n'y a rien à remplir.
2. Une fois le site créé : **Forms**, **Enable form detection**, puis relancer un déploiement. Sans cette étape, le formulaire de devis ne reçoit rien.
3. Toujours dans **Forms** : ajouter une notification par e-mail pour recevoir les demandes de devis.
4. Après avoir branché le nom de domaine, relancer un déploiement : Netlify fournit alors la bonne adresse, qui sert aux liens canoniques, au partage et à `sitemap.xml`. Déclarer ensuite `https://<domaine>/sitemap.xml` dans Google Search Console.

## Avis Google

Les avis se recopient dans `public/donnees/avis.json`. Le bloc reste masqué tant qu'il n'y a ni avis ni fiche Google.

```json
{ "avis": [{ "auteur": "Prénom N.", "date": "mars 2026", "texte": "…" }] }
```
