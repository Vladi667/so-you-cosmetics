import React, { useEffect, useRef, useState, useCallback } from 'react';
import { imageUrl } from '../services/products';
import useVerrouDefilement from '../hooks/useVerrouDefilement';

const ZOOM_MAX = 3;
const SEUIL_FERMETURE = 110; // px de glissement vers le bas avant de fermer

const borner = (v, min, max) => Math.min(max, Math.max(min, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// La vue plein écran d'une photo de produit.
//
// Sur un site dont l'argument est la matière — le grain d'un savon, la couleur
// d'un hydrolat — on ne pouvait pas approcher : l'image était servie dans son
// cadre, et rien de plus.
//
// Le composant n'est monté que lorsqu'il est ouvert. C'est délibéré : le plan
// avertit qu'une surcouche laissée en place, avec un `pointer-events` ou un
// `transform` mal refermé, rend « Ajouter au panier » inerte alors que la page
// paraît normale. Ici il n'y a rien à refermer — fermée, elle n'existe pas.
const VisionneuseImage = ({ images, indexInitial = 0, alt, onClose }) => {
  const [index, setIndex] = useState(indexInitial);
  const [zoom, setZoom] = useState(1);
  const [decalage, setDecalage] = useState({ x: 0, y: 0 });
  const [glissementFermeture, setGlissementFermeture] = useState(0);
  // Un état, pas une ref : le rendu doit savoir s'il faut animer le transform.
  // Pendant un geste, la moindre transition ferait traîner l'image derrière le
  // doigt ; une fois le doigt levé, c'est elle qui rend le retour souple.
  const [enGeste, setEnGeste] = useState(false);

  const fermerRef = useRef(null);
  const declencheurRef = useRef(null);
  const pointeurs = useRef(new Map());
  const geste = useRef(null);

  useVerrouDefilement(true);

  const total = images.length;

  const aller = useCallback((delta) => {
    setIndex((i) => (i + delta + total) % total);
    setZoom(1);
    setDecalage({ x: 0, y: 0 });
  }, [total]);

  // Clavier : flèches pour parcourir, Échap pour sortir. Le focus part au
  // bouton de fermeture et revient à son point de départ à la sortie.
  useEffect(() => {
    declencheurRef.current = document.activeElement;
    fermerRef.current?.focus();

    const auClavier = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === 'ArrowRight') {
        aller(1);
      } else if (e.key === 'ArrowLeft') {
        aller(-1);
      }
    };
    document.addEventListener('keydown', auClavier);

    return () => {
      document.removeEventListener('keydown', auClavier);
      const cible = declencheurRef.current;
      if (cible && document.contains(cible) && typeof cible.focus === 'function') {
        cible.focus();
      }
    };
  }, [onClose, aller]);

  // La suivante se charge pendant qu'on regarde celle-ci : passer d'une photo
  // à l'autre ne doit pas attendre le réseau.
  useEffect(() => {
    if (total < 2) return;
    const suivante = new Image();
    suivante.src = imageUrl(images[(index + 1) % total], 1600);
  }, [index, images, total]);

  const auPointerDown = (e) => {
    setEnGeste(true);
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // `setPointerCapture` leve si le pointeur n'est plus actif — un doigt deja
    // relache, un evenement rejoue. Sans cette garde, l'exception interrompt le
    // gestionnaire AVANT l'enregistrement du geste, et le pincement ne repond
    // plus du tout.
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointeur parti */ }

    if (pointeurs.current.size === 2) {
      const [a, b] = [...pointeurs.current.values()];
      geste.current = { type: 'pince', depart: distance(a, b), zoomDepart: zoom };
    } else if (pointeurs.current.size === 1) {
      geste.current = {
        type: zoom > 1 ? 'deplacement' : 'fermeture',
        x: e.clientX,
        y: e.clientY,
        decalageDepart: { ...decalage },
      };
    }
  };

  const auPointerMove = (e) => {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = geste.current;
    if (!g) return;

    if (g.type === 'pince' && pointeurs.current.size === 2) {
      const [a, b] = [...pointeurs.current.values()];
      const rapport = distance(a, b) / (g.depart || 1);
      setZoom(borner(g.zoomDepart * rapport, 1, ZOOM_MAX));
    } else if (g.type === 'deplacement') {
      setDecalage({
        x: g.decalageDepart.x + (e.clientX - g.x),
        y: g.decalageDepart.y + (e.clientY - g.y),
      });
    } else if (g.type === 'fermeture') {
      // Seul le glissement vers le bas ferme. Vers le haut on résiste : le
      // geste n'a pas de suite, autant le dire au doigt tout de suite.
      const dy = e.clientY - g.y;
      // La distance est retenue DANS le geste, pas seulement dans l'état.
      // C'est elle qui décidera de fermer : l'état n'est appliqué qu'au rendu
      // suivant, et une salve de mouvements suivie d'un relâchement dans le
      // même tour de boucle laisserait la décision se prendre sur zéro.
      g.parcouru = dy;
      setGlissementFermeture(dy > 0 ? dy : dy / 4);
    }
  };

  const auPointerUp = (e) => {
    pointeurs.current.delete(e.pointerId);
    if (pointeurs.current.size === 0) setEnGeste(false);
    const g = geste.current;

    if (g && g.type === 'fermeture') {
      if ((g.parcouru || 0) > SEUIL_FERMETURE) {
        onClose();
        return;
      }
      setGlissementFermeture(0);
    }

    // Un doigt levé pendant un pincement : on repart d'un geste neuf plutôt que
    // de poursuivre avec une distance de référence devenue fausse.
    geste.current = pointeurs.current.size === 1
      ? {
          type: zoom > 1 ? 'deplacement' : 'fermeture',
          x: e.clientX,
          y: e.clientY,
          decalageDepart: { ...decalage },
        }
      : null;
  };

  const basculerZoom = () => {
    if (zoom > 1) {
      setZoom(1);
      setDecalage({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  };

  const opacite = borner(1 - Math.max(0, glissementFermeture) / (SEUIL_FERMETURE * 2.4), 0.25, 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[120] flex flex-col bg-slate-stone/95 backdrop-blur-sm"
      style={{ opacity: opacite }}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white/80">
        <span className="font-sans text-xs tracking-widest">
          {total > 1 ? `${index + 1} / ${total}` : ''}
        </span>
        <button
          ref={fermerRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="press flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* `touch-action: none` est posé ICI et nulle part ailleurs : sur cet
          élément seul, qui disparaît avec le composant. Le poser plus haut
          laisserait la page sans défilement tactile après la fermeture. */}
      <div
        className="min-h-0 flex-1 select-none overflow-hidden"
        style={{ touchAction: 'none', cursor: zoom > 1 ? 'grab' : 'zoom-in' }}
        onPointerDown={auPointerDown}
        onPointerMove={auPointerMove}
        onPointerUp={auPointerUp}
        onPointerCancel={auPointerUp}
        onDoubleClick={basculerZoom}
      >
        <img
          src={imageUrl(images[index], 1600)}
          alt={alt}
          draggable={false}
          className="h-full w-full object-contain"
          style={{
            transform: `translate3d(${decalage.x}px, ${decalage.y + Math.max(0, glissementFermeture)}px, 0) scale(${zoom})`,
            transition: enGeste ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>

      {total > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-2 px-4 py-4">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setIndex(i); setZoom(1); setDecalage({ x: 0, y: 0 }); }}
              aria-label={`Image ${i + 1} sur ${total}`}
              aria-current={i === index}
              className={`press h-12 w-10 overflow-hidden rounded-lg border-2 ${
                i === index ? 'border-white' : 'border-transparent opacity-50'
              }`}
            >
              <img src={imageUrl(img, 200)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VisionneuseImage;
