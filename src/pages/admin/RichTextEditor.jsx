import React, { useRef, useEffect } from 'react';

// A small formatting editor for product and workshop descriptions.
//
// She asked for this directly: "éviter d'avoir à saisir du code HTML (<p>,
// &nbsp;, etc.)" and "j'ai rédigé plusieurs paragraphes distincts, mais une fois
// publié, tout le texte est fusionné en un seul bloc". Both come from the same
// place — the admin gave her a plain textarea, so paragraphs only survived if
// she typed the tags herself.
//
// Built on document.execCommand. It is deprecated and it is also the only API
// that every browser implements for this, with undo and selection handling for
// free. Replacing it means shipping an editor framework for six buttons; the
// day it stops working, the descriptions are still ordinary HTML and nothing is
// lost but the toolbar.
const BOUTONS = [
  { cmd: 'bold', label: 'G', titre: 'Gras', style: { fontWeight: 700 } },
  { cmd: 'italic', label: 'I', titre: 'Italique', style: { fontStyle: 'italic' } },
  { cmd: 'formatBlock', arg: 'h3', label: 'Titre', titre: 'Sous-titre' },
  { cmd: 'formatBlock', arg: 'p', label: '¶', titre: 'Paragraphe normal' },
  { cmd: 'insertUnorderedList', label: '•—', titre: 'Liste à puces' },
  { cmd: 'unlink', label: 'Sans lien', titre: 'Retirer le lien' },
  { cmd: 'removeFormat', label: '✕', titre: 'Effacer la mise en forme' },
];

// L'adresse telle qu'elle la colle, rendue utilisable.
//   « https://soyoucosmetics.com/journal/x » → « /journal/x » (reste sur le site)
//   « www.exemple.ch »                       → « https://www.exemple.ch »
//   « /journal/x »                           → inchangée
// Tout autre schéma (javascript:, data:…) est refusé.
function normaliserAdresse(saisie) {
  let a = String(saisie || '').trim();
  if (!a || a === 'https://' || a === 'http://') return '';
  a = a.replace(/^https?:\/\/(www\.)?soyoucosmetics\.com(?=\/|$)/i, '') || '/';
  if (a.startsWith('/') || /^mailto:/i.test(a)) return a;
  if (/^[a-z][a-z0-9+.-]*:/i.test(a)) return /^https?:\/\//i.test(a) ? a : '';
  return `https://${a}`;
}

const RichTextEditor = ({ value, onChange, placeholder, minHeight = 220 }) => {
  const ref = useRef(null);

  // Browsers wrap new blocks in <div> by default inside contentEditable. The
  // site styles descriptions with Tailwind's prose, which spaces <p> and knows
  // nothing about a bare <div> — so pressing Enter produced blocks that looked
  // separate here and ran together once published. That is precisely the fault
  // she reported ("tout le texte est fusionné en un seul bloc"), and it would
  // have shipped again in a nicer-looking editor.
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* unsupported: blocks fall back to <div>, still readable */
    }
  }, []);

  // Only write into the element when the incoming value differs from what it
  // already shows. Assigning innerHTML on every keystroke would move the caret
  // to the start of the text on each character typed.
  useEffect(() => {
    const el = ref.current;
    if (!el || value === el.innerHTML) return;
    // Seed an empty field with one paragraph. Left truly empty, the first line
    // she types is a bare text node with no <p> around it, so it alone would
    // miss the spacing every following paragraph gets.
    el.innerHTML = value || '<p><br></p>';
  }, [value]);

  const appliquer = (bouton) => {
    ref.current?.focus();
    document.execCommand(bouton.cmd, false, bouton.arg);
    onChange(ref.current.innerHTML);
  };

  // Un lien vers un article du journal, une autre fiche, ou un autre site —
  // demandé tel quel. On sélectionne les mots, on colle l'adresse.
  //
  // Une adresse du site lui-même (« soyoucosmetics.com/… » ou « /journal/… »)
  // est gardée relative et s'ouvre dans l'onglet ; toute autre part dans un
  // nouvel onglet, pour ne pas faire quitter la boutique.
  const insererLien = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    const vide = !selection || selection.isCollapsed || !el.contains(selection.anchorNode);
    const saisie = window.prompt(
      vide
        ? 'Adresse du lien (une page du site, un article, ou un autre site) :'
        : 'Adresse du lien pour le texte sélectionné :',
      'https://'
    );
    const adresse = normaliserAdresse(saisie);
    if (!adresse) return;
    if (vide) {
      const texte = window.prompt('Texte du lien :', '');
      if (!texte) return;
      const a = document.createElement('a');
      a.textContent = texte;
      a.setAttribute('href', adresse);
      document.execCommand('insertHTML', false, a.outerHTML);
    } else {
      document.execCommand('createLink', false, adresse);
    }
    el.querySelectorAll('a[href]').forEach((a) => {
      if (/^https?:\/\//i.test(a.getAttribute('href'))) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      } else {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
    onChange(el.innerHTML);
  };

  // Paste as plain text. Copying from Word or from the old site otherwise brings
  // its entire style soup along — the nested <span> markup already clogging the
  // descriptions imported from Wix.
  const collerSansMiseEnForme = (e) => {
    e.preventDefault();
    const texte = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, texte);
    onChange(ref.current.innerHTML);
  };

  const vide = !value || value === '<br>' || value.replace(/<[^>]*>/g, '').trim() === '';

  return (
    <div className="border rounded w-full overflow-hidden bg-white">
      <div className="flex flex-wrap gap-1 p-2 border-b bg-mist-white">
        {BOUTONS.map((b, i) => (
          <button
            key={i}
            type="button"
            title={b.titre}
            onMouseDown={(e) => e.preventDefault()} // garde la sélection
            onClick={() => appliquer(b)}
            style={b.style}
            className="min-w-[32px] h-8 px-2 rounded-md bg-white border border-slate-stone/15 text-sm text-slate-stone hover:bg-slate-stone hover:text-white transition-colors"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          title="Insérer un lien"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insererLien}
          className="h-8 px-2 rounded-md bg-white border border-slate-stone/15 text-sm text-slate-stone underline underline-offset-2 hover:bg-slate-stone hover:text-white transition-colors"
        >
          Lien
        </button>
        <span className="ml-auto self-center text-[11px] text-stone-gray pr-1">
          Les paragraphes sont conservés tels quels
        </span>
      </div>

      <div className="relative">
        {vide && placeholder && (
          <span className="pointer-events-none absolute top-3 left-4 text-sm text-stone-gray/50">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(ref.current.innerHTML)}
          onBlur={() => onChange(ref.current.innerHTML)}
          onPaste={collerSansMiseEnForme}
          style={{ minHeight }}
          className="px-4 py-3 text-sm text-slate-stone focus:outline-none overflow-y-auto
                     [&_h3]:font-serif [&_h3]:text-lg [&_h3]:mt-3 [&_h3]:mb-1
                     [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_strong]:font-semibold [&_a]:underline [&_a]:text-mist-blue"
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
