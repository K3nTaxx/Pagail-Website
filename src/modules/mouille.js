// La signature, en deux temps.
// 1. L'arrivée du site : l'eau part du haut du faîtage, descend l'arête, court le long des rangs de
//    tuiles et découvre la photo sur le noir. La tuile apparaît mouillée, puis sèche.
// 2. Ensuite, le curseur mouille la tuile, qui sèche en 2 à 3 secondes.
// Tampon d'humidité en ping-pong (même principe que Flowmap d'OGL), mais avec un tampon qui
// dépend de la présence de l'eau et non de la vitesse : un curseur lent mouille autant qu'un rapide.
// La trace est un segment entre deux positions, donc continue même si la souris va vite.
// Rendu seulement quand le haut de page est visible et qu'il reste de l'eau à afficher.
import { Renderer, Program, Mesh, Triangle, Texture, RenderTarget } from 'ogl';

const vertex = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const passeEau = /* glsl */ `
precision highp float;
uniform sampler2D tPrec;
uniform vec2 uA;
uniform vec2 uB;
uniform float uRayon;
uniform float uAspect;
uniform float uDt;
uniform float uForce;
varying vec2 vUv;

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  // L'eau descend la pente : le faîtage est vertical au centre, donc elle s'en éloigne à l'horizontale.
  float cote = vUv.x - 0.5;
  vec2 pente = vec2(-sign(cote) * smoothstep(0.0, 0.08, abs(cote)), 0.0);
  float v = texture2D(tPrec, vUv + pente * uDt * 0.016).r;

  // Séchage linéaire : avec le seuil de la passe finale, la trace disparaît entre 2 et 3 s. Le seuil irrégulier est dans la passe finale.
  v = max(0.0, v - uDt / 3.4);

  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 a = vec2(uA.x * uAspect, uA.y);
  vec2 b = vec2(uB.x * uAspect, uB.y);
  float s = smoothstep(uRayon, uRayon * 0.2, segment(p, a, b)) * uForce;
  gl_FragColor = vec4(max(v, s), 0.0, 0.0, 1.0);
}`;

const passeFinale = /* glsl */ `
precision highp float;
uniform sampler2D tPhoto;
uniform sampler2D tEau;
uniform vec2 uEch;
uniform vec2 uDec;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uT;     // temps de l'arrivée en secondes, négatif une fois terminée
uniform float uZoom;  // la photo se pose pendant l'arrivée
varying vec2 vUv;

const vec3 NOIR = vec3(0.0196, 0.0196, 0.0275);

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 photo(vec2 uv) { return texture2D(tPhoto, uv).rgb; }

void main() {
  vec2 uv = uDec + (0.5 + (vUv - 0.5) * uZoom) * uEch;
  vec3 c = photo(uv);

  // Le bord de la trace n'est jamais net : l'eau suit le grain, pas un pinceau.
  vec2 q = vec2(vUv.x * uAspect, vUv.y);
  vec2 ecart = vec2(bruit(q * 11.0), bruit(q * 11.0 + 7.3)) - 0.5;
  float v = texture2D(tEau, vUv + ecart * 0.024).r;

  // L'arrivée : chaque rang de tuiles a sa vitesse, l'eau part du sommet et s'écarte du faîtage.
  float revele = 1.0;
  float front = 9.0;
  if (uT >= 0.0) {
    float d = abs(vUv.x - 0.5);
    float rang = bruit(vec2(vUv.y * 15.0, 3.1)) * 0.7 + bruit(vec2(vUv.y * 5.5, 9.7)) * 0.3;
    float grain = bruit(q * 34.0) * 0.6 + bruit(q * 90.0) * 0.4;
    front = uT * 1.75 - d * (1.1 + (1.0 - rang) * 0.62) - (1.0 - vUv.y) * 0.26 - grain * 0.035;
    revele = smoothstep(0.0, 0.012, front);
    if (revele <= 0.0) { gl_FragColor = vec4(NOIR, 1.0); return; }
    v = max(v, 1.0 - smoothstep(0.75, 2.5, front));
  }
  if (v < 0.003) { gl_FragColor = vec4(mix(NOIR, c, revele), 1.0); return; }

  float l0 = lum(c);
  vec2 f = uTexel * 1.6, g = uTexel * 9.0;
  float fx = lum(photo(uv + vec2(f.x, 0.0))) - lum(photo(uv - vec2(f.x, 0.0)));
  float fy = lum(photo(uv + vec2(0.0, f.y))) - lum(photo(uv - vec2(0.0, f.y)));
  float gD = lum(photo(uv + vec2(g.x, 0.0))), gG = lum(photo(uv - vec2(g.x, 0.0)));
  float gH = lum(photo(uv + vec2(0.0, g.y))), gB = lum(photo(uv - vec2(0.0, g.y)));
  float large = (gD + gG + gH + gB) * 0.25;

  // Front de séchage : la terre cuite boit l'eau par plaques. Les creux et la mousse restent humides
  // plus longtemps, les parties claires et lisses sèchent d'abord.
  float plaques = bruit(q * 8.0) * 0.45 + bruit(q * 21.0) * 0.35 + bruit(q * 60.0) * 0.2;
  float seuil = v - (1.0 - plaques) * 0.36 + (0.46 - l0) * 0.32;
  float mouille = smoothstep(0.0, 0.17, seuil);
  float film = smoothstep(0.34, 0.86, v + (plaques - 0.5) * 0.3);

  // Terre cuite mouillée : d'abord plus sombre, un peu plus saturée. Jamais rouge vif.
  vec3 sature = clamp(mix(vec3(l0), c, 1.2), 0.0, 1.0);
  vec3 sombre = pow(sature, vec3(1.32)) * 0.76 * vec3(1.02, 0.98, 0.95);

  // Reflet du ciel : éclats sur le grain, voile brillant sur le haut du galbe de la tuile.
  vec3 n = normalize(vec3(-fx * 4.4, fy * 4.4, 1.0));
  vec3 H = normalize(vec3(-0.2, 0.46, 1.0));
  float eclat = pow(max(dot(n, H), 0.0), 130.0);
  float galbe = smoothstep(0.34, 0.68, large);
  float grain = smoothstep(0.46, 0.8, l0);
  vec3 ciel = vec3(0.86, 0.92, 1.0);
  vec3 eau = sombre + ciel * (eclat * 0.7 + galbe * 0.075 + grain * galbe * 0.3) * film;

  vec3 sortie = mix(c, eau, mouille * 0.94);
  // Le bord de l'eau qui avance accroche la lumière.
  sortie += ciel * (1.0 - smoothstep(0.0, 0.07, front)) * 0.22;
  gl_FragColor = vec4(mix(NOIR, sortie, revele), 1.0);
}`;

export function mouillerLaTuile({ conteneur, image, canvas }) {
  let renderer;
  try {
    renderer = new Renderer({
      canvas, alpha: false, antialias: false, depth: false, stencil: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      premultipliedAlpha: false, powerPreference: 'high-performance',
    });
  } catch {
    return null; // Sans WebGL, la photo reste affichée telle quelle.
  }
  const gl = renderer.gl;
  if (!gl) return null;
  if (!renderer.isWebgl2 && !gl.renderer.extensions['OES_texture_half_float']) return null;

  const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE });
  texture.image = image;

  // Tampon d'humidité : demi-flottant, sinon la décroissance se bloque en 8 bits.
  const type = gl.HALF_FLOAT || gl.renderer.extensions['OES_texture_half_float'].HALF_FLOAT_OES;
  const filtre = gl.renderer.isWebgl2 || gl.renderer.extensions['OES_texture_half_float_linear'] ? gl.LINEAR : gl.NEAREST;
  const options = {
    width: 640, height: 400, type, format: gl.RGBA,
    internalFormat: gl.renderer.isWebgl2 ? gl.RGBA16F : gl.RGBA,
    minFilter: filtre, magFilter: filtre, depth: false,
  };
  let lecture = new RenderTarget(gl, options);
  let ecriture = new RenderTarget(gl, options);

  const triangle = new Triangle(gl);
  const eau = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex, fragment: passeEau, depthTest: false, depthWrite: false,
      uniforms: {
        tPrec: { value: lecture.texture }, uA: { value: [0, 0] }, uB: { value: [0, 0] },
        uRayon: { value: 0.085 }, uAspect: { value: 1 }, uDt: { value: 0.016 }, uForce: { value: 0 },
      },
    }),
  });
  const finale = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex, fragment: passeFinale, depthTest: false, depthWrite: false,
      uniforms: {
        tPhoto: { value: texture }, tEau: { value: lecture.texture },
        uEch: { value: [1, 1] }, uDec: { value: [0, 0] }, uTexel: { value: [1 / 2000, 1 / 1250] }, uAspect: { value: 1 },
        uT: { value: 0 }, uZoom: { value: 0.94 },
      },
    }),
  });

  let rect = conteneur.getBoundingClientRect();
  const ajuster = () => {
    rect = conteneur.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    const aspect = rect.width / rect.height;
    const iw = image.naturalWidth, ih = image.naturalHeight;
    const ia = iw / ih;
    // Même cadrage que object-fit: cover sur l'image placée dessous. L'axe v de la texture est retourné par OGL.
    const ech = aspect > ia ? [1, ia / aspect] : [aspect / ia, 1];
    finale.program.uniforms.uEch.value = ech;
    finale.program.uniforms.uDec.value = [(1 - ech[0]) / 2, (1 - ech[1]) / 2];
    finale.program.uniforms.uTexel.value = [1 / iw, 1 / ih];
    finale.program.uniforms.uAspect.value = aspect;
    eau.program.uniforms.uAspect.value = aspect;
    demander();
  };

  // Position de la souris : le segment va de la dernière position à la nouvelle.
  const A = [0.5, 0.5], B = [0.5, 0.5];
  let force = 0, dernier = null, sale = true, enCours = false, visible = true, derniereEau = -1e9, t0 = 0;
  let debutArrivee = null;
  const DUREE_ARRIVEE = 2.4;

  const demander = () => { sale = true; if (!enCours && visible) { enCours = true; t0 = 0; requestAnimationFrame(boucle); } };

  function boucle(t) {
    if (!visible) { enCours = false; return; }
    const dt = t0 ? Math.min((t - t0) / 1000, 0.05) : 1 / 60;
    t0 = t;

    if (debutArrivee !== null) {
      const s = Math.max(0, (t - debutArrivee) / 1000);
      const f = finale.program.uniforms;
      if (s >= DUREE_ARRIVEE) { f.uT.value = -1; f.uZoom.value = 1; debutArrivee = null; }
      else { f.uT.value = s; f.uZoom.value = 0.94 + 0.06 * (1 - Math.pow(1 - s / DUREE_ARRIVEE, 3)); }
    }

    const u = eau.program.uniforms;
    u.uDt.value = dt;
    u.uForce.value = force;
    u.uA.value = A; u.uB.value = B;
    u.tPrec.value = lecture.texture;
    renderer.render({ scene: eau, target: ecriture });
    [lecture, ecriture] = [ecriture, lecture];

    finale.program.uniforms.tEau.value = lecture.texture;
    renderer.render({ scene: finale });

    // Le segment a été déposé : on repart de la dernière position.
    A[0] = B[0]; A[1] = B[1];
    force = 0;

    // Après le dernier passage, on continue le temps que tout sèche, puis on s'arrête tout à fait.
    if (t - derniereEau < 4000 || sale) { sale = false; requestAnimationFrame(boucle); } else { enCours = false; }
  }

  const surMouvement = (e) => {
    if (!visible) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) { dernier = null; return; }
    if (!dernier) { A[0] = x; A[1] = y; }
    B[0] = x; B[1] = y;
    force = 1;
    dernier = performance.now();
    derniereEau = dernier;
    demander();
  };

  const observateur = new IntersectionObserver(([entree]) => {
    visible = entree.isIntersecting;
    if (visible) { rect = conteneur.getBoundingClientRect(); demander(); }
  }, { rootMargin: '-2px 0px 0px 0px', threshold: 0 }); // -2 px : une photo qui touche juste le bord de l'écran n'est plus visible
  observateur.observe(conteneur);

  window.addEventListener('pointermove', surMouvement, { passive: true });
  window.addEventListener('resize', ajuster, { passive: true });
  window.addEventListener('scroll', () => { if (visible) rect = conteneur.getBoundingClientRect(); }, { passive: true });

  ajuster();
  // Premier rendu, encore tout noir : la texture est envoyée avant que l'arrivée commence.
  renderer.render({ scene: finale });
  const pret = new Promise((r) => requestAnimationFrame(() => {
    renderer.render({ scene: finale });
    canvas.classList.add('pret');
    r();
  }));
  const demarrer = (direct = false) => {
    if (direct) { finale.program.uniforms.uT.value = -1; finale.program.uniforms.uZoom.value = 1; demander(); return; }
    debutArrivee = performance.now();
    derniereEau = debutArrivee + DUREE_ARRIVEE * 1000 - 4000;
    demander();
  };
  return { pret, demarrer };
}
