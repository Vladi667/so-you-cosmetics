import React, { useEffect } from 'react';

const LegalLayout = ({ title, intro, sections = [], lastUpdated }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-mist-white">
      {/* Hero */}
      <section className="relative pt-40 pb-16 sm:pt-48 sm:pb-24 bg-slate-stone text-white">
        <div className="container mx-auto px-6 md:px-12 max-w-4xl text-center">
          <p className="text-white/60 uppercase tracking-[0.5em] text-[10px] md:text-xs mb-6 font-sans font-bold">SoYou Cosmetics</p>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white leading-tight">{title}</h1>
          {lastUpdated && (
            <p className="font-sans text-white/50 text-xs sm:text-sm mt-6">Dernière mise à jour : {lastUpdated}</p>
          )}
        </div>
      </section>

      {/* Content */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-6 md:px-12 max-w-3xl">
          {intro && (
            <p className="font-sans font-light text-stone-gray text-base sm:text-lg leading-relaxed mb-12">{intro}</p>
          )}

          <div className="space-y-12">
            {sections.map((s, i) => (
              <div key={i}>
                <h2 className="font-serif text-2xl sm:text-3xl text-slate-stone mb-4">{s.heading}</h2>
                <div className="font-sans font-light text-stone-gray leading-relaxed space-y-4 text-sm sm:text-base">
                  {s.body.map((p, j) =>
                    Array.isArray(p) ? (
                      <ul key={j} className="list-disc pl-5 space-y-2 marker:text-slate-stone/40">
                        {p.map((li, k) => <li key={k}>{li}</li>)}
                      </ul>
                    ) : (
                      <p key={j}>{p}</p>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 pt-8 border-t border-slate-stone/10">
            <p className="font-sans text-stone-gray/60 text-sm">
              Pour toute question, contactez-nous à{' '}
              <a href="mailto:contact@soyou.ch" className="text-slate-stone hover:underline">contact@soyou.ch</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LegalLayout;
