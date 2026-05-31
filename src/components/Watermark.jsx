import React from 'react';

// ───────────────────────────────────────────────────────────────────────────
// TEMPORARY "TBA" WATERMARK — shown across the whole site until the client pays.
//
// HOW TO REMOVE LATER:
//   1. Delete the <Watermark /> line in src/App.jsx (and its import).
//   2. Delete this file.
// That's it — nothing else references it.
//
// It is a fixed, full-viewport overlay with pointer-events disabled, so it sits
// on top of everything visually but never blocks clicks, typing or scrolling.
// ───────────────────────────────────────────────────────────────────────────

const TEXT = 'TBA';

// A single repeating SVG tile containing the rotated, semi-transparent text.
// Larger tile => fewer, more spread-out marks; smaller font => smaller marks.
const SIZE = 340;
const CENTER = SIZE / 2;
const tile = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${SIZE}' height='${SIZE}'>` +
    `<text x='50%' y='50%' transform='rotate(-30 ${CENTER} ${CENTER})' ` +
    `font-family='Arial, Helvetica, sans-serif' font-size='36' font-weight='700' ` +
    `letter-spacing='4' fill='%23000000' fill-opacity='0.22' ` +
    `text-anchor='middle' dominant-baseline='middle'>${TEXT}</text>` +
  `</svg>`
);

const Watermark = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2147483647, // above navbar, drawers, modals and the loader
      pointerEvents: 'none',
      backgroundImage: `url("data:image/svg+xml,${tile}")`,
      backgroundRepeat: 'repeat',
      backgroundPosition: 'center',
    }}
  />
);

export default Watermark;
