// Menu : le toit descend sur la page, le bloc monte jusqu'en haut. Tout s'annule à la fermeture.
import { gsap } from 'gsap';
import { telephone } from './appareil.js';
import { $, $$, reduit, racine, lenis, figer } from './commun.js';

export function creerMenu() {
  const m = $('#menu');
  if (!m) return;
  const fond = $('.menu-fond', m);
  const liens = $$('.menu-liens a', m);
  const mots = $$('.menu-liens a > span', m);
  const vues = $('#menu-vues', m);
  const toit = $('.barre-toit');
  const bouton = $('#menu-ouvrir');
  const dehors = [$('main'), $('.pied')].filter(Boolean);
  const images = new Map();
  let tl = null, ouvert = false;

  // Toutes les vues sont décodées dès le survol du bouton : aucune case vide d'un lien à l'autre.
  const precharger = () => {
    if (images.size) return;
    liens.forEach((a) => {
      const i = new Image();
      i.alt = ''; i.decoding = 'async';
      i.src = `/img/${telephone ? 'tel/' : ''}menu/${a.dataset.vue}.webp`;
      i.decode?.().catch(() => {});
      vues.append(i);
      images.set(a.dataset.vue, i);
    });
  };
  const montrer = (vue) => images.forEach((i, k) => i.classList.toggle('active', k === vue));
  bouton.addEventListener('pointerenter', precharger);
  liens.forEach((a) => {
    if (telephone) { a.addEventListener('pointerdown', () => montrer(a.dataset.vue)); return; }
    a.addEventListener('pointerenter', () => montrer(a.dataset.vue));
    a.addEventListener('focus', () => montrer(a.dataset.vue));
  });

  const construire = () => {
    // Départ : exactement la forme de la barre. Arrivée : la même forme, tombée sous le bas de l'écran.
    const r = (toit.getBoundingClientRect().height / window.innerHeight) * 100;
    // Sur téléphone, le faîte de la barre ne touche pas le haut de l'écran : voir --pente dans telephone.css.
    const c = telephone ? r - (Math.min(0.0936 * window.innerWidth, 0.09 * window.innerHeight) / window.innerHeight) * 100 : 0;
    const forme = (d) => `polygon(0% 0%, 100% 0%, 100% ${r + d}%, 50% ${c + d}%, 0% ${r + d}%)`;
    const d = (v) => (reduit ? 0.01 : v);
    const a = (v) => (reduit ? 0 : v);
    return gsap.timeline({
      paused: true,
      onReverseComplete: () => { m.hidden = true; dehors.forEach((e) => { e.inert = false; }); figer(false); },
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
    figer(true);
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
    if (telephone) racine.classList.remove('fige');
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
    const href = a.getAttribute('href');
    // Depuis une page prestation, le lien mène à l'accueil : navigation normale.
    if (!href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    fermer(href);
  }));
  $$('.barre a[href^="#"], .appel a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    if (!ouvert) return;
    e.preventDefault();
    e.stopPropagation();
    fermer(a.getAttribute('href'));
  }));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
  window.addEventListener('resize', () => { if (m.hidden) tl = null; }, { passive: true }); // la pente dépend de l'écran
}
