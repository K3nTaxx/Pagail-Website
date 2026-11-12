// Fenêtres et barres communes : mentions légales, visionneuse de chantier, barres du téléphone,
// et l'avant/après qu'on maintient.
import { telephone } from './appareil.js';
import { $, $$, racine, figer } from './commun.js';

/* ———————— Mentions légales ———————— */
export function mentions() {
  const d = $('#mentions');
  if (!d) return;
  $$('[data-mentions]').forEach((b) => b.addEventListener('click', () => { figer(true); d.showModal(); d.scrollTop = 0; }));
  $('[data-fermer]', d).addEventListener('click', () => d.close());
  d.addEventListener('close', () => figer(false));
}

/* ———————— Téléphone : la barre se retire quand on descend, et revient dès qu'on remonte.
   La barre d'appel s'efface quand le formulaire de devis ou le pied de page est à l'écran. ———————— */
export function barresTelephone(caches = ['#devis', '.pied']) {
  const barre = $('.barre');
  const appel = $('#appel');
  const menuOuvert = $('#menu');
  let dernier = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!menuOuvert.hidden) { dernier = y; return; }
    if (Math.abs(y - dernier) < 8) return;
    barre.classList.toggle('barre-cachee', y > dernier && y > 90);
    dernier = y;
  }, { passive: true });

  const visibles = new Set();
  const garde = new IntersectionObserver((entrees) => {
    entrees.forEach((e) => { if (e.isIntersecting) visibles.add(e.target); else visibles.delete(e.target); });
    appel.classList.toggle('appel-cachee', visibles.size > 0 && racine.dataset.arrive !== undefined);
  }, { rootMargin: '0px 0px -22% 0px' });
  caches.map((s) => $(s)).filter(Boolean).forEach((el) => garde.observe(el));
}

/* ———————— Visionneuse ———————— */
// Les photos nettes sont préparées dès le survol. Au clic, la vignette s'affiche tout de suite
// et la photo nette la remplace dès qu'elle est décodée : le premier clic répond immédiatement.
const nettes = new Map();
export function preparerNette(id) {
  if (!nettes.has(id)) {
    const img = new Image();
    img.alt = '';
    img.src = `/img/mur/${telephone ? 'm' : 'g'}/${id}.webp`; // plus légère sur téléphone
    nettes.set(id, { img, pret: img.decode().then(() => img, () => null) });
  }
  return nettes.get(id);
}
export function visionneuse() {
  const d = $('#visionneuse');
  if (!d) return () => {};
  const boite = $('#visionneuse-photo');
  const titre = $('#visionneuse-titre');
  const traits = $('#visionneuse-traits');
  let chantier = null, n = 0, retour = null;
  const texte = (p) => p.alt || chantier.titre;

  const montrer = (i) => {
    n = (i + chantier.photos.length) % chantier.photos.length;
    const courant = n;
    const p = chantier.photos[n];
    const vignette = new Image();
    vignette.alt = texte(p);
    vignette.src = `/img/mur/v/${p.id}.webp`;
    boite.replaceChildren(vignette);
    preparerNette(p.id).pret.then((img) => {
      if (img && d.open && courant === n && chantier?.photos[n] === p) { img.alt = texte(p); boite.replaceChildren(img); }
    });
    $$('i', traits).forEach((t, k) => t.classList.toggle('vu', k <= n));
    preparerNette(chantier.photos[(n + 1) % chantier.photos.length].id);
    preparerNette(chantier.photos[(n - 1 + chantier.photos.length) % chantier.photos.length].id);
  };
  const ouvrir = (c, depart, el) => {
    chantier = c; retour = el;
    traits.replaceChildren(...c.photos.map(() => document.createElement('i')));
    titre.textContent = c.titre;
    figer(true);
    d.showModal();
    montrer(depart);
  };
  d.addEventListener('close', () => { figer(false); boite.replaceChildren(); retour?.focus?.({ preventScroll: true }); });
  // Au doigt : on balaie pour passer d'une photo à l'autre.
  if (telephone) {
    let x0 = null, y0 = 0;
    d.addEventListener('touchstart', (e) => {
      x0 = e.touches.length === 1 ? e.touches[0].clientX : null;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    d.addEventListener('touchend', (e) => {
      if (x0 === null || !chantier) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) montrer(n + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
  $('#visionneuse-prec').addEventListener('click', () => montrer(n - 1));
  $('#visionneuse-suiv').addEventListener('click', () => montrer(n + 1));
  $('[data-fermer]', d).addEventListener('click', () => d.close());
  d.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') montrer(n + 1);
    if (e.key === 'ArrowLeft') montrer(n - 1);
  });
  return ouvrir;
}

/* ———————— Maintenir pour voir l'avant. Une coupe, pas de ligne glissante. ———————— */
export function maintenir({ section, photos, bouton, changer }) {
  const etat = (tenu) => {
    section.classList.toggle('tenu', tenu);
    changer?.(tenu);
  };
  const tenir = (e) => { e.preventDefault(); etat(true); };
  const lacher = () => { if (section.classList.contains('tenu')) etat(false); };
  if (telephone) {
    // Le bouton répond tout de suite. La photo attend un vrai appui : un doigt qui part défiler ne doit rien déclencher.
    bouton.addEventListener('pointerdown', tenir);
    let appui;
    const annuler = () => clearTimeout(appui);
    photos.addEventListener('pointerdown', () => { annuler(); appui = setTimeout(() => etat(true), 160); });
    window.addEventListener('pointerup', annuler);
    window.addEventListener('pointercancel', annuler);
    bouton.addEventListener('contextmenu', (e) => e.preventDefault());
  } else [photos, bouton].forEach((el) => el.addEventListener('pointerdown', tenir));
  window.addEventListener('pointerup', lacher);
  window.addEventListener('pointercancel', lacher);
  window.addEventListener('blur', lacher);
  bouton.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); etat(true); } });
  bouton.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') lacher(); });
  bouton.addEventListener('blur', lacher);
  photos.addEventListener('contextmenu', (e) => e.preventDefault());
}
