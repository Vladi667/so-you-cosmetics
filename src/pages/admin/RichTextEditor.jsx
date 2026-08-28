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
  { cmd: 'removeFormat', label: '✕', titre: 'Effacer la mise en forme' },
];

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
                     [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_strong]:font-semibold"
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
