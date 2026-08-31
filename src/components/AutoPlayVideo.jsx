import React, { useRef, useEffect, useState } from 'react';

/**
 * AutoPlayVideo — a wrapper that guarantees video playback on all devices.
 *
 * Uses IntersectionObserver to trigger play() when visible.
 * If the browser rejects autoplay (iOS Low Power Mode, etc.),
 * shows a subtle tap-to-play overlay so the user can start it
 * with a gesture (which always succeeds).
 */
// Ce que le visiteur a demandé sans le dire.
//
// « Économiseur de données » est un réglage explicite du navigateur ; le
// mouvement réduit en est un du système. Dans les deux cas, télécharger deux à
// trois mégaoctets de vidéo décorative va contre ce qui a été demandé. L'affiche
// reste affichée et le bouton de lecture permet d'en décider autrement.
function lectureNonSouhaitee() {
  if (typeof window === 'undefined') return false;
  try {
    const connexion = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connexion && connexion.saveData) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// `preload` par defaut a « metadata » : la page d'accueil telechargeait 3,84 Mo
// de video avant le moindre defilement, dont 1,55 Mo pour un bloc situe bien
// plus bas que l'ecran. L'attribut `autoPlay` a disparu pour la meme raison —
// il declenche le telechargement des que l'element existe, quelle que soit la
// valeur de `preload`. C'est l'observateur ci-dessous qui lance la lecture, et
// il ne tire que lorsque la video entre dans le champ.
const AutoPlayVideo = ({ src, className = '', poster = '', preload = 'metadata' }) => {
  const videoRef = useRef(null);
  // Lu une fois, a l'initialisation : le reglage ne change pas en cours de
  // visite, et le poser ici plutot que dans l'effet evite un rendu en cascade —
  // l'effet n'aurait servi qu'a redire ce qu'on savait deja avant de peindre.
  const [refusAutoplay] = useState(lectureNonSouhaitee);
  const [needsTap, setNeedsTap] = useState(refusAutoplay);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || refusAutoplay) return;

    let retryCount = 0;
    const maxRetries = 3;
    let minuterie = null;

    const attemptPlay = () => {
      if (hasPlayed) return;

      // Ensure muted is set before playing
      video.muted = true;

      // Appel direct : play() declenche lui-meme le chargement, y compris avec
      // preload="none". L'ancien code n'appelait play() qu'a partir de
      // readyState >= 2 et attendait « canplay » sinon — un evenement qui,
      // sans preload, n'arrive jamais puisque rien n'a ete demande.
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setHasPlayed(true);
            setNeedsTap(false);
          })
          .catch(() => {
            // iOS en mode economie d'energie, onglet en arriere-plan, politique
            // du navigateur : on reessaie trois fois, puis on propose la
            // lecture au doigt, qui elle n'echoue jamais.
            if (retryCount < maxRetries) {
              retryCount++;
              minuterie = setTimeout(attemptPlay, 1000);
            } else {
              setNeedsTap(true);
            }
          });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            attemptPlay();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(video);

    // La meme question, posee autrement : cet element est-il dans le champ ?
    //
    // L'ancienne version lancait une tentative sans condition — c'est elle qui
    // faisait telecharger la video du bas de page en meme temps que celle du
    // haut. Mais s'en remettre au seul observateur ne suffit pas : il ne tire
    // pas dans un onglet qui ne compose rien, et la video restait alors sur son
    // affiche sans que rien ne l'explique. Constate en verifiant precisement
    // cela, sur les deux videos.
    //
    // Mesurer le rectangle ne depend d'aucun ordonnancement. L'observateur
    // reste : il est plus economique et repond le premier dans le cas normal.
    // Celui-ci est le filet, et il se retire des que la lecture a commence.
    const dansLeChamp = () => {
      const rect = video.getBoundingClientRect();
      return rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
    };

    let planifie = false;
    const auDefilement = () => {
      if (planifie) return;
      planifie = true;
      requestAnimationFrame(() => {
        planifie = false;
        if (dansLeChamp()) attemptPlay();
      });
    };

    if (dansLeChamp()) attemptPlay();
    window.addEventListener('scroll', auDefilement, { passive: true });
    window.addEventListener('resize', auDefilement, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', auDefilement);
      window.removeEventListener('resize', auDefilement);
      if (minuterie) clearTimeout(minuterie);
    };
  }, [hasPlayed, refusAutoplay]);

  const handleTap = () => {
    const video = videoRef.current;
    if (!video) return;

    video.play().then(() => {
      setHasPlayed(true);
      setNeedsTap(false);
    }).catch(() => {
      video.muted = true;
      video.play().then(() => {
        setHasPlayed(true);
        setNeedsTap(false);
      });
    });
  };

  return (
    <div className="absolute inset-0 bg-slate-stone/10">
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        preload={preload}
        poster={poster}
        className={className}
        style={{ pointerEvents: 'none' }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Tap-to-play overlay — appears only when autoplay is blocked */}
      {needsTap && (
        <button
          onClick={handleTap}
          className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer bg-transparent"
          aria-label="Tap to play video"
        >
          <div className="relative flex items-center justify-center">
            {/* Pulse ring */}
            <div className="absolute w-20 h-20 rounded-full border border-white/30 animate-ping" />
            {/* Play icon */}
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl">
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}
    </div>
  );
};

export default AutoPlayVideo;
