// Les pages prestations : mêmes barre, menu, pied de page et langage d'animation que l'accueil.
import { telephone } from './modules/appareil.js';
import { $, $$, racine, liensInternes, charger, prechargeur, piedDePage, arrivee } from './modules/commun.js';
import { creerMenu } from './modules/menu.js';
import { mentions, barresTelephone, visionneuse, preparerNette, maintenir } from './modules/fenetres.js';

liensInternes();
piedDePage();
creerMenu();
mentions();

// Pas d'ouverture ici : la barre est là tout de suite, la grande photo part en premier.
$('.barre').style.visibility = 'visible';
racine.dataset.arrive = '';
if (telephone) {
  $('#appel').classList.remove('appel-cachee');
  barresTelephone(['.svc-appel', '.pied']);
}
const photo = $('.svc-photo img');
if (photo) charger(photo);
$$('[data-section]').forEach((s) => { prechargeur.observe(s); arrivee.observe(s); });

// Galerie : chaque vignette ouvre la visionneuse sur toute la série.
const ouvrir = visionneuse();
$$('.svc-grille').forEach((grille) => {
  const boutons = $$('.svc-vignette', grille);
  const chantier = {
    titre: grille.dataset.titre,
    photos: boutons.map((b) => ({ id: b.dataset.id, alt: b.querySelector('img').alt })),
  };
  boutons.forEach((b) => {
    b.addEventListener('pointerenter', () => preparerNette(b.dataset.id));
    b.addEventListener('click', () => ouvrir(chantier, Number(b.dataset.indice), b));
  });
});

// Avant, après : maintenir pour voir l'avant.
$$('[data-maintien]').forEach((section) => {
  const bouton = $('.svc-maintenir', section);
  maintenir({
    section, photos: $('.svc-maintien-photos', section), bouton,
    changer: (tenu) => { bouton.textContent = tenu ? 'Relâcher pour voir l’après' : 'Maintenir pour voir l’avant'; },
  });
});
