import React, { useMemo } from 'react';

// L'habillage saisonnier : une couche mince par-dessus le bandeau d'accueil.
//
// Le principe qu'elle a demandé, et qui vaut règle : le site ne change pas de
// peau. On n'ajoute que ce qui tombe dans l'air, un petit végétal dans l'angle,
// et une couleur d'accent. La mise en page, la typographie, les prix et les
// photos produits ne bougent pas d'un pixel.
//
// Le bandeau est une vidéo du Léman à l'aube : ciel pâle en haut, rocaille
// sombre en bas. C'est ce dégradé qui décide de tout — une particule claire s'y
// voit en bas et disparaît en haut, une particule sombre fait l'inverse. D'où
// la neige blanche à ombre portée, et la lavande violette pour l'été.

export const SAISONS = ['aucune', 'hiver', 'printemps', 'ete', 'automne'];

// Les couleurs d'accent, une par saison. Elles restent dans la famille minérale
// du site — aucune ne vient d'ailleurs.
export const ACCENTS = {
  hiver: '#8C9AA0',      // minéral froid
  printemps: '#9FAE86',  // la sauge du site, à sa saison
  ete: '#C08A6A',        // terre cuite claire
  automne: '#A8825C',    // travertin profond
};

// Un flocon à six branches, avec ses ramifications. Un disque blanc aurait
// suffi à dix pixels ; à trente, il aurait trahi la facilité.
const flocon = (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <g stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <g key={a} transform={`rotate(${a} 50 50)`}>
          <path d="M50 50 L50 10" />
          <path d="M50 22 L41 13 M50 22 L59 13" />
          <path d="M50 33 L43 26 M50 33 L57 26" />
          <path d="M50 10 L45 16 M50 10 L55 16" />
        </g>
      ))}
    </g>
  </svg>
);

const petale = (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <g fill="#E9BFCB" stroke="#DCA6B6" strokeWidth="2">
      <path d="M50 6 Q74 26 50 50 Q26 26 50 6 Z" />
      <path d="M92 34 Q80 62 50 50 Q64 22 92 34 Z" />
      <path d="M76 88 Q46 92 50 50 Q80 58 76 88 Z" />
      <path d="M24 88 Q20 58 50 50 Q54 92 24 88 Z" />
      <path d="M8 34 Q36 22 50 50 Q20 62 8 34 Z" />
    </g>
    <circle cx="50" cy="50" r="6" fill="#CE8FA4" />
  </svg>
);

// Trois teintes de feuille : un tapis d'une seule couleur se lit comme un motif
// imprimé, pas comme de l'automne.
const TEINTES = [
  { chair: '#C08A4E', bord: '#9A6A36', nerv: '#8A5E2E' },
  { chair: '#B4623A', bord: '#8C4926', nerv: '#7E3F20' },
  { chair: '#A98A3D', bord: '#84682B', nerv: '#756025' },
];

const feuille = (i) => {
  const t = TEINTES[i % TEINTES.length];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 4 C82 26 88 62 62 94 C36 74 24 38 50 4 Z"
        fill={t.chair} stroke={t.bord} strokeWidth="2" strokeLinejoin="round"
      />
      <g stroke={t.nerv} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".8">
        <path d="M50 8 C56 40 60 68 62 92" />
        <path d="M52 26 L36 30 M54 42 L38 48 M57 58 L42 66" />
        <path d="M52 26 L68 24 M54 42 L72 42" />
      </g>
    </svg>
  );
};

// Un fleuron de lavande, à quatre lobes.
//
// L'été a d'abord été fait de poussières dorées montant dans un rai de soleil.
// L'idée tenait sur le papier et ne se voyait pas à l'écran : le bandeau est
// une aube dorée sur le Léman, et du doré pâle sur du doré pâle n'existe pas.
// Ce qui manquait n'était pas un réglage mais du contraste — donc une matière
// plus sombre que le ciel.
//
// La lavande s'imposait : elle est déjà dans la photo du bandeau, en bottes au
// premier plan, et c'est ce qu'elle vend en juillet.
const lavande = (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <g fill="#7A64A0" stroke="#57457C" strokeWidth="3" strokeLinejoin="round">
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M50 12 Q68 31 50 50 Q32 31 50 12 Z" transform={`rotate(${a} 50 50)`} />
      ))}
    </g>
    <circle cx="50" cy="50" r="7" fill="#4C3A6E" />
  </svg>
);

const SPRITE = {
  hiver: () => flocon,
  printemps: () => petale,
  ete: () => lavande,
  automne: (i) => feuille(i),
};

// Positions fixes plutôt que tirées au hasard : le rendu serveur et le premier
// rendu du navigateur doivent produire exactement le même balisage, sans quoi
// React signale une divergence à l'hydratation.
const GRAINS = [
  { x: 4,  t: 26, d: 15, r: 0 },
  { x: 12, t: 15, d: 21, r: 6 },
  { x: 20, t: 21, d: 18, r: 12 },
  { x: 28, t: 13, d: 24, r: 3 },
  { x: 36, t: 28, d: 14, r: 9 },
  { x: 44, t: 14, d: 22, r: 16 },
  { x: 51, t: 19, d: 19, r: 2 },
  { x: 58, t: 12, d: 25, r: 11 },
  { x: 65, t: 24, d: 16, r: 5 },
  { x: 72, t: 16, d: 23, r: 18 },
  { x: 79, t: 20, d: 17, r: 8 },
  { x: 86, t: 13, d: 26, r: 1 },
  { x: 93, t: 23, d: 15, r: 14 },
  { x: 16, t: 11, d: 28, r: 21 },
  { x: 48, t: 25, d: 20, r: 24 },
  { x: 83, t: 17, d: 21, r: 27 },
];

// Le petit végétal de l'angle. Tracé en ivoire par-dessus la vidéo sombre —
// une illustration colorée s'y perdrait.
const VEGETAL = {
  hiver: (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M110 8 C92 34 72 60 44 88" strokeWidth="1.9" />
      <g strokeWidth="1.15">
        <path d="M102 19 L112 25 M102 19 L94 11" />
        <path d="M93 31 L104 37 M93 31 L85 23" />
        <path d="M84 43 L95 49 M84 43 L76 35" />
        <path d="M75 55 L86 61 M75 55 L67 47" />
        <path d="M66 67 L77 73 M66 67 L58 59" />
        <path d="M56 78 L67 84 M56 78 L48 70" />
      </g>
      <g strokeWidth="1.4" transform="translate(22,74) scale(0.34)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d="M50 50 Q43 30 50 16 Q57 30 50 50 Z" transform={`rotate(${a} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="4.5" />
      </g>
    </g>
  ),
  printemps: (
    <g fill="none" stroke="currentColor">
      <g strokeWidth="1.7" strokeLinecap="round">
        <path d="M114 12 C92 34 70 54 42 78 M84 40 C78 56 76 70 76 84" />
      </g>
      <g strokeWidth="1.4">
        {[[102, 24, 1.25], [76, 86, 1], [60, 60, 0.82]].map(([x, y, s]) => (
          <g key={`${x}-${y}`} transform={`translate(${x},${y}) scale(${s})`}>
            <path d="M0 -10 Q5.5 -5.5 0 0 Q-5.5 -5.5 0 -10 Z" />
            <path d="M9.5 -3.1 Q6.4 3.3 0 0 Q3.1 -6.9 9.5 -3.1 Z" />
            <path d="M5.9 8.1 Q-1.3 8.7 0 0 Q7.3 2.2 5.9 8.1 Z" />
            <path d="M-5.9 8.1 Q-7.3 2.2 0 0 Q1.3 8.7 -5.9 8.1 Z" />
            <path d="M-9.5 -3.1 Q-3.1 -6.9 0 0 Q-6.4 3.3 -9.5 -3.1 Z" />
          </g>
        ))}
      </g>
    </g>
  ),
  ete: (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <g strokeWidth="1.6">
        <path d="M26 114 C42 84 58 56 76 26" />
        <path d="M44 106 C58 80 70 56 84 30" />
      </g>
      <g fill="currentColor" stroke="none" opacity=".9">
        <ellipse cx="76" cy="24" rx="3.4" ry="5.8" />
        <ellipse cx="69" cy="38" rx="3.2" ry="5.4" />
        <ellipse cx="81" cy="38" rx="2.8" ry="4.8" />
        <ellipse cx="62" cy="52" rx="3" ry="5.2" />
        <ellipse cx="74" cy="52" rx="2.6" ry="4.4" />
        <ellipse cx="55" cy="66" rx="2.7" ry="4.6" />
        <ellipse cx="67" cy="66" rx="2.3" ry="4" />
        <ellipse cx="85" cy="20" rx="2.6" ry="4.4" />
      </g>
      <g strokeWidth="1.5">
        <path d="M96 96 C86 88 84 74 94 66 C104 74 104 88 96 96 Z" />
        <path d="M96 96 L96 108" />
      </g>
    </g>
  ),
  automne: (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M110 12 C94 26 82 44 78 64 C74 84 80 100 96 110 C108 96 114 76 114 54 C114 34 112 20 110 12 Z" strokeWidth="1.8" />
      <path d="M110 12 C105 38 100 68 96 110" strokeWidth="1.2" />
      <g strokeWidth="1" opacity=".8">
        <path d="M107 30 L92 38 M105 46 L88 54 M103 62 L86 72 M100 78 L86 90" />
        <path d="M107 30 L116 38 M105 46 L113 56 M103 62 L110 74" />
      </g>
      <g fill="currentColor" stroke="none" opacity=".85" transform="translate(32,92)">
        <ellipse cx="0" cy="0" rx="6" ry="4" transform="rotate(-24)" />
        <ellipse cx="15" cy="8" rx="4.8" ry="3.2" transform="rotate(14 15 8)" />
        <ellipse cx="-11" cy="10" rx="4.2" ry="2.8" transform="rotate(-48 -11 10)" />
      </g>
    </g>
  ),
};

const Saison = ({ saison }) => {
  const active = SAISONS.includes(saison) && saison !== 'aucune' ? saison : null;

  const grains = useMemo(() => {
    if (!active) return [];
    // L'été monte au lieu de tomber, et ses poussières sont plus petites.
    const facteur = active === 'ete' ? 1 : active === 'automne' ? 1.45 : 1;
    return GRAINS.map((g, i) => {
      const loin = i % 3 === 0;
      const taille = Math.round(g.t * facteur * (loin ? 1.35 : 1));
      return {
        cle: i,
        loin,
        style: {
          left: `${g.x}%`,
          width: `${taille}px`,
          height: `${taille}px`,
          opacity: loin ? 0.42 : 0.88,
          filter: loin ? 'blur(1.4px)' : undefined,
          animationDuration: `${g.d}s`,
          animationDelay: `${g.r}s`,
        },
        contenu: SPRITE[active](i),
      };
    });
  }, [active]);

  if (!active) return null;

  return (
    <div className="saison" data-saison={active} aria-hidden="true">
      <div className="saison-grains">
        {grains.map((g) => (
          <span key={g.cle} className={`saison-grain${g.loin ? ' loin' : ''}`} style={g.style}>
            {g.contenu}
          </span>
        ))}
      </div>

      <svg className="saison-vegetal" viewBox="0 0 120 120" aria-hidden="true">
        {VEGETAL[active]}
      </svg>
    </div>
  );
};

export default Saison;
