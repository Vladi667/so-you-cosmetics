import React, { useRef, useEffect, useState } from 'react';

/**
 * AutoPlayVideo — a wrapper that guarantees video playback on all devices.
 *
 * Uses IntersectionObserver to trigger play() when visible.
 * If the browser rejects autoplay (iOS Low Power Mode, etc.),
 * shows a subtle tap-to-play overlay so the user can start it
 * with a gesture (which always succeeds).
 */
const AutoPlayVideo = ({ src, className = '', poster = '' }) => {
  const videoRef = useRef(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let retryCount = 0;
    const maxRetries = 3;

    const attemptPlay = () => {
      if (hasPlayed) return;

      // Ensure muted is set before playing
      video.muted = true;

      if (video.readyState >= 2) {
        // Small delay helps iOS Safari in some cases
        setTimeout(() => {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setHasPlayed(true);
                setNeedsTap(false);
              })
              .catch((error) => {
                console.log(`Autoplay attempt ${retryCount + 1} failed:`, error);
                if (retryCount < maxRetries) {
                  retryCount++;
                  setTimeout(attemptPlay, 1000); // Wait 1s and try again
                } else {
                  setNeedsTap(true);
                }
              });
          }
        }, 150);
      } else {
        video.addEventListener('canplay', attemptPlay, { once: true });
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

    // Initial attempt
    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      video.addEventListener('canplay', attemptPlay, { once: true });
    }

    return () => {
      observer.disconnect();
      video.removeEventListener('canplay', attemptPlay);
    };
  }, [hasPlayed]);

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
    <div className="absolute inset-0 bg-slate-900/10">
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        preload="auto"
        poster={poster}
        className={`${className} transition-opacity duration-1000 ${hasPlayed ? 'opacity-100' : 'opacity-0'}`}
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
