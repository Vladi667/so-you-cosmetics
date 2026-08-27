// La langue vit dans l'adresse.
//
// Elle vivait jusqu'ici dans localStorage : les trois langues se partageaient
// une seule URL par page. Un moteur ne peut alors indexer qu'une version — la
// sienne, celle que son navigateur d'exploration rend — et il n'existe aucune
// adresse anglaise ou allemande à faire remonter. Les deux tiers du site
// étaient invisibles, et aucune balise hreflang n'était même possible : elle
// désigne des URL, et il n'y en avait qu'une.
//
// Le français reste à la racine, sans préfixe.
//
// C'est le choix le moins coûteux et le plus honnête. Aucune adresse existante
// ne change — ni celles déjà déposées au plan du site, ni celles qu'elle a pu
// envoyer par message — donc aucune redirection à maintenir et aucun lien
// rompu. Et c'est le marché principal : la boutique est à Genève, sa clientèle
// écrit en français, et ce sont ces pages-là qui méritent l'adresse la plus
// courte.
export const LANGUE_DEFAUT = 'fr';
export const LANGUES_PREFIXEES = ['en', 'de'];
export const LANGUES = [LANGUE_DEFAUT, ...LANGUES_PREFIXEES];

// Sépare le préfixe de langue du reste du chemin.
//
//   /en/about        → { langue: 'en', chemin: '/about' }
//   /about           → { langue: 'fr', chemin: '/about' }
//   /de              → { langue: 'de', chemin: '/' }
//   /deodorant       → { langue: 'fr', chemin: '/deodorant' }   ← pas un préfixe
export function separerLangue(pathname) {
  const chemin = String(pathname || '/');
  for (const langue of LANGUES_PREFIXEES) {
    // La barre oblique qui suit est ce qui distingue le préfixe « /de » d'une
    // page dont le nom commence par ces deux lettres.
    if (chemin === `/${langue}`) return { langue, chemin: '/' };
    if (chemin.startsWith(`/${langue}/`)) return { langue, chemin: chemin.slice(langue.length + 1) };
  }
  return { langue: LANGUE_DEFAUT, chemin };
}

// L'adresse d'un chemin dans une langue donnée.
//
//   avecLangue('/about', 'en') → '/en/about'
//   avecLangue('/about', 'fr') → '/about'
export function avecLangue(chemin, langue) {
  const nu = separerLangue(chemin).chemin;
  if (!LANGUES_PREFIXEES.includes(langue)) return nu;
  return nu === '/' ? `/${langue}` : `/${langue}${nu}`;
}

// Toutes les versions d'un chemin, pour les balises hreflang et le plan du site.
export function alternatives(chemin, base = '') {
  const nu = separerLangue(chemin).chemin;
  return LANGUES.map((langue) => ({
    langue,
    href: `${base}${avecLangue(nu, langue)}`,
  }));
}
