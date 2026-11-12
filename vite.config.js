// Un site, plusieurs pages : l'accueil et une page par prestation.
// Les blocs communs (barre, menu, pied de page, mentions…) viennent de src/partials et toutes les
// coordonnées de src/data/entreprise.json : le nom et le téléphone sont écrits pareil partout.
// À la construction, on ajoute aussi le balisage schema.org, le plan du site, robots.txt et llms.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => JSON.parse(fs.readFileSync(path.join(RACINE, f), 'utf8'));
// Netlify fournit l'adresse publique du site dans URL : domaine personnalisé s'il y en a un.
const SITE = (process.env.URL || process.env.SITE_URL || '').replace(/\/$/, '');
const absolu = (chemin) => `${SITE}${chemin}`;

const PAGES = fs.existsSync(path.join(RACINE, 'prestations'))
  ? fs.readdirSync(path.join(RACINE, 'prestations')).filter((d) => fs.existsSync(path.join(RACINE, 'prestations', d, 'index.html')))
  : [];

const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function jetons(e, services, accueil) {
  const base = accueil ? '' : '/';
  return {
    base,
    accueil: accueil ? '#haut' : '/',
    nom: e.nom,
    tel: e.telephone,
    telEspaces: e.telephone.replace(/ /g, '&nbsp;'),
    telLien: e.telephoneLien,
    email: e.email,
    zone: e.zone,
    ville: e.ville,
    codePostal: e.codePostal,
    services: services.map((s) => `<a href="${s.url}">${echapper(s.nom)}</a>`).join('\n    '),
    lienAvis: e.ficheGoogle ? `<a class="pied-avis" href="${echapper(e.ficheGoogle)}" rel="noopener" target="_blank">Voir nos avis sur Google</a>` : '',
  };
}

// ———— schema.org ————
function entrepriseSchema(e, services) {
  const id = absolu('/#entreprise');
  const s = {
    '@context': 'https://schema.org',
    '@type': 'RoofingContractor',
    '@id': id,
    name: e.nom,
    alternateName: e.autreNom,
    url: absolu('/'),
    telephone: e.telephoneSchema,
    email: e.email,
    foundingDate: e.creation,
    founder: { '@type': 'Person', name: e.dirigeant, jobTitle: 'Artisan couvreur' },
    logo: absolu('/img/logo/logo-complet.webp'),
    image: [absolu('/img/entreprise/camion-duculty-couverture.webp'), absolu('/img/haut/demoussage-toiture-saint-romain-les-atheux-2000.webp')],
    // Pas d'adresse : l'entreprise se déplace chez ses clients. La commune suffit à la situer.
    address: { '@type': 'PostalAddress', addressLocality: e.ville, postalCode: e.codePostal, addressRegion: e.departement, addressCountry: 'FR' },
    geo: { '@type': 'GeoCoordinates', latitude: e.latitude, longitude: e.longitude },
    areaServed: [
      { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: e.latitude, longitude: e.longitude }, geoRadius: e.rayonKm * 1000 },
      ...e.villes.map((v) => ({ '@type': 'City', name: v })),
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Prestations',
      itemListElement: services.map((p) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: p.nom, url: absolu(p.url) } })),
    },
  };
  if (e.ficheGoogle) s.sameAs = [e.ficheGoogle];
  return s;
}

function serviceSchema(e, p) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: p.titre,
      serviceType: p.nom,
      description: p.description,
      url: absolu(p.url),
      provider: { '@type': 'RoofingContractor', '@id': absolu('/#entreprise'), name: e.nom, telephone: e.telephoneSchema, url: absolu('/') },
      areaServed: [
        { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: e.latitude, longitude: e.longitude }, geoRadius: e.rayonKm * 1000 },
        ...e.villes.map((v) => ({ '@type': 'City', name: v })),
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: absolu('/') },
        { '@type': 'ListItem', position: 2, name: p.nom, item: absolu(p.url) },
      ],
    },
  ];
}

const script = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function meta(accueil, page, e) {
  const chemin = accueil ? '/' : page.url;
  const titre = accueil ? e.title : page.title;
  const description = accueil ? e.description : page.description;
  const image = accueil ? '/img/entreprise/camion-duculty-couverture.webp' : page.image;
  const lignes = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="fr_FR">`,
    `<meta property="og:site_name" content="${echapper(e.nom)}">`,
    `<meta property="og:title" content="${echapper(titre)}">`,
    `<meta property="og:description" content="${echapper(description)}">`,
  ];
  if (SITE) {
    lignes.unshift(`<link rel="canonical" href="${absolu(chemin)}">`);
    lignes.push(`<meta property="og:url" content="${absolu(chemin)}">`, `<meta property="og:image" content="${absolu(image)}">`);
  }
  return lignes.join('\n  ');
}

function site() {
  return {
    name: 'duculty-couverture',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const e = lire('src/data/entreprise.json');
        const services = lire('src/data/services.json');
        const accueil = ctx.path === '/' || ctx.path === '/index.html';
        const page = accueil ? null : services.find((s) => ctx.path.startsWith(s.url));
        const j = jetons(e, services, accueil);
        let sortie = html.replace(/<!--@(\w+)-->/g, (tout, nom) => {
          if (nom === 'schema') return accueil ? script(entrepriseSchema(e, services)) : page ? serviceSchema(e, page).map(script).join('\n  ') : '';
          if (nom === 'meta') return meta(accueil, page, e);
          const f = path.join(RACINE, 'src', 'partials', `${nom}.html`);
          return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : tout;
        });
        sortie = sortie.replace(/\{\{(\w+)\}\}/g, (tout, k) => (k in j ? j[k] : tout));
        return sortie;
      },
    },
    generateBundle() {
      const e = lire('src/data/entreprise.json');
      const services = lire('src/data/services.json');
      const jour = new Date().toISOString().slice(0, 10);
      const urls = ['/', ...services.map((s) => s.url)];
      if (SITE) {
        this.emitFile({
          type: 'asset', fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${absolu(u)}</loc><lastmod>${jour}</lastmod></url>`).join('\n')}\n</urlset>\n`,
        });
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${SITE ? `\nSitemap: ${absolu('/sitemap.xml')}\n` : ''}` });
      // Un résumé en texte simple, lisible par les assistants comme ChatGPT (convention llms.txt).
      this.emitFile({
        type: 'asset', fileName: 'llms.txt',
        source: [
          `# ${e.nom}`,
          '',
          `> ${e.nom} est l’entreprise d’${e.dirigeant}, artisan couvreur à ${e.ville} (${e.departement}) depuis 2011. ${e.zone}. Téléphone : ${e.telephone}.`,
          '',
          `- Nom : ${e.nom} (le logo et le camion portent aussi le nom ${e.autreNom})`,
          `- Dirigeant : ${e.dirigeant}`,
          `- Téléphone : ${e.telephone}`,
          `- Création : 7 octobre 2011`,
          `- Zone : ${e.zone} : ${e.villes.join(', ')}`,
          '- Garantie décennale. Urgence et dépannage, 24 h/24, 7 j/7.',
          '',
          '## Prestations',
          '',
          ...services.map((s) => `- [${s.titre}](${absolu(s.url)}) : ${s.description}`),
          '',
        ].join('\n'),
      });
    },
  };
}

export default defineConfig({
  plugins: [site()],
  build: {
    rollupOptions: {
      input: {
        accueil: path.join(RACINE, 'index.html'),
        ...Object.fromEntries(PAGES.map((d) => [d, path.join(RACINE, 'prestations', d, 'index.html')])),
      },
    },
  },
});
