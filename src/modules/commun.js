// Ce que partagent l'accueil et les pages prestations : défilement, chargement des images, langage
// d'animation (volet qui se relève, texte en court fondu, mots qui sortent du faîtage).
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { telephone } from './appareil.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const racine = document.documentElement;

/* ———————— Défilement ———————— */
// Au doigt, le défilement natif du téléphone est le meilleur : Lenis ne sert que sur ordinateur.
export const lenis = reduit || telephone ? null : new Lenis({ lerp: 0.12, wheelMultiplier: 0.9, smoothWheel: true });
if (lenis) {
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
window.__lenis = lenis;

// Fige la page derrière un menu ou une fenêtre. Sur ordinateur, la classe n'a aucun effet.
export function figer(fige) {
  if (fige) lenis?.stop(); else lenis?.start();
  racine.classList.toggle('fige', fige);
}

export function allerA(cible, immediat = false) {
  const el = typeof cible === 'string' ? $(cible) : cible;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, immediat ? { immediate: true, force: true } : { duration: 1.1, force: true });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: telephone && !reduit && !immediat ? 'smooth' : 'auto' });
}

// Liens vers une section de la même page : défilement doux plutôt qu'un saut.
export function liensInternes() {
  document.addEventListener('click', (e) => {
    const lien = e.target.closest('a[href^="#"]');
    if (!lien) return;
    e.preventDefault();
    allerA(lien.getAttribute('href'));
  });
}

/* ———————— Chargement des images : deux écrans à l'avance, décodées avant d'arriver ———————— */
const pretes = new WeakMap();
export function charger(img) {
  if (pretes.has(img)) return pretes.get(img);
  const promesse = new Promise((resolve) => {
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    if (telephone && img.dataset.srcTel) img.src = img.dataset.srcTel;
    else if (img.dataset.src) img.src = img.dataset.src;
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
export const prechargeur = new IntersectionObserver((entrees) => {
  entrees.forEach((e) => {
    if (!e.isIntersecting) return;
    prechargeur.unobserve(e.target);
    $$('img[data-src]:not([data-differe])', e.target).forEach(charger);
  });
}, { rootMargin: '200% 0px' });

export function piedDePage() {
  const pied = $('.pied');
  if (!pied) return;
  new IntersectionObserver((entrees, obs) => {
    if (entrees[0].isIntersecting) { obs.disconnect(); charger($('.pied-logo')); }
  }, { rootMargin: '100% 0px' }).observe(pied);
}

/* ———————— Le titre sur les pentes : chaque mot sort de derrière le faîtage ———————— */
export function sortirDuFaitage(conteneur, delai = 0) {
  const g = $$('.pente-g .mot > span', conteneur);
  const d = $$('.pente-d .mot > span', conteneur);
  if (!g.length && !d.length) return;
  gsap.set([...g, ...d], { visibility: 'visible' });
  if (reduit) return;
  gsap.fromTo(g, { xPercent: 104 }, { xPercent: 0, duration: 1.05, ease: 'power3.out', delay: delai, stagger: 0.09 });
  gsap.fromTo(d, { xPercent: -104 }, { xPercent: 0, duration: 1.05, ease: 'power3.out', delay: delai, stagger: 0.09 });
}

/* ———————— Le langage d'animation : volet qui se relève, texte en court fondu. Une seule fois. ———————— */
export function reveler(section) {
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
export const arrivee = new IntersectionObserver((entrees) => {
  entrees.forEach((e) => {
    if (!e.isIntersecting) return;
    arrivee.unobserve(e.target);
    reveler(e.target);
  });
}, { rootMargin: '-14% 0px -14% 0px' });
