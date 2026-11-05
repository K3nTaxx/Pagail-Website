import Lenis from 'lenis';
import { gsap } from 'gsap';
import { mouillerLaTuile } from './modules/mouille.js';
import { creerMur } from './modules/mur.js';
import donnees from './data/chantiers.json';
import zone from './data/zone.json';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ———————— Défilement ———————— */
const lenis = reduit ? null : new Lenis({ lerp: 0.12, wheelMultiplier: 0.9, smoothWheel: true });
if (lenis) {
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function allerA(cible) {
  const el = typeof cible === 'string' ? $(cible) : cible;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.1, force: true });
  else window.scrollTo(0, el.getBoundingClientRect().top + scrollY);
}
document.addEventListener('click', (e) => {
  const lien = e.target.closest('a[href^="#"]');
  if (!lien) return;
  e.preventDefault();
  allerA(lien.getAttribute('href'));
});

/* ———————— Chargement des images : deux écrans à l'avance, décodées avant d'arriver ———————— */
const pretes = new WeakMap();
function charger(img) {
  if (pretes.has(img)) return pretes.get(img);
  const promesse = new Promise((resolve) => {
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    if (img.dataset.src) img.src = img.dataset.src;
    const decoder = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve);
    if (img.complete && img.naturalWidth) decoder();
    else {
      img.addEventListener('load', decoder, { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    }
  });
  pretes.set(img, promesse);
  return promesse;
}
const prechargeur = new IntersectionObserver((entrees) => {
  entrees.forEach((e) => {
    if (!e.isIntersecting) return;
    prechargeur.unobserve(e.target);
    $$('img[data-src]:not([data-differe])', e.target).forEach(charger);
  });
}, { rootMargin: '200% 0px' });
new IntersectionObserver((entrees, obs) => {
  if (entrees[0].isIntersecting) { obs.disconnect(); charger($('.pied-logo')); }
}, { rootMargin: '100% 0px' }).observe($('.pied'));

/* ———————— Le titre sur les pentes : chaque mot sort de derrière le faîtage ———————— */
function sortirDuFaitage(racine, delai = 0) {
  const g = $$('.pente-g .mot > span', racine);
  const d = $$('.pente-d .mot > span', racine);
  if (!g.length && !d.length) return;
  gsap.set([...g, ...d], { visibility: 'visible' });
  if (reduit) return;
  gsap.fromTo(g, { xPercent: 104 }, { xPercent: 0, duration: 1.05, ease: 'power3.out', delay: delai, stagger: 0.09 });
  gsap.fromTo(d, { xPercent: -104 }, { xPercent: 0, duration: 1.05, ease: 'power3.out', delay: delai, stagger: 0.09 });
}

/* ———————— Le langage d'animation : volet qui se relève, texte en court fondu. Une seule fois. ———————— */
function reveler(section) {
  const volets = $$(':scope [data-volet] > .volet, :scope > .volet', section);
  const fondus = $$('[data-fondu]', section);
  const images = $$('img[data-src]', section).filter((i) => i.closest('[data-volet]'));
  const attente = Promise.all(images.map(charger));
  // On attend le décodage : jamais une image après son titre, jamais de case vide.
  Promise.race([attente, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    sortirDuFaitage(section, 0.12);
    if (reduit) {
      volets.forEach((v) => v.remove());
      gsap.set(fondus, { opacity: 1 });
      return;
    }
    if (volets.length) {
      gsap.to(volets, {
        scaleY: 0, duration: 0.85, ease: 'power3.inOut', stagger: 0.07,
        onComplete: () => volets.forEach((v) => v.remove()),
      });
    }
    if (fondus.length) gsap.to(fondus, { opacity: 1, duration: 0.42, ease: 'none', delay: 0.14, stagger: 0.035 });
  });
}
const arrivee = new IntersectionObserver((entrees) => {
  entrees.forEach((e) => {
    if (!e.isIntersecting) return;
    arrivee.unobserve(e.target);
    reveler(e.target);
  });
}, { rootMargin: '-14% 0px -14% 0px' });

/* ———————— L'ouverture : tout attend en coulisses, puis tout part dans la même image ———————— */
async function demarrerHaut() {
  lenis?.stop();
  window.scrollTo(0, 0);
  const barre = $('.barre');
  const volet = $('#haut-volet');
  const logo = $('.barre-logo img');
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  // Si le réseau est lent, le numéro de téléphone n'attend pas la photo.
  const montrerBarre = () => { barre.style.visibility = 'visible'; };
  const secours = setTimeout(montrerBarre, 1500);

  const polices = Promise.all([
    '900 100px "Big Shoulders Display"', '800 40px "Big Shoulders Display"',
    '500 20px "Familjen Grotesk"', '600 20px "Familjen Grotesk"',
  ].map((p) => document.fonts.load(p, 'Éa0'))).catch(() => {});
  await Promise.all([
    charger($('#haut-img')),
    Promise.race([polices, attendre(900)]),
    logo.decode ? logo.decode().catch(() => {}) : null,
  ]);
  const eau = mouillerLaTuile({ conteneur: $('#haut-photo'), image: $('#haut-img'), canvas: $('#haut-eau') });
  if (eau) await eau.pret; // shaders compilés et texture envoyée, encore sous le noir

  clearTimeout(secours);
  const dejaVue = barre.style.visibility === 'visible';
  montrerBarre();
  if (!reduit && !dejaVue) gsap.fromTo(['.barre-logo', '.barre-actions'], { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'none', clearProps: 'opacity' });
  if (reduit) { volet.remove(); eau?.demarrer(true); }
  else if (eau) { volet.remove(); eau.demarrer(); }
  else gsap.to(volet, { scaleY: 0, duration: 0.9, ease: 'power3.inOut', onComplete: () => volet.remove() });
  sortirDuFaitage($('.haut-titre'), 0.16);

  document.documentElement.dataset.arrive = '';
  window.__arrivee = performance.now();
  lenis?.start();

  $$('[data-section]').forEach((s) => arrivee.observe(s));
  // Les autres photos partent juste après : rien ne doit concurrencer l'ouverture.
  setTimeout(() => $$('[data-section]').forEach((s) => prechargeur.observe(s)), 700);
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

  // « Demander un devis » présélectionne la prestation dans le formulaire.
  $$('[data-prestation-devis]').forEach((a) => {
    a.addEventListener('click', () => {
      const v = a.dataset.prestationDevis;
      const c = $(`#devis-form input[name="travaux"][value="${v}"]`);
      if (c) c.checked = true;
    });
  });
}

/* ———————— 6. Façades : maintenir pour voir l'avant. Une coupe, pas de ligne glissante. ———————— */
function facade() {
  const section = $('#facades');
  const photos = $('#facade-photos');
  const bouton = $('#facade-bouton');
  const mot = $('#facade-mot');
  const APRES = { mot: 'après.', bouton: "Maintenir pour voir l’avant" };
  const AVANT = { mot: 'avant.', bouton: "Relâcher pour voir l’après" };
  const etat = (tenu) => {
    section.classList.toggle('tenu', tenu);
    const e = tenu ? AVANT : APRES;
    mot.textContent = e.mot; bouton.textContent = e.bouton;
  };
  const tenir = (e) => { e.preventDefault(); etat(true); };
  const lacher = () => { if (section.classList.contains('tenu')) etat(false); };
  [photos, bouton].forEach((el) => el.addEventListener('pointerdown', tenir));
  window.addEventListener('pointerup', lacher);
  window.addEventListener('pointercancel', lacher);
  window.addEventListener('blur', lacher);
  bouton.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); etat(true); } });
  bouton.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') lacher(); });
  bouton.addEventListener('blur', lacher);
  photos.addEventListener('contextmenu', (e) => e.preventDefault());
}

/* ———————— Mur et visionneuse ———————— */
// Les photos nettes sont préparées dès le survol. Au clic, la vignette s'affiche tout de suite
// et la photo nette la remplace dès qu'elle est décodée : le premier clic répond immédiatement.
const nettes = new Map();
function preparerNette(id) {
  if (!nettes.has(id)) {
    const img = new Image();
    img.alt = '';
    img.src = `/img/mur/g/${id}.webp`;
    nettes.set(id, { img, pret: img.decode().then(() => img, () => null) });
  }
  return nettes.get(id);
}
function visionneuse() {
  const d = $('#visionneuse');
  const boite = $('#visionneuse-photo');
  const titre = $('#visionneuse-titre');
  const traits = $('#visionneuse-traits');
  let chantier = null, n = 0, retour = null;

  const montrer = (i) => {
    n = (i + chantier.photos.length) % chantier.photos.length;
    const courant = n;
    const p = chantier.photos[n];
    const vignette = new Image();
    vignette.alt = chantier.titre;
    vignette.src = `/img/mur/v/${p.id}.webp`;
    boite.replaceChildren(vignette);
    preparerNette(p.id).pret.then((img) => {
      if (img && d.open && courant === n && chantier?.photos[n] === p) { img.alt = chantier.titre; boite.replaceChildren(img); }
    });
    $$('i', traits).forEach((t, k) => t.classList.toggle('vu', k <= n));
    preparerNette(chantier.photos[(n + 1) % chantier.photos.length].id);
    preparerNette(chantier.photos[(n - 1 + chantier.photos.length) % chantier.photos.length].id);
  };
  const ouvrir = (c, depart, el) => {
    chantier = c; retour = el;
    traits.replaceChildren(...c.photos.map(() => document.createElement('i')));
    titre.textContent = c.titre;
    lenis?.stop();
    d.showModal();
    montrer(depart);
  };
  d.addEventListener('close', () => { lenis?.start(); boite.replaceChildren(); retour?.focus?.({ preventScroll: true }); });
  $('#visionneuse-prec').addEventListener('click', () => montrer(n - 1));
  $('#visionneuse-suiv').addEventListener('click', () => montrer(n + 1));
  $('[data-fermer]', d).addEventListener('click', () => d.close());
  d.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') montrer(n + 1);
    if (e.key === 'ArrowLeft') montrer(n - 1);
  });
  return ouvrir;
}

/* ———————— Zone : à l'arrivée, les contours se tracent seuls. Au survol, un département ressort ———————— */
function zoneAutomatique() {
  const section = $('#zone');
  const carte = $('#zone-carte');
  const noms = $('#zone-noms');
  const NS = 'http://www.w3.org/2000/svg';
  const ORDRE = ['42', '43', '69', '38'];
  // Le point de chaque département le plus éloigné de ses bords : le numéro y tient toujours.
  const CENTRES = { 42: [296, 213], 43: [232, 534], 69: [482, 240], 38: [842, 552] };
  carte.setAttribute('viewBox', zone.viewBox);
  const creer = (nom, attrs, parent = carte) => {
    const el = document.createElementNS(NS, nom);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    parent.append(el);
    return el;
  };
  const defs = creer('defs', {});
  ORDRE.forEach((code) => creer('path', { d: zone.departements[code].d }, creer('clipPath', { id: `dep-${code}` }, defs)));

  const dessiner = (code, parent) => {
    const g = creer('g', {}, parent);
    const image = creer('image', { 'clip-path': `url(#dep-${code})`, preserveAspectRatio: 'xMidYMid slice' }, g);
    const trait = creer('path', { d: zone.departements[code].d, class: 'trait' }, g);
    const b = trait.getBBox();
    Object.entries({ x: b.x, y: b.y, width: b.width, height: b.height }).forEach(([k, v]) => image.setAttribute(k, v));
    const [x, y] = CENTRES[code];
    const texte = creer('text', { x, y }, g);
    texte.textContent = code;
    return { g, image, trait, texte, b };
  };
  const couches = {};
  ORDRE.forEach((code) => { couches[code] = dessiner(code, carte); });
  // La couche du survol passe au-dessus des autres sans bouger celles qui captent la souris :
  // le département grossit sans que le curseur ne « sorte » de lui.
  const dessus = creer('g', { class: 'zone-dessus' });
  ORDRE.forEach((code) => {
    const h = dessiner(code, dessus);
    couches[code].haut = h;
    gsap.set(h.g, { opacity: 0, svgOrigin: `${h.b.x + h.b.width / 2} ${h.b.y + h.b.height / 2}` });
  });
  ORDRE.forEach((code) => {
    const c = couches[code];
    c.trait.setAttribute('pathLength', 1000);
    c.trait.setAttribute('stroke-dasharray', 1000);
    c.trait.setAttribute('stroke-dashoffset', reduit ? 0 : 1000);
    if (!reduit) { c.image.setAttribute('opacity', 0); c.texte.setAttribute('opacity', 0); }
  });

  // La tuile des quatre départements est prête avant d'arriver.
  const pretes = ORDRE.map((code) => new Promise((r) => {
    const i = new Image();
    i.src = `/img/zone/${code}.webp`;
    i.decode().catch(() => {}).then(() => {
      couches[code].image.setAttribute('href', i.src);
      couches[code].haut.image.setAttribute('href', i.src);
      r();
    });
  }));

  let actif = null, pret = reduit;
  const surligner = (code) => {
    if (!pret || code === actif) return;
    actif = code;
    noms.classList.toggle('survol', !!code);
    $$('li', noms).forEach((li) => li.classList.toggle('actif', li.dataset.dep === code));
    const v = reduit ? 0 : 1;
    ORDRE.forEach((c) => {
      const o = couches[c];
      const lui = c === code;
      gsap.to(o.g, { opacity: code ? 0.26 : 1, duration: 0.32 * v, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(o.haut.g, { opacity: lui ? 1 : 0, scale: lui ? 1.08 : 1, duration: (lui ? 0.65 : 0.34) * v, ease: lui ? 'power3.out' : 'power2.out', overwrite: 'auto' });
    });
  };
  $$('li', noms).forEach((li) => {
    li.addEventListener('pointerenter', () => surligner(li.dataset.dep));
    li.addEventListener('pointerleave', () => surligner(null));
  });
  ORDRE.forEach((code) => {
    couches[code].g.addEventListener('pointerenter', () => surligner(code));
    couches[code].g.addEventListener('pointerleave', () => surligner(null));
  });

  let joue = false;
  const jouer = () => {
    if (joue) return;
    joue = true;
    if (reduit) return;
    const tl = gsap.timeline({ onComplete: () => { pret = true; } });
    tl.to('#zone-intro', { opacity: 1, duration: 0.35, ease: 'none' }, 0);
    ORDRE.forEach((code, i) => {
      const t = 0.1 + i * 0.55;
      const c = couches[code];
      tl.to(`#zone-noms [data-dep="${code}"]`, { opacity: 1, duration: 0.3, ease: 'none' }, t);
      tl.to(c.trait, { attr: { 'stroke-dashoffset': 0 }, duration: 0.85, ease: 'power2.inOut' }, t);
      tl.to(c.image, { attr: { opacity: 1 }, duration: 0.45, ease: 'none' }, t + 0.62);
      tl.to(c.texte, { attr: { opacity: 1 }, duration: 0.25, ease: 'none' }, t + 0.7);
    });
  };
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    Promise.race([Promise.all(pretes), new Promise((r) => setTimeout(r, 700))]).then(jouer);
  }, { threshold: 0.45 }).observe(section);
}

/* ———————— Avis Google : masqué tant que le fichier est vide ———————— */
async function avis() {
  const section = $('#avis');
  try {
    const r = await fetch('/donnees/avis.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const d = await r.json();
    if (!d.avis?.length) return;
    section.innerHTML = '';
    d.avis.forEach((a) => {
      const b = document.createElement('blockquote');
      b.textContent = a.texte;
      const c = document.createElement('cite');
      c.textContent = a.date ? `${a.auteur}, ${a.date}` : a.auteur;
      b.append(c);
      section.append(b);
    });
    if (d.lienFiche) {
      const l = document.createElement('a');
      l.className = 'avis-lien';
      l.href = d.lienFiche; l.rel = 'noopener'; l.target = '_blank';
      l.textContent = 'Lire tous les avis sur Google';
      section.append(l);
    }
    section.hidden = false;
  } catch { /* pas d'avis, pas de bloc */ }
}

/* ———————— 10. Devis : prêt pour Netlify Forms ———————— */
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
      dire('ko', 'L’envoi n’a pas abouti. Réessayer, ou appeler le <a href="tel:+33668192636">06&nbsp;68&nbsp;19&nbsp;26&nbsp;36</a>.');
    }
    bouton.disabled = false;
    bouton.textContent = 'Envoyer ma demande';
  });
}

/* ———————— Menu : le toit descend sur la page, le bloc monte jusqu'en haut ———————— */
function menu() {
  const m = $('#menu');
  const fond = $('.menu-fond', m);
  const liens = $$('.menu-liens a', m);
  const mots = $$('.menu-liens a > span', m);
  const vues = $('#menu-vues', m);
  const toit = $('.barre-toit');
  const bouton = $('#menu-ouvrir');
  const dehors = [$('main'), $('.pied')];
  const images = new Map();
  let tl = null, ouvert = false;

  // Toutes les vues sont décodées dès le survol du bouton : aucune case vide d'un lien à l'autre.
  const precharger = () => {
    if (images.size) return;
    liens.forEach((a) => {
      const i = new Image();
      i.alt = ''; i.decoding = 'async';
      i.src = `/img/menu/${a.dataset.vue}.webp`;
      i.decode?.().catch(() => {});
      vues.append(i);
      images.set(a.dataset.vue, i);
    });
  };
  const montrer = (vue) => images.forEach((i, k) => i.classList.toggle('active', k === vue));
  bouton.addEventListener('pointerenter', precharger);
  liens.forEach((a) => {
    a.addEventListener('pointerenter', () => montrer(a.dataset.vue));
    a.addEventListener('focus', () => montrer(a.dataset.vue));
  });

  const construire = () => {
    // Départ : exactement la forme de la barre. Arrivée : la même forme, tombée sous le bas de l'écran.
    const r = (toit.getBoundingClientRect().height / window.innerHeight) * 100;
    const forme = (d) => `polygon(0% 0%, 100% 0%, 100% ${r + d}%, 50% ${d}%, 0% ${r + d}%)`;
    const d = (v) => (reduit ? 0.01 : v);
    const a = (v) => (reduit ? 0 : v);
    return gsap.timeline({
      paused: true,
      onReverseComplete: () => { m.hidden = true; dehors.forEach((e) => { e.inert = false; }); lenis?.start(); },
    })
      .fromTo(fond, { clipPath: forme(0) }, { clipPath: forme(100), duration: d(0.95), ease: 'power4.inOut' }, 0)
      .set(toit, { visibility: 'hidden' }, a(0.5)) // le noir a passé la barre : le bloc peut monter jusqu'en haut
      .fromTo(vues, { yPercent: 101 }, { yPercent: 0, duration: d(0.95), ease: 'power4.out' }, a(0.5))
      .fromTo(mots, { yPercent: 118 }, { yPercent: 0, duration: d(0.85), ease: 'power4.out', stagger: a(0.055) }, a(0.42));
  };

  const ouvrir = () => {
    if (ouvert) return;
    ouvert = true;
    precharger();
    montrer(liens[0].dataset.vue);
    m.hidden = false;
    lenis?.stop();
    dehors.forEach((e) => { e.inert = true; });
    bouton.textContent = 'Fermer';
    bouton.setAttribute('aria-expanded', 'true');
    tl ??= construire();
    tl.timeScale(1).play();
    liens[0].focus({ preventScroll: true });
  };
  const fermer = (cible) => {
    if (!ouvert) return;
    ouvert = false;
    bouton.textContent = 'Menu';
    bouton.setAttribute('aria-expanded', 'false');
    // La page est cachée par le noir : on saute à la section, et le toit remonte dessus.
    if (cible) {
      const el = $(cible);
      if (lenis) lenis.scrollTo(el, { immediate: true, force: true });
      else window.scrollTo(0, el.getBoundingClientRect().top + scrollY);
    }
    tl.timeScale(1.35).reverse();
    bouton.focus({ preventScroll: true });
  };

  bouton.addEventListener('click', () => (ouvert ? fermer() : ouvrir()));
  liens.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fermer(a.getAttribute('href'));
  }));
  $$('.barre a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    if (!ouvert) return;
    e.preventDefault();
    e.stopPropagation();
    fermer(a.getAttribute('href'));
  }));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
  window.addEventListener('resize', () => { if (m.hidden) tl = null; }, { passive: true }); // la pente dépend de l'écran
}

/* ———————— Mentions légales ———————— */
function mentions() {
  const d = $('#mentions');
  $$('[data-mentions]').forEach((b) => b.addEventListener('click', () => { lenis?.stop(); d.showModal(); d.scrollTop = 0; }));
  $('[data-fermer]', d).addEventListener('click', () => d.close());
  d.addEventListener('close', () => lenis?.start());
}

/* ———————— Départ ———————— */
panneaux();
facade();
const ouvrirChantier = visionneuse();
creerMur({ vue: $('#mur-vue'), monde: $('#mur-monde'), section: $('#chantiers'), ouvrir: ouvrirChantier, preparer: preparerNette, reduit });
zoneAutomatique();
avis();
devis();
menu();
mentions();
demarrerHaut();

window.__lenis = lenis;
