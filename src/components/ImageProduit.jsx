import React, { useEffect, useRef, useState } from 'react';
import { imageUrl } from '../services/products';

const DUREE_FONDU = 320;

// La grande image de la fiche, qui change sans jamais laisser un cadre vide.
//
// Changer de vignette remplaçait le `src` : le navigateur vidait le cadre, puis
// le remplissait quand l'image arrivait. Sur une photo de 1600 px, cela fait un
// trou blanc au milieu de la fiche, à l'endroit exact qu'on regarde.
//
// Ici la nouvelle image est décodée AVANT d'être montrée, et l'ancienne ne part
// qu'ensuite, en fondu. Au plus deux images coexistent : l'affichée et la
// sortante. Le nettoyage est garanti même si le décodage échoue — sans quoi une
// image morte empilerait un élément de plus à chaque changement de vignette.
const ImageProduit = ({ src, alt, largeur = 1600, className = '', onClick, eager = false }) => {
  const [affichee, setAffichee] = useState(src);
  const [sortante, setSortante] = useState(null);
  const minuterieRef = useRef(null);

  useEffect(() => {
    if (src === affichee) return undefined;

    let actif = true;
    const image = new Image();
    image.src = imageUrl(src, largeur);

    // `decode()` n'existe pas partout, et rejette sur une image en erreur. Les
    // deux cas passent par le même `finally` : on montre la nouvelle de toute
    // façon, quitte à ce qu'elle affiche l'icône d'image cassée. Rester bloqué
    // sur l'ancienne serait mentir sur ce qu'on regarde.
    const promesse = typeof image.decode === 'function'
      ? image.decode()
      : new Promise((res, rej) => { image.onload = res; image.onerror = rej; });

    promesse.catch(() => {}).finally(() => {
      if (!actif) return;
      setSortante(affichee);
      setAffichee(src);
      clearTimeout(minuterieRef.current);
      minuterieRef.current = setTimeout(() => { if (actif) setSortante(null); }, DUREE_FONDU);
    });

    return () => { actif = false; };
  }, [src, affichee, largeur]);

  // Au démontage : la minuterie du fondu ne doit pas écrire dans un composant
  // parti, et rien ne doit rester monté.
  useEffect(() => () => clearTimeout(minuterieRef.current), []);

  return (
    <>
      <img
        src={imageUrl(affichee, largeur)}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        onClick={onClick}
        className={className}
      />
      {sortante && sortante !== affichee && (
        <img
          src={imageUrl(sortante, largeur)}
          alt=""
          aria-hidden="true"
          className={`${className} pointer-events-none absolute inset-0 animate-[fondreVersRien_320ms_ease-out_forwards]`}
        />
      )}
    </>
  );
};

export default ImageProduit;
