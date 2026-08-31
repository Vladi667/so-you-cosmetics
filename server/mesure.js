// La mesure d'audience et la propriété Search Console, par réglage.
//
// Le site n'en avait aucune : ni marqueur, ni gestionnaire de balises, ni
// vérification Search Console ou Bing. La boutique a ouvert au public le
// 27 août 2026 sans pouvoir compter une seule visite de recherche — et tant
// qu'une propriété Search Console n'existe pas, tout ce qu'on peut dire de ce
// que Google rend réellement reste une déduction.
//
// Ce module ne choisit rien à la place de la propriétaire : les comptes se
// créent chez Google et chez Plausible, et eux seuls donnent les identifiants
// ci-dessous. Il rend simplement l'ajout possible sans toucher au code, et
// surtout sans le piège que serait un marqueur silencieusement bloqué.
//
//   PLAUSIBLE_DOMAIN=soyoucosmetics.com     mesure sans cookie (recommandé)
//   GA4_ID=G-XXXXXXXXXX                     Google Analytics 4
//   GOOGLE_SITE_VERIFICATION=…              la valeur du <meta> de Search Console
//   BING_SITE_VERIFICATION=…                idem pour Bing Webmaster Tools
//
// Le piège, justement : la politique de sécurité de contenu n'autorise que
// 'self', un nonce, et gateway.sumup.com. Un marqueur ajouté à index.html sans
// toucher à cet en-tête serait refusé par le navigateur, sans erreur visible
// sur la page — on croirait mesurer, et on ne mesurerait rien. Les origines
// nécessaires sont donc dérivées des mêmes réglages, et n'apparaissent dans la
// politique que si la mesure est réellement activée.

function reglages(env = process.env) {
  const plausible = (env.PLAUSIBLE_DOMAIN || '').trim();
  const ga4 = (env.GA4_ID || '').trim();
  return {
    plausible: /^[a-z0-9.-]+$/i.test(plausible) ? plausible : '',
    // Le format est vérifié : une valeur mal recopiée produirait une balise
    // muette qu'on mettrait des semaines à soupçonner.
    ga4: /^G-[A-Z0-9]+$/i.test(ga4) ? ga4 : '',
    verifGoogle: (env.GOOGLE_SITE_VERIFICATION || '').trim(),
    verifBing: (env.BING_SITE_VERIFICATION || '').trim(),
  };
}

// Les origines à ajouter à la politique de contenu, et rien de plus.
//
// Plausible sert son script depuis plausible.io et y renvoie ses mesures ;
// GA4 charge depuis googletagmanager.com et écrit vers deux domaines Google.
// Aucune de ces origines n'est ouverte tant que le réglage correspondant est
// vide : une politique se resserre par défaut, elle ne s'élargit qu'à la
// demande.
function originesCsp(env = process.env) {
  const r = reglages(env);
  const script = [];
  const connect = [];
  const img = [];
  if (r.plausible) {
    script.push('https://plausible.io');
    connect.push('https://plausible.io');
  }
  if (r.ga4) {
    script.push('https://www.googletagmanager.com');
    connect.push('https://www.google-analytics.com', 'https://*.analytics.google.com');
    img.push('https://www.google-analytics.com');
  }
  return { script, connect, img };
}

function echapper(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Les balises à poser dans le <head>.
//
// Le nonce est celui de la requête : c'est ce qui autorise le seul script en
// ligne, celui de GA4. Plausible n'en a pas besoin — son script est externe et
// « defer », donc il ne retarde rien.
function balises(nonce, env = process.env) {
  const r = reglages(env);
  const out = [];

  if (r.verifGoogle) {
    out.push(`<meta name="google-site-verification" content="${echapper(r.verifGoogle)}">`);
  }
  if (r.verifBing) {
    out.push(`<meta name="msvalidate.01" content="${echapper(r.verifBing)}">`);
  }

  if (r.plausible) {
    out.push(
      `<script defer data-domain="${echapper(r.plausible)}" src="https://plausible.io/js/script.js"></script>`
    );
  }

  if (r.ga4) {
    const id = echapper(r.ga4);
    out.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>` +
      `<script nonce="${nonce}">window.dataLayer=window.dataLayer||[];` +
      `function gtag(){dataLayer.push(arguments);}gtag('js',new Date());` +
      // « anonymize_ip » et le refus des signaux publicitaires : la boutique
      // n'affiche aucune bannière de consentement, et la nLPD comme le RGPD
      // demandent alors de s'en tenir à la mesure strictement nécessaire.
      `gtag('config','${id}',{anonymize_ip:true,allow_google_signals:false});</script>`
    );
  }

  return out.join('');
}

// Ce que le journal doit dire au démarrage, une fois.
//
// Un site qui croit mesurer et ne mesure pas est pire qu'un site qui sait qu'il
// ne mesure rien : personne ne va vérifier ce qu'on pense avoir réglé.
function resume(env = process.env) {
  const r = reglages(env);
  const actifs = [];
  if (r.plausible) actifs.push(`Plausible (${r.plausible})`);
  if (r.ga4) actifs.push(`GA4 (${r.ga4})`);
  if (r.verifGoogle) actifs.push('Search Console');
  if (r.verifBing) actifs.push('Bing');
  return actifs.length
    ? `  Mesure : ${actifs.join(', ')}`
    : '  Mesure : aucune. Poser PLAUSIBLE_DOMAIN ou GA4_ID, et GOOGLE_SITE_VERIFICATION.';
}

module.exports = { reglages, originesCsp, balises, resume };
