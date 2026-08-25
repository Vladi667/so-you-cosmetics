import { Link } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import AutoPlayVideo from '../components/AutoPlayVideo';
import { useLanguage } from '../i18n/LanguageContext';

const WorkshopsPage = () => {
  const { t } = useLanguage();
  const [workshops, setWorkshops] = useState([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: t('workshopsPage.defaultSubject'), message: '' });
  const [contactStatus, setContactStatus] = useState({ sending: false, success: '', error: '' });

  useEffect(() => {
    fetch('/api/workshops')
      .then(res => {
        if (!res.ok) throw new Error('Network response not ok');
        return res.json();
      })
      .then(data => setWorkshops(data))
      .catch(err => console.warn("Failed to load workshops, hiding section:", err));
  }, []);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactStatus({ sending: true, success: '', error: '' });
    
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactForm)
    })
    .then(res => {
      if (!res.ok) throw new Error("Erreur lors de l'envoi");
      return res.json();
    })
    .then(() => {
      setContactStatus({ sending: false, success: t('workshopsPage.successMsg'), error: '' });
      setTimeout(() => {
        setIsContactModalOpen(false);
        setContactStatus({ sending: false, success: '', error: '' });
        setContactForm({ ...contactForm, message: '' });
      }, 2000);
    })
    .catch(err => {
      setContactStatus({ sending: false, success: '', error: t('workshopsPage.errorMsg') });
    });
  };

  const details = t('workshopsPage.details');

  return (
    <div className="min-h-screen bg-mist-white overflow-hidden">

      {/* Hero Section */}
      <section className="relative h-[70vh] md:h-[85vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-stone overflow-hidden">
          <AutoPlayVideo
            src="/workshop.mp4"
            className="w-full h-full object-cover opacity-85 brightness-125 contrast-95 mix-blend-overlay scale-105 sepia-[.03]"
          />
          {/* Vignette */}
          <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)' }}></div>
          {/* Warm amber whisper */}
          <div className="absolute inset-0 z-10 bg-amber-900/[0.04]"></div>
          {/* Top/bottom gradient */}
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-stone/70 via-transparent to-slate-stone/60"></div>
        </div>
        <div className="relative z-20 container mx-auto px-6 text-center reveal mt-20">
          <p className="text-white/80 uppercase tracking-[0.5em] text-[10px] md:text-xs mb-6 md:mb-8 font-sans font-bold">{t('workshopsPage.eyebrow')}</p>
          <h1 className="leading-[1.06] font-serif text-4xl sm:text-6xl md:text-8xl text-white max-w-5xl mx-auto" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
            {t('workshopsPage.title')}
          </h1>
          <p className="text-white/90 font-serif italic text-lg sm:text-xl md:text-3xl mt-6 md:mt-8 max-w-3xl mx-auto opacity-80" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4)' }}>
            {t('workshopsPage.quote')}
          </p>
        </div>
      </section>

      {/* Introduction — The pitch */}
      <section className="py-12 sm:py-24 md:py-32 bg-ivory relative">
        <div className="container mx-auto px-6 md:px-12 max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 md:gap-20 items-center">
            <div className="reveal">
              <h2 className="leading-[1.1] font-serif text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-slate-stone mb-4 sm:mb-8 md:mb-12">
                {t('workshopsPage.introTitleLine1')}<br/><span className="italic text-slate-stone/40">{t('workshopsPage.introTitleLine2')}</span>
              </h2>
              <div className="space-y-3 sm:space-y-6 md:space-y-8 font-sans text-stone-gray font-light leading-relaxed text-sm md:text-lg lg:text-xl text-left sm:text-justify">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl md:first-letter:text-7xl first-letter:font-serif first-letter:text-slate-stone first-letter:mr-2 sm:first-letter:mr-3 first-letter:float-left first-letter:leading-none">
                  {t('workshopsPage.introP1')}
                </p>
                <div className="relative py-3 px-3 sm:py-6 sm:px-6 md:py-10 md:px-10 bg-mist-white rounded-xl sm:rounded-2xl md:rounded-3xl border-l-2 sm:border-l-4 md:border-l-8 border-slate-stone shadow-md sm:shadow-xl transform -rotate-1 my-3 sm:my-6 md:my-10">
                  <p className="text-sm md:text-xl lg:text-2xl italic font-serif text-slate-stone leading-relaxed">
                    {t('workshopsPage.introQuote')}
                  </p>
                </div>
              </div>
            </div>
            <div className="reveal" style={{ transitionDelay: '200ms' }}>
              <div className="relative aspect-[4/5] rounded-[12px] sm:rounded-[24px] md:rounded-[40px] overflow-hidden shadow-2xl">
                <img
                  src="/workshop_ingredients.png"
                  alt="Ingrédients Naturels"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {workshops.length > 0 && (
        <section className="py-12 sm:py-24 bg-mist-white relative">
          <div className="container mx-auto px-6 md:px-12 max-w-6xl">
            <h2 className="leading-[1.1] font-serif text-3xl sm:text-5xl md:text-6xl text-slate-stone mb-12 text-center reveal">{t('workshopsPage.nextWorkshops')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              {workshops.map((ws, idx) => (
                <div key={idx} className="bg-ivory rounded-3xl p-6 sm:p-10 shadow-xl reveal">
                  <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                    <img src={ws.image_url || '/workshop_ingredients.png'} alt={ws.title} className="w-32 h-32 object-cover rounded-2xl shadow-md" />
                    <div className="flex-1 text-center sm:text-left">
                      <Link to={`/workshops/${ws.id}`} className="inline-block">
                        <h3 className="font-serif text-2xl text-slate-stone mb-2 hover:text-stone-gray transition-colors">{ws.title}</h3>
                      </Link>
                      <div className="prose prose-sm max-w-none font-sans text-stone-gray text-sm mb-4 leading-relaxed prose-strong:text-slate-stone" dangerouslySetInnerHTML={{ __html: ws.description || '' }} />
                      <div className="flex flex-wrap gap-4 items-center justify-center sm:justify-start">
                        <span className="font-bold text-slate-stone">CHF {ws.price}</span>
                        <span className="text-stone-gray/60 text-sm">{ws.duration}</span>
                      </div>
                      <button onClick={() => { setContactForm({...contactForm, subject: t('workshopsPage.reservationSubject', { title: ws.title })}); setIsContactModalOpen(true); }} className="mt-6 px-6 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone/90 transition-all shadow-md">{t('workshopsPage.reserveThis')}</button>
                      <Link to={`/workshops/${ws.id}`} className="mt-6 ml-3 inline-block px-6 py-2 border border-slate-stone/25 text-slate-stone rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone hover:text-white transition-colors">{t('workshopsPage.detailsLink')}</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Details — Bento Cards */}
      <section className="py-12 sm:py-24 md:py-32 bg-gradient-to-b from-mist-white to-white relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-8 sm:mb-16 md:mb-24 reveal">
            <h2 className="leading-[1.1] font-serif text-2xl sm:text-5xl md:text-7xl text-slate-stone mb-4 sm:mb-6 md:mb-10">{t('workshopsPage.detailsTitle')}</h2>
            <p className="font-sans font-light text-stone-gray text-sm sm:text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
              {t('workshopsPage.detailsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-8 lg:gap-16 max-w-4xl mx-auto">
            {details.map((item, index) => (
              <div
                key={index}
                className="group relative bg-ivory rounded-[16px] sm:rounded-[30px] md:rounded-[40px] p-3 sm:p-8 md:p-12 shadow-[0_15px_50px_rgb(0,0,0,0.05)] hover:shadow-[0_30px_70px_rgb(0,0,0,0.1)] transform hover:-translate-y-4 transition-all duration-700 reveal overflow-hidden border border-slate-stone/5"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="absolute -right-2 -bottom-4 sm:-right-4 sm:-bottom-8 md:-right-6 md:-bottom-10 text-[4.5rem] sm:text-[8rem] md:text-[12rem] font-serif text-slate-stone/[0.04] group-hover:text-slate-stone/[0.08] group-hover:scale-125 transition-all duration-700 pointer-events-none italic">
                  {index + 1}
                </div>
                <div className="relative z-10">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-mist-white rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 md:mb-10 group-hover:bg-slate-stone group-hover:text-white transition-all duration-250 transform group-hover:rotate-12">
                    <span className="font-serif text-xs sm:text-lg md:text-2xl font-bold">0{index + 1}</span>
                  </div>
                  <h3 className="font-sans tracking-[0.1em] sm:tracking-[0.2em] uppercase text-[9px] sm:text-xs md:text-sm mb-2 sm:mb-4 font-bold text-slate-stone">
                    {item.label}
                  </h3>
                  <p className="font-serif text-[11px] sm:text-sm md:text-xl lg:text-2xl text-slate-stone/80 leading-relaxed">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Contact Section */}
      <section className="relative py-16 sm:py-32 md:py-48 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-slate-stone">
          <img
            src="/workshop_crafting.png"
            alt="Atelier Background"
            className="w-full h-full object-cover opacity-50 brightness-125 contrast-95 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-slate-stone/35"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center reveal">
          <h2 className="leading-[1.1] font-serif text-2xl sm:text-5xl md:text-7xl text-white mb-6 sm:mb-10 drop-shadow-lg">{t('workshopsPage.ctaTitle')}</h2>
          <p className="font-sans text-white/80 text-sm sm:text-xl md:text-2xl font-light mb-8 sm:mb-16 max-w-2xl mx-auto leading-relaxed">
            {t('workshopsPage.ctaText')}
          </p>
          <button
            onClick={() => { setContactForm({...contactForm, subject: t('workshopsPage.defaultSubject')}); setIsContactModalOpen(true); }}
            className="inline-block px-6 sm:px-10 py-3 sm:py-4 bg-ivory text-slate-stone font-sans uppercase tracking-[0.3em] text-[10px] sm:text-sm hover:bg-slate-stone hover:text-white transition-all duration-250 shadow-xl rounded-full hover:scale-105 transform"
          >
            {t('workshopsPage.ctaButton')}
          </button>
        </div>
      </section>

      {isContactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsContactModalOpen(false)}></div>
          <div className="relative bg-ivory rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="p-8">
              <h2 className="font-serif text-3xl text-slate-stone mb-2">{t('workshopsPage.modalTitle')}</h2>
              <p className="text-stone-gray text-sm mb-6">{t('workshopsPage.modalText')}</p>
              
              {contactStatus.success && <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl text-sm">{contactStatus.success}</div>}
              {contactStatus.error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm">{contactStatus.error}</div>}
              
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <input type="text" required placeholder={t('workshopsPage.namePlaceholder')} value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40" />
                <input type="email" required placeholder={t('workshopsPage.emailPlaceholder')} value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40" />
                <input type="text" required placeholder={t('workshopsPage.subjectPlaceholder')} value={contactForm.subject} onChange={e => setContactForm({...contactForm, subject: e.target.value})} className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40" />
                <textarea required placeholder={t('workshopsPage.messagePlaceholder')} rows="4" value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})} className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"></textarea>

                <div className="pt-2 flex gap-4">
                  <button type="submit" disabled={contactStatus.sending} className="flex-1 py-3 bg-slate-stone text-white font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-slate-stone/90 transition-all active:scale-[0.97]">{contactStatus.sending ? t('workshopsPage.sending') : t('workshopsPage.send')}</button>
                  <button type="button" onClick={() => setIsContactModalOpen(false)} className="flex-1 py-3 bg-mist-white text-slate-stone font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-gray-200 transition-all">{t('workshopsPage.cancel')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkshopsPage;
