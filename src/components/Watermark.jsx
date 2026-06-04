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

const TEXT = 'To Be Paid';

// A single repeating SVG tile containing the rotated text. Big font + compact
// tile => large, dense, hard-to-ignore marks. High opacity + red => loud.
const W = 460;
const H = 260;
const tile = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>` +
    `<text x='50%' y='50%' transform='rotate(-30 ${W / 2} ${H / 2})' ` +
    `font-family='Arial, Helvetica, sans-serif' font-size='72' font-weight='800' ` +
    `letter-spacing='2' fill='%23d61f1f' fill-opacity='0.6' ` +
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
