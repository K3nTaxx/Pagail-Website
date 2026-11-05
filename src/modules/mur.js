// Le mur de chantiers : un monde déplaçable à la souris, photos regroupées par chantier.
// Fluide parce que : seul le monde bouge (transform), seules les vignettes proches de l'écran
// existent dans le DOM, et chaque vignette a une couleur de fond tirée de sa photo.
import { gsap } from 'gsap';
import donnees from '../data/chantiers.json';

const MARGE_CHARGE = 0.35; // en écrans : les vignettes existent un peu avant d'arriver à l'écran
const MARGE_RETIRE = 0.9;

// Un bloc = un chantier. Tous les blocs ont la même hauteur, pour que le mur reste plein :
// une grande photo, puis des colonnes de deux, et une seconde grande si le compte est pair.
function blocChantier(c, u, gap, h1, H) {
  const n = c.photos.length;
  const large = u * 2 + gap;
  const tuiles = [];
  let x = 0;
  let i = 0;
  const grande = () => { tuiles.push({ p: c.photos[i++], x, y: 0, l: large, h: H }); x += large + gap; };
  grande();
  const secondeGrande = n > 1 && n % 2 === 0;
  while (i < n - (secondeGrande ? 1 : 0)) {
    tuiles.push({ p: c.photos[i++], x, y: 0, l: u, h: h1 });
    tuiles.push({ p: c.photos[i++], x, y: h1 + gap, l: u, h: h1 });
    x += u + gap;
  }
  if (secondeGrande) grande();
  return { c, tuiles, l: x - gap, h: H };
}

// Les rangs partent du centre : les premiers chantiers du manifeste sont ceux qu'on voit en arrivant.
function disposer(chantiers, vue) {
  const u = Math.round(Math.max(170, vue.l * 0.122));
  const gap = 6;
  const h1 = Math.round(u * 1.3);
  const H = h1 * 2 + gap;
  const entre = Math.round(u * 0.18);
  const pasRang = H + entre;
  const blocs = chantiers.map((c) => blocChantier(c, u, gap, h1, H));

  const largeurTotale = blocs.reduce((t, b) => t + b.l + entre, 0);
  const R = Math.max(1, Math.min(7, Math.round(Math.sqrt((largeurTotale * pasRang) / 1.9) / pasRang)));
  const ordre = [...Array(R).keys()].sort((a, b) => Math.abs(a - (R - 1) / 2) - Math.abs(b - (R - 1) / 2));
  const rangs = ordre.map((r) => ({ r, g: 0, d: 0 }));

  const places = blocs.map((b) => {
    const rang = rangs.reduce((m, x) => (x.g + x.d < m.g + m.d ? x : m));
    const decale = rang.r % 2 ? Math.round(u * 0.7) : 0; // joints décalés, comme des rangs de tuiles
    let x;
    if (rang.d <= rang.g) { x = rang.d + decale; rang.d += b.l + entre; }
    else { rang.g += b.l + entre; x = -rang.g + decale; }
    const y = (rang.r - (R - 1) / 2) * pasRang - H / 2;
    return { ...b, x, y };
  });

  // Une fois tout posé, on recentre : les rangs n'ont pas tous la même longueur à gauche et à droite.
  const x0 = Math.min(...places.map((b) => b.x)), x1 = Math.max(...places.map((b) => b.x + b.l));
  const y0 = Math.min(...places.map((b) => b.y)), y1 = Math.max(...places.map((b) => b.y + b.h));

  const taille = Math.min(window.innerWidth * 0.112, window.innerHeight * 0.2);
  const titreL = Math.round(taille * 4.03), titreH = Math.round(taille * 0.86);
  const titre = { x: -titreL / 2, y: -titreH / 2, l: titreL, h: titreH };
  const bornes = {
    x0: Math.min(x0, titre.x), x1: Math.max(x1, titre.x + titreL),
    y0: Math.min(y0, titre.y), y1: Math.max(y1, titre.y + titreH),
  };
  return { places, titre, bornes, centre: { x: 0, y: 0 } };
}

export function creerMur({ vue, monde, section, ouvrir, preparer, reduit }) {
  let filtre = 'tout';
  let plan, objets = [];
  let px = 0, py = 0, vx = 0, vy = 0;
  let tire = false, bouge = false, depart = null, actif = false, enBoucle = false;
  let vueL = 0, vueH = 0;
  let premiereFois = true, arrive = false, dernierCalcul = { x: 1e9, y: 1e9 };
  let titre = null, survolId = null, reprises = null, finTransition = 0;
  const appliquer = gsap.quickSetter(monde, 'css');
  const fixerTransform = () => appliquer({ x: Math.round(px), y: Math.round(py), force3D: true });

  const bornes = () => {
    // Le monde peut être plus petit que l'écran (un seul filtre) : on le centre alors.
    const b = plan.bornes;
    const marge = 40;
    const minX = vueL - b.x1 - marge, maxX = -b.x0 + marge;
    const minY = vueH - b.y1 - marge, maxY = -b.y0 + marge;
    return {
      minX: minX > maxX ? (minX + maxX) / 2 : minX, maxX: minX > maxX ? (minX + maxX) / 2 : maxX,
      minY: minY > maxY ? (minY + maxY) / 2 : minY, maxY: minY > maxY ? (minY + maxY) / 2 : maxY,
    };
  };

  // anime : les vignettes déjà à l'écran glissent vers leur nouvelle place, les autres s'effacent
  // ou arrivent. C'est le passage d'un filtre à l'autre.
  function construire(anime = false) {
    survoler(null);
    const avant = new Map();
    if (anime && !reduit) {
      const v = vue.getBoundingClientRect();
      objets.forEach((o) => {
        if (!o.el) return;
        const r = o.el.getBoundingClientRect();
        gsap.killTweensOf(o.el);
        avant.set(o.p.id, { x: r.left - v.left, y: r.top - v.top, l: r.width, h: r.height, el: o.el });
      });
    } else objets.forEach((o) => o.el && o.el.remove());
    vueL = vue.clientWidth; vueH = vue.clientHeight;
    const liste = filtre === 'tout' ? donnees.chantiers : donnees.chantiers.filter((c) => c.cat === filtre);
    plan = disposer(liste, { l: vueL, h: vueH });
    objets = [];

    if (!titre) {
      titre = document.createElement('div');
      titre.className = 'mur-titre titre';
      titre.textContent = 'Chantiers';
      if (!reduit && !arrive) titre.style.opacity = 0;
      monde.append(titre);
    }
    titre.style.transform = 'translate3d(-50%,-50%,0)'; // centré sur l'axe du mur, quelle que soit sa largeur

    plan.places.forEach((b) => {
      b.tuiles.forEach((t, indice) => {
        objets.push({ x: b.x + t.x, y: b.y + t.y, l: t.l, h: t.h, p: t.p, chantier: b.c, indice, el: null, charge: false });
      });
    });

    px = vueL / 2 - plan.centre.x;
    py = vueH / 2 - plan.centre.y;
    vx = vy = 0;
    const b = bornes();
    px = Math.min(b.maxX, Math.max(b.minX, px));
    py = Math.min(b.maxY, Math.max(b.minY, py));
    fixerTransform();
    dernierCalcul = { x: 1e9, y: 1e9 };

    if (avant.size) {
      reprises = avant;
      monde.classList.add('en-transition');
      finTransition += 1;
      const n = finTransition;
      setTimeout(() => { if (n === finTransition) monde.classList.remove('en-transition'); }, 1050);
    }
    actualiser();
    if (reprises) {
      // Celles qui ne sont plus dans ce filtre s'effacent sur place.
      for (const a of reprises.values()) {
        a.el.style.left = `${a.x - px}px`;
        a.el.style.top = `${a.y - py}px`;
        a.el.style.pointerEvents = 'none';
        gsap.set(a.el, { clearProps: 'transform' });
        gsap.to(a.el, { opacity: 0, scale: 0.94, duration: 0.28, ease: 'power2.in', onComplete: () => a.el.remove() });
      }
      reprises = null;
    }
  }

  // Crée les vignettes proches de l'écran, retire les lointaines.
  function actualiser() {
    const mx = vueL * MARGE_CHARGE, my = vueH * MARGE_CHARGE;
    const rx = vueL * MARGE_RETIRE, ry = vueH * MARGE_RETIRE;
    const x0 = -px - mx, x1 = -px + vueL + mx, y0 = -py - my, y1 = -py + vueH + my;
    const X0 = -px - rx, X1 = -px + vueL + rx, Y0 = -py - ry, Y1 = -py + vueH + ry;
    for (const o of objets) {
      const proche = o.x < x1 && o.x + o.l > x0 && o.y < y1 && o.y + o.h > y0;
      const loin = o.x > X1 || o.x + o.l < X0 || o.y > Y1 || o.y + o.h < Y0;
      if (proche && !o.el) monter(o);
      else if (loin && o.el) { o.el.remove(); o.el = null; }
    }
    dernierCalcul = { x: px, y: py };
  }

  function monter(o) {
    const reprise = reprises?.get(o.p.id);
    if (reprise) {
      // Déjà à l'écran : on garde la vignette et elle glisse de son ancienne place à la nouvelle.
      reprises.delete(o.p.id);
      const e = reprise.el;
      e.style.left = `${o.x}px`; e.style.top = `${o.y}px`; e.style.width = `${o.l}px`; e.style.height = `${o.h}px`;
      e.dataset.indice = o.indice;
      o.el = e; o.charge = true;
      gsap.fromTo(e,
        { x: reprise.x - (o.x + px), y: reprise.y - (o.y + py), scaleX: reprise.l / o.l, scaleY: reprise.h / o.h, transformOrigin: '0 0', opacity: 1 },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.85, ease: 'power3.inOut', clearProps: 'transform' });
      return;
    }
    const entre = !!reprises;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tuile';
    el.style.cssText = `left:${o.x}px;top:${o.y}px;width:${o.l}px;height:${o.h}px;--c:${o.p.c}`;
    el.setAttribute('aria-label', `Ouvrir le chantier : ${o.chantier.titre}`);
    el.dataset.chantier = o.chantier.id;
    el.dataset.indice = o.indice;
    el.dataset.photo = o.p.id;
    const img = new Image();
    img.decoding = 'async';
    img.draggable = false;
    img.alt = '';
    img.width = o.l; img.height = o.h;
    img.src = `/img/mur/v/${o.p.id}.webp`;
    el.append(img);

    // Le volet ne se joue qu'une fois, à la première arrivée. Après, un filtre ou un glissement
    // affiche les vignettes tout de suite : le mur doit répondre sans attendre.
    if (!arrive && !reduit) {
      const volet = document.createElement('i');
      volet.className = 'volet';
      el.append(volet);
      const fin = () => {
        o.charge = true;
        if (!arrive) return;
        gsap.to(volet, { scaleY: 0, duration: 0.6, ease: 'power3.inOut', onComplete: () => volet.remove() });
      };
      img.decode().then(fin, fin);
    }
    if (o.chantier.id === survolId) el.setAttribute('data-chantier-actif', '');
    o.el = el;
    monde.append(el);
    // Nouvelle dans ce filtre : elle arrive une fois que les autres ont commencé à glisser.
    if (entre) gsap.fromTo(el, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.24 + Math.random() * 0.22, ease: 'power3.out', clearProps: 'opacity,transform' });
  }

  // Boucle d'inertie : ne tourne que tant que le mur bouge.
  function boucle() {
    if (!tire) {
      px += vx; py += vy;
      vx *= 0.93; vy *= 0.93;
      const b = bornes();
      if (px > b.maxX) { px += (b.maxX - px) * 0.14; vx *= 0.7; }
      if (px < b.minX) { px += (b.minX - px) * 0.14; vx *= 0.7; }
      if (py > b.maxY) { py += (b.maxY - py) * 0.14; vy *= 0.7; }
      if (py < b.minY) { py += (b.minY - py) * 0.14; vy *= 0.7; }
    }
    fixerTransform();
    if (Math.abs(px - dernierCalcul.x) > 60 || Math.abs(py - dernierCalcul.y) > 60) actualiser();
    const b = bornes();
    const dehors = px > b.maxX + 0.5 || px < b.minX - 0.5 || py > b.maxY + 0.5 || py < b.minY - 0.5;
    if (tire || dehors || Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) requestAnimationFrame(boucle);
    else { enBoucle = false; actualiser(); }
  }
  const lancer = () => { if (!enBoucle) { enBoucle = true; requestAnimationFrame(boucle); } };

  vue.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    tire = true; bouge = false;
    // On retient la vignette dès l'appui : c'est elle qui s'ouvrira au relâchement.
    const cible = e.target.closest('.tuile');
    const bloc = cible ? null : blocSous(e.clientX, e.clientY); // la jointure entre deux photos compte aussi
    if (cible) preparer?.(cible.dataset.photo);
    else if (bloc) preparer?.(bloc.c.photos[0].id);
    depart = { x: e.clientX, y: e.clientY, px, py, cible, bloc, t: performance.now(), lx: e.clientX, ly: e.clientY, lt: performance.now() };
    vx = vy = 0;
    lancer();
  });

  window.addEventListener('pointermove', (e) => {
    if (!tire) return;
    const dx = e.clientX - depart.x, dy = e.clientY - depart.y;
    if (!bouge && Math.hypot(dx, dy) > 6) {
      bouge = true;
      vue.classList.add('glisse');
      survoler(null);
      vue.setPointerCapture?.(e.pointerId);
    }
    if (bouge) {
      const b = bornes();
      let nx = depart.px + dx, ny = depart.py + dy;
      // Résistance au bord.
      if (nx > b.maxX) nx = b.maxX + (nx - b.maxX) * 0.3;
      if (nx < b.minX) nx = b.minX + (nx - b.minX) * 0.3;
      if (ny > b.maxY) ny = b.maxY + (ny - b.maxY) * 0.3;
      if (ny < b.minY) ny = b.minY + (ny - b.minY) * 0.3;
      px = nx; py = ny;
      const now = performance.now();
      const dt = Math.max(1, now - depart.lt);
      vx = gsap.utils.clamp(-70, 70, (e.clientX - depart.lx) / dt * 16.7);
      vy = gsap.utils.clamp(-70, 70, (e.clientY - depart.ly) / dt * 16.7);
      depart.lx = e.clientX; depart.ly = e.clientY; depart.lt = now;
    }
  }, { passive: true });

  const finir = (e) => {
    if (!tire) return;
    tire = false;
    vue.classList.remove('glisse');
    if (depart && performance.now() - depart.lt > 90) { vx = vy = 0; }
    if (!bouge && e.type === 'pointerup') {
      if (depart?.cible) ouvrirDepuis(depart.cible);
      else if (depart?.bloc) ouvrir(depart.bloc.c, 0, null);
    }
    lancer();
  };
  window.addEventListener('pointerup', finir);
  window.addEventListener('pointercancel', finir);

  function ouvrirDepuis(el) {
    const chantier = donnees.chantiers.find((c) => c.id === el.dataset.chantier);
    if (chantier) ouvrir(chantier, Number(el.dataset.indice) || 0, el);
  }
  monde.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.tuile')) {
      e.preventDefault();
      ouvrirDepuis(e.target.closest('.tuile'));
    }
  });
  // Clavier seulement : amener à l'écran la vignette qui prend le focus. À la souris, surtout pas :
  // le mur bougerait sous le curseur dès l'appui et le premier clic ne servirait à rien.
  monde.addEventListener('focusin', (e) => {
    const el = e.target.closest('.tuile');
    if (!el || !el.matches(':focus-visible')) return;
    vue.scrollLeft = 0; vue.scrollTop = 0;
    const x = parseFloat(el.style.left), y = parseFloat(el.style.top), l = parseFloat(el.style.width), h = parseFloat(el.style.height);
    const b = bornes();
    if (x + px < 0 || x + l + px > vueL) px = Math.min(b.maxX, Math.max(b.minX, vueL / 2 - x - l / 2));
    if (y + py < 0 || y + h + py > vueH) py = Math.min(b.maxY, Math.max(b.minY, vueH / 2 - y - h / 2));
    fixerTransform(); actualiser();
  });

  // Survol : calculé sur le bloc entier, jointures comprises. La surbrillance et le curseur tiennent
  // tant qu'on reste dans le chantier, et ne changent qu'en sortant du bloc.
  function blocSous(cx, cy) {
    if (!plan) return null;
    const r = vue.getBoundingClientRect();
    const x = cx - r.left - px, y = cy - r.top - py;
    return plan.places.find((b) => x >= b.x && x <= b.x + b.l && y >= b.y && y <= b.y + b.h) || null;
  }
  function survoler(bloc) {
    const id = bloc ? bloc.c.id : null;
    if (id === survolId) return;
    survolId = id;
    vue.classList.toggle('sur-bloc', !!id);
    if (id) monde.dataset.survol = id; else delete monde.dataset.survol;
    monde.querySelectorAll('.tuile').forEach((t) => t.toggleAttribute('data-chantier-actif', t.dataset.chantier === id));
  }
  vue.addEventListener('pointermove', (e) => {
    if (tire) return;
    survoler(blocSous(e.clientX, e.clientY));
    const t = e.target.closest?.('.tuile');
    if (t) preparer?.(t.dataset.photo); // la photo nette est prête avant même le clic
  }, { passive: true });
  vue.addEventListener('pointerleave', () => survoler(null));

  // Trackpad : un balayage surtout horizontal déplace le mur ; la molette verticale continue de faire défiler la page.
  vue.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2) {
      e.preventDefault();
      e.stopPropagation();
      px -= e.deltaX;
      const b = bornes();
      px = Math.min(b.maxX + 60, Math.max(b.minX - 60, px));
      lancer();
    }
  }, { passive: false });

  // Le trait bleu glisse d'un filtre à l'autre.
  const curseur = section.querySelector('#mur-curseur');
  const placerCurseur = (instant) => {
    const b = section.querySelector('[data-filtre][aria-pressed="true"]');
    gsap.to(curseur, { x: b.offsetLeft, scaleX: b.offsetWidth / 100, duration: instant || reduit ? 0 : 0.55, ease: 'power3.inOut', overwrite: 'auto' });
  };
  placerCurseur(true);
  document.fonts?.ready.then(() => placerCurseur(true));

  section.querySelectorAll('[data-filtre]').forEach((b) => {
    b.addEventListener('click', () => {
      if (filtre === b.dataset.filtre) return;
      filtre = b.dataset.filtre;
      section.querySelectorAll('[data-filtre]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      placerCurseur();
      construire(true);
    });
  });

  let attente;
  window.addEventListener('resize', () => {
    clearTimeout(attente);
    attente = setTimeout(() => { placerCurseur(true); if (actif) construire(); else plan = null; }, 180);
  }, { passive: true });

  // Le mur n'existe vraiment que lorsqu'il approche de l'écran (préchargé deux écrans à l'avance).
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      actif = true;
      if (premiereFois || !plan) { premiereFois = false; construire(); }
    }
  }, { rootMargin: '200% 0px' }).observe(section);

  // Le volet de la première arrivée à l'écran, une seule fois.
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    if (!plan) construire();
    arrive = true;
    if (titre) gsap.to(titre, { opacity: 1, duration: 0.42, ease: 'none', delay: 0.14 });
    objets.forEach((o) => {
      const volet = o.el?.querySelector('.volet');
      if (!volet || !o.charge) return; // pas encore décodée : son volet se lèvera au décodage
      const aLEcran = o.x + px < vueL && o.x + o.l + px > 0 && o.y + py < vueH && o.y + o.h + py > 0;
      if (reduit || !aLEcran) { volet.remove(); return; }
      gsap.to(volet, { scaleY: 0, duration: 0.7, ease: 'power3.inOut', delay: Math.min(0.35, Math.hypot(o.x + px - vueL / 2, o.y + py - vueH / 2) / 3200), onComplete: () => volet.remove() });
    });
  }, { rootMargin: '-14% 0px' }).observe(section);
}
