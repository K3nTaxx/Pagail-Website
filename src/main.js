// L'accueil.
import { gsap } from 'gsap';
import { mouillerLaTuile } from './modules/mouille.js';
import { creerMur } from './modules/mur.js';
import { telephone } from './modules/appareil.js';
import { $, $$, reduit, lenis, allerA, liensInternes, charger, prechargeur, piedDePage, sortirDuFaitage, arrivee } from './modules/commun.js';
import { creerMenu } from './modules/menu.js';
import { mentions, barresTelephone, visionneuse, preparerNette, maintenir } from './modules/fenetres.js';
import Z from './data/zone.json';
import E from './data/entreprise.json';

/* ———————— L'ouverture : tout attend en coulisses, puis tout part dans la même image ———————— */
async function demarrerHaut() {
  lenis?.stop();
  // Arrivée depuis une page prestation sur une section (/#devis…) : on y va directement, sans l'ouverture.
  const ancre = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  const direct = !!ancre && ancre.id !== 'haut';
  window.scrollTo(0, 0);
  const barre = $('.barre');
  const volet = $('#haut-volet');
  const logo = $('.barre-logo img');
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const socle = $('.haut-socle');

  // Si le réseau est lent, le numéro de téléphone n'attend pas la photo.
  const montrerBarre = () => {
    barre.style.visibility = 'visible';
    socle.style.visibility = 'visible';
    if (telephone) $('#appel').classList.remove('appel-cachee');
  };
  const secours = setTimeout(montrerBarre, 1500);

  const polices = Promise.all([
    '900 100px "Big Shoulders Display"', '800 40px "Big Shoulders Display"',
    '500 20px "Familjen Grotesk"', '600 20px "Familjen Grotesk"',
  ].map((p) => document.fonts.load(p, 'Éa0'))).catch(() => {});
  await Promise.all([
    direct ? null : charger($('#haut-img')),
    Promise.race([polices, attendre(900)]),
    logo.decode ? logo.decode().catch(() => {}) : null,
  ]);
  const eau = mouillerLaTuile({ conteneur: $('#haut-photo'), image: $('#haut-img'), canvas: $('#haut-eau') });
  if (eau && !direct) await eau.pret; // shaders compilés et texture envoyée, encore sous le noir

  clearTimeout(secours);
  const dejaVue = barre.style.visibility === 'visible';
  montrerBarre();
  if (!reduit && !dejaVue && !direct) gsap.fromTo(['.barre-logo', '.barre-actions', '.haut-socle'], { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'none', clearProps: 'opacity' });
  if (reduit || direct) { volet.remove(); eau?.demarrer(true); }
  else if (eau) { volet.remove(); eau.demarrer(); }
  else gsap.to(volet, { scaleY: 0, duration: 0.9, ease: 'power3.inOut', onComplete: () => volet.remove() });
  sortirDuFaitage($('.haut-titre'), direct ? 0 : 0.16);

  document.documentElement.dataset.arrive = '';
  window.__arrivee = performance.now();
  lenis?.start();
  if (direct) allerA(ancre, true);

  $$('[data-section]').forEach((s) => arrivee.observe(s));
  // Les autres photos partent juste après : rien ne doit concurrencer l'ouverture.
  setTimeout(() => $$('[data-section]').forEach((s) => prechargeur.observe(s)), direct ? 0 : 700);
}

/* ———————— Prestations : cinq panneaux, uniquement des transforms ———————— */
function panneaux() {
  const boite = $('#panneaux');
  const liste = $$('.panneau', boite);
  const n = liste.length;
  const parts = liste.map((p) => ({
    el: p,
    photo: $('.panneau-photo', p),
    voile: $('.panneau-voile', p),
    info: $('.panneau-info', p),
    focale: Number(p.dataset.focale ?? 0.5),
    voileRepos: Number(p.dataset.voile ?? 0.26), // plus fort sur les murs blancs, pour que le titre se lise
  }));
  let L = 0, ouvert = 0, ferme = 0, repos = 0, courant = null;

  const mesurer = () => {
    L = boite.clientWidth;
    ouvert = window.innerWidth * 0.46;
    ferme = (L - ouvert) / (n - 1);
    repos = L / n;
  };
  const placer = (k, instant) => {
    let x = 0;
    parts.forEach((p, i) => {
      const large = k === null ? repos : i === k ? ouvert : ferme;
      const vars = { x, duration: instant ? 0 : 0.62, ease: 'power3.out', overwrite: 'auto' };
      gsap.to(p.el, vars);
      // La photo reste calée sur son sujet dans la partie visible (la focale de chaque panneau).
      gsap.to(p.photo, { x: -(ouvert - large) * p.focale, duration: instant ? 0 : 0.62, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(p.voile, { opacity: k === null ? p.voileRepos : i === k ? 0 : 0.62, duration: instant ? 0 : 0.3, ease: 'none', overwrite: 'auto' });
      p.el.classList.toggle('ouvert', i === k);
      gsap.to(p.info, { yPercent: i === k ? -101 : 0, duration: instant ? 0 : i === k ? 0.55 : 0.32, delay: i === k && !instant ? 0.08 : 0, ease: i === k ? 'power3.out' : 'power2.in', overwrite: 'auto' });
      x += large;
    });
    courant = k;
  };
  mesurer(); placer(null, true);

  parts.forEach((p, i) => {
    p.el.addEventListener('pointerenter', () => { if (courant !== i) placer(i); });
    p.el.addEventListener('focusin', () => { if (courant !== i) placer(i); });
    p.el.addEventListener('click', () => { if (courant !== i) placer(i); });
  });
  boite.addEventListener('pointerleave', () => placer(null));
  boite.addEventListener('focusout', (e) => { if (!boite.contains(e.relatedTarget) && !boite.matches(':hover')) placer(null); });
  window.addEventListener('resize', () => { mesurer(); placer(courant, true); }, { passive: true });
}

// « Demander un devis » présélectionne la prestation dans le formulaire, depuis un panneau ou depuis
// une page prestation (/?travaux=Toiture#devis).
function preselection() {
  const cocher = (v) => {
    const c = $$('#devis-form input[name="travaux"]').find((x) => x.value === v);
    if (c) c.checked = true;
  };
  $$('[data-prestation-devis]').forEach((a) => a.addEventListener('click', () => cocher(a.dataset.prestationDevis)));
  const demandes = new URLSearchParams(location.search).getAll('travaux');
  if (demandes.length) {
    demandes.forEach(cocher);
    history.replaceState(null, '', location.pathname + location.hash);
  }
}

/* ———————— Prestations, téléphone : les mêmes panneaux couchés, un seul ouvert. Uniquement des transforms :
   la hauteur totale ne change jamais, donc la page ne saute pas quand on en ouvre un. ———————— */
function panneauxTelephone() {
  const boite = $('#panneaux');
  const parts = $$('.panneau', boite).map((p) => ({
    el: p,
    photo: $('.panneau-photo', p),
    voile: $('.panneau-voile', p),
    info: $('.panneau-info', p),
    focale: Number(p.dataset.focaleTel ?? 0.4),
  }));
  let ouvert = 0, ferme = 0, courant = 0;
  const mesurer = () => {
    ouvert = parts[0].el.offsetHeight;
    ferme = (boite.clientHeight - ouvert) / (parts.length - 1);
  };
  const placer = (k, instant) => {
    let y = 0;
    const d = instant || reduit ? 0 : 0.6;
    parts.forEach((p, i) => {
      const lui = i === k;
      const haut = lui ? ouvert : ferme;
      gsap.to(p.el, { y, duration: d, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(p.photo, { y: lui ? 28 : -(ouvert - ferme) * p.focale, duration: d, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(p.voile, { opacity: lui ? 0 : 0.5, duration: d / 2, ease: 'none', overwrite: 'auto' });
      gsap.to(p.info, { yPercent: lui ? 0 : 101, duration: lui ? d : d / 2, delay: lui && d ? 0.1 : 0, ease: lui ? 'power3.out' : 'power2.in', overwrite: 'auto' });
      p.el.classList.toggle('ouvert', lui);
      p.el.setAttribute('aria-expanded', String(lui));
      y += haut;
    });
    courant = k;
    if (instant) return;
    // Le panneau qu'on vient d'ouvrir doit rester entier à l'écran, entre le toit et la barre d'appel.
    const haut = boite.getBoundingClientRect().top + ferme * k;
    const bas = haut + ouvert;
    const limite = window.innerHeight - 60;
    const decalage = bas > limite ? bas - limite : haut < 72 ? haut - 72 : 0;
    if (decalage) window.scrollBy({ top: decalage, behavior: reduit ? 'auto' : 'smooth' });
  };
  mesurer(); placer(0, true);
  parts.forEach((p, i) => {
    p.el.addEventListener('click', () => { if (courant !== i) placer(i); });
    p.el.addEventListener('focusin', () => { if (courant !== i) placer(i); });
  });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === largeur) return; // la barre d'adresse qui se replie ne change rien ici
    largeur = window.innerWidth;
    mesurer(); placer(courant, true);
  }, { passive: true });
}

/* ———————— Façades : maintenir pour voir l'avant ———————— */
function facade() {
  const mot = $('#facade-mot');
  const bouton = $('#facade-bouton');
  maintenir({
    section: $('#facades'), photos: $('#facade-photos'), bouton,
    changer: (tenu) => {
      mot.textContent = tenu ? 'avant.' : 'après.';
      bouton.textContent = tenu ? 'Relâcher pour voir l’après' : 'Maintenir pour voir l’avant';
    },
  });
}

/* ———————— Zones d'intervention : le disque des 40 km autour de Monistrol-sur-Loire ———————— */
function zone() {
  const section = $('#zone');
  const carte = $('#zone-carte');
  const liste = $('#zone-noms');
  const NS = 'http://www.w3.org/2000/svg';
  const [cx, cy] = Z.centre;
  const R = Z.rayon;
  const codes = Object.keys(Z.departements);
  carte.setAttribute('viewBox', Z.viewBox);
  const creer = (nom, attrs, parent = carte) => {
    const el = document.createElementNS(NS, nom);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    parent.append(el);
    return el;
  };
  const defs = creer('defs', {});
  creer('circle', { cx, cy, r: R }, creer('clipPath', { id: 'zone-disque' }, defs));
  codes.forEach((code) => creer('path', { d: Z.departements[code].d }, creer('clipPath', { id: `dep-${code}` }, defs)));

  // Autour du disque : les départements voisins et les contours, à peine visibles, pour se situer.
  // Ils s'effacent vers les bords : aucune ligne coupée net.
  const fondu = creer('radialGradient', { id: 'zone-fondu', gradientUnits: 'userSpaceOnUse', cx, cy, r: 500 }, defs);
  creer('stop', { offset: 0.78, 'stop-color': '#fff' }, fondu);
  creer('stop', { offset: 1, 'stop-color': '#000' }, fondu);
  creer('rect', { x: 0, y: 0, width: 1000, height: 1000, fill: 'url(#zone-fondu)' }, creer('mask', { id: 'zone-masque', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1000, height: 1000 }, defs));
  const fond = creer('g', { class: 'zone-fond', mask: 'url(#zone-masque)' });
  creer('path', { d: Z.voisins, class: 'voisins' }, fond);
  codes.forEach((code) => creer('path', { d: Z.departements[code].d, class: 'voisins' }, fond));
  // Dans le disque : la tuile, découpée par les vrais contours de la Loire et de la Haute-Loire.
  // La tuile reste sombre : les points et les noms doivent ressortir dessus.
  const TUILE = 0.5;
  const disque = creer('g', { 'clip-path': 'url(#zone-disque)' });
  const tuiles = codes.map((code) => creer('image', {
    'clip-path': `url(#dep-${code})`, preserveAspectRatio: 'xMidYMid slice',
    x: cx - R, y: cy - R, width: 2 * R, height: 2 * R, opacity: reduit ? TUILE : 0,
  }, disque));
  const traits = codes.map((code) => creer('path', { d: Z.departements[code].d, class: 'trait' }, disque));
  const cercle = creer('circle', { cx, cy, r: R, class: 'cercle', pathLength: 1000, 'stroke-dasharray': 1000, 'stroke-dashoffset': reduit ? 0 : 1000 });
  const a = Math.PI / 3;
  const km = creer('text', { x: cx + Math.cos(a) * (R + 26), y: cy + Math.sin(a) * (R + 26), class: 'km', opacity: reduit ? 1 : 0 });
  km.textContent = `${Z.rayonKm} km`;
  const numeros = codes.map((code) => {
    const [x, y] = Z.departements[code].numero;
    const t = creer('text', { x, y, class: 'numero', opacity: reduit ? 1 : 0 });
    t.textContent = code;
    return t;
  });
  // Sur téléphone, la carte est trois fois plus petite : les points et les noms grossissent d'autant.
  const k = telephone ? 1.8 : 1;
  const repos = (v) => (v.centre ? 11 : 7) * k;
  const villes = new Map();
  Z.villes.forEach((v) => {
    const centre = v.nom === 'Monistrol-sur-Loire';
    const g = creer('g', { class: centre ? 'ville centre' : 'ville', 'data-code': v.code });
    creer('circle', { cx: v.x, cy: v.y, r: 30 * k, class: 'cible' }, g); // une cible plus large que le point
    const point = creer('circle', { cx: v.x, cy: v.y, r: reduit ? (centre ? 11 : 7) * k : 0, class: 'point' }, g);
    // Les communes autour de Monistrol sont serrées : son nom descend sous le point, au bout d'un filet.
    if (centre) creer('line', { x1: v.x, y1: v.y + 14 * k, x2: v.x, y2: v.y + 100 * k, class: 'filet' }, g);
    const aDroite = v.x < 640;
    const nom = centre
      ? creer('text', { x: v.x, y: v.y + 134 * k, 'text-anchor': 'middle', class: 'nom' }, g)
      : creer('text', { x: v.x + (aDroite ? 20 : -20) * k, y: v.y - 16 * k, 'text-anchor': aDroite ? 'start' : 'end', class: 'nom' }, g);
    nom.textContent = v.nom;
    villes.set(v.code, { g, point, nom, centre, fond: null });
  });
  // L'aplat sous le nom se mesure une fois la police chargée.
  const aplat = (v) => {
    if (v.fond) return;
    const b = v.nom.getBBox();
    if (!b.width) return;
    v.fond = document.createElementNS(NS, 'rect');
    Object.entries({ x: b.x - 9 * k, y: b.y - 3 * k, width: b.width + 18 * k, height: b.height + 6 * k, class: 'fond-nom' })
      .forEach(([n, val]) => v.fond.setAttribute(n, val));
    v.g.insertBefore(v.fond, v.nom);
  };
  traits.forEach((t) => { t.setAttribute('pathLength', 1000); t.setAttribute('stroke-dasharray', 1000); t.setAttribute('stroke-dashoffset', reduit ? 0 : 1000); });
  if (!reduit) fond.setAttribute('opacity', 0);

  // Les deux tuiles ne partent que lorsque la section approche.
  let promesses = null;
  const pretes = () => (promesses ??= codes.map((code, k) => new Promise((r) => {
    const i = new Image();
    i.src = `/img/zone/${code}.webp`;
    i.decode().catch(() => {}).then(() => { tuiles[k].setAttribute('href', i.src); r(); });
  })));
  new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); pretes(); } }, { rootMargin: '200% 0px' }).observe(section);

  let actif = null, pret = reduit;
  const surligner = (code) => {
    if (!pret || code === actif) return;
    actif = code;
    if (code) { aplat(villes.get(code)); villes.get(code).g.parentNode.append(villes.get(code).g); }
    liste.classList.toggle('survol', !!code);
    $$('li', liste).forEach((li) => li.classList.toggle('actif', li.dataset.code === code));
    villes.forEach((v, c) => {
      v.g.classList.toggle('actif', c === code);
      v.g.classList.toggle('efface', !!code && c !== code);
      gsap.to(v.point, { attr: { r: c === code ? 13 * k : repos(v) }, duration: reduit ? 0 : 0.35, ease: 'power3.out', overwrite: 'auto' });
    });
  };
  if (telephone) {
    // Pas de survol au doigt : on touche une ville, et on retouche pour revenir.
    const basculer = (code) => surligner(actif === code ? null : code);
    $$('li', liste).forEach((li) => li.addEventListener('click', (e) => { e.stopPropagation(); basculer(li.dataset.code); }));
    villes.forEach((v, c) => v.g.addEventListener('click', (e) => { e.stopPropagation(); basculer(c); }));
    section.addEventListener('click', () => surligner(null));
  } else {
    $$('li', liste).forEach((li) => {
      li.addEventListener('pointerenter', () => surligner(li.dataset.code));
      li.addEventListener('pointerleave', () => surligner(null));
    });
    villes.forEach((v, c) => {
      v.g.addEventListener('pointerenter', () => surligner(c));
      v.g.addEventListener('pointerleave', () => surligner(null));
    });
  }

  let joue = false;
  const jouer = () => {
    if (joue) return;
    joue = true;
    villes.forEach(aplat);
    if (reduit) { carte.classList.add('joue'); return; }
    const parDistance = Z.villes.slice().sort((p, q) => p.km - q.km);
    const tl = gsap.timeline({ onComplete: () => { pret = true; } });
    tl.to(['#zone-titre', '#zone-intro', '#zone-rayon'], { opacity: 1, duration: 0.35, ease: 'none', stagger: 0.08 }, 0)
      .to($$('li', liste), { opacity: 1, duration: 0.3, ease: 'none', stagger: 0.04 }, 0.1)
      .to(fond, { attr: { opacity: 1 }, duration: 0.6, ease: 'none' }, 0.1)
      .to(traits, { attr: { 'stroke-dashoffset': 0 }, duration: 1, ease: 'power2.inOut', stagger: 0.15 }, 0.2)
      .to(cercle, { attr: { 'stroke-dashoffset': 0 }, duration: 1.2, ease: 'power2.inOut' }, 0.4)
      .to(tuiles, { attr: { opacity: TUILE }, duration: 0.6, ease: 'none', stagger: 0.15 }, 1.05)
      .to([...numeros, km], { attr: { opacity: 1 }, duration: 0.3, ease: 'none' }, 1.4)
      .call(() => carte.classList.add('joue'), null, 1.3); // le nom de Monistrol arrive avec son point
    parDistance.forEach((v, i) => {
      const p = villes.get(v.code);
      tl.to(p.point, { attr: { r: repos(p) }, duration: 0.35, ease: 'back.out(2)' }, 1.3 + i * 0.06);
    });
  };
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    Promise.race([Promise.all(pretes()), new Promise((r) => setTimeout(r, 700))]).then(jouer);
  }, { threshold: telephone ? 0.2 : 0.45 }).observe(section);
}

/* ———————— Avis Google : le lien dès que la fiche est connue, les avis dès qu'il y en a ———————— */
async function avis() {
  const section = $('#avis');
  let liste = [];
  try {
    const r = await fetch('/donnees/avis.json', { cache: 'no-cache' });
    if (r.ok) liste = (await r.json()).avis || [];
  } catch { /* pas d'avis */ }
  if (!liste.length && !E.ficheGoogle) return;
  section.innerHTML = '';
  liste.forEach((a) => {
    const b = document.createElement('blockquote');
    b.textContent = a.texte;
    const c = document.createElement('cite');
    c.textContent = a.date ? `${a.auteur}, ${a.date}` : a.auteur;
    b.append(c);
    section.append(b);
  });
  if (E.ficheGoogle) {
    const l = document.createElement('a');
    l.className = 'avis-lien';
    l.href = E.ficheGoogle; l.rel = 'noopener'; l.target = '_blank';
    l.textContent = 'Voir nos avis sur Google';
    section.append(l);
  }
  section.hidden = false;
}

/* ———————— Devis : prêt pour Netlify Forms ———————— */
function devis() {
  const form = $('#devis-form');
  const retour = $('#devis-retour');
  const bouton = $('#devis-envoyer');
  $$('.champ-erreur', form).forEach((s) => { s.textContent = s.dataset.erreur; });
  const champs = {
    nom: (v) => v.trim().length > 1,
    commune: (v) => v.trim().length > 1,
    telephone: (v) => v.replace(/\D/g, '').length >= 10,
    email: (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  };
  const verifier = (nom) => {
    const input = form.elements[nom];
    const bon = champs[nom](input.value);
    input.closest('.champ').classList.toggle('erreur', !bon);
    input.setAttribute('aria-invalid', String(!bon));
    return bon;
  };
  Object.keys(champs).forEach((nom) => {
    form.elements[nom].addEventListener('blur', () => { if (form.elements[nom].value) verifier(nom); });
    form.elements[nom].addEventListener('input', () => { if (form.elements[nom].closest('.champ').classList.contains('erreur')) verifier(nom); });
  });
  const dire = (classe, html) => { retour.hidden = false; retour.className = `devis-retour ${classe}`; retour.innerHTML = html; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valides = Object.keys(champs).map(verifier);
    if (valides.includes(false)) {
      form.elements[Object.keys(champs)[valides.indexOf(false)]].focus();
      retour.hidden = true;
      return;
    }
    bouton.disabled = true;
    bouton.textContent = 'Envoi en cours';
    retour.hidden = true;
    try {
      const champsForm = new FormData(form);
      champsForm.set('travaux', champsForm.getAll('travaux').join(', '));
      const corps = new URLSearchParams(champsForm).toString();
      const r = await fetch(form.getAttribute('action') || '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corps,
      });
      if (!r.ok) throw new Error(String(r.status));
      form.reset();
      dire('ok', 'Votre demande est bien partie. Nous vous répondons dès que possible.');
    } catch {
      dire('ko', `L’envoi n’a pas abouti. Réessayer, ou appeler le <a href="tel:${E.telephoneLien}">${E.telephone.replace(/ /g, '&nbsp;')}</a>.`);
    }
    bouton.disabled = false;
    bouton.textContent = 'Envoyer ma demande';
  });
}

/* ———————— Départ ———————— */
liensInternes();
piedDePage();
if (telephone) { panneauxTelephone(); barresTelephone(); } else panneaux();
preselection();
facade();
const ouvrirChantier = visionneuse();
creerMur({ vue: $('#mur-vue'), monde: $('#mur-monde'), section: $('#chantiers'), ouvrir: ouvrirChantier, preparer: preparerNette, reduit });
zone();
avis();
devis();
creerMenu();
mentions();
demarrerHaut();
