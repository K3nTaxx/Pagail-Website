// Version téléphone : portrait jusqu'à 900 px de large, ou téléphone tenu à l'horizontale.
// La même requête est écrite dans styles/telephone.css et dans les <source> de index.html.
const requete = matchMedia('(max-width: 900px), (pointer: coarse) and (max-height: 500px)');
export const telephone = requete.matches;

// Une fenêtre d'ordinateur qui passe le seuil recharge la page : styles et comportements restent d'accord.
requete.addEventListener('change', () => location.reload());
