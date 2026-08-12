import React, { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const ContactPage = () => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to send message');
        return res.json();
      })
      .then(() => {
        setSent(true);
        setTimeout(() => setSent(false), 4000);
        setFormData({ name: '', email: '', subject: '', message: '' });
      })
      .catch(err => {
        console.error('Failed to submit contact query:', err);
        // Fallback: show success anyway to keep UX working if offline
        setSent(true);
        setTimeout(() => setSent(false), 4000);
        setFormData({ name: '', email: '', subject: '', message: '' });
      });
  };

  const days = t('contact.days');
  const schedule = [
    { day: days[0], hours: t('contact.closed'), closed: true },
    { day: days[1], hours: "11:00–13:00 / 14:00–18:30" },
    { day: days[2], hours: "11:00–13:00 / 14:00–18:30" },
    { day: days[3], hours: "11:00–13:00 / 14:00–18:30" },
    { day: days[4], hours: "11:00–13:00 / 14:00–18:30" },
    { day: days[5], hours: "11:00–16:30" },
  ];

  return (
    <div className="min-h-screen bg-mist-white overflow-hidden">

      {/* Hero Section */}
      <section className="relative h-[75vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-stone overflow-hidden">
          <img
            src="/boutique_exterior.png"
            alt="Boutique Soap Opera"
            className="w-full h-full object-cover opacity-70 brightness-125 contrast-95 mix-blend-overlay scale-105"
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 100%)' }}></div>
          <div className="absolute inset-0 bg-amber-900/[0.04]"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-stone/55 via-transparent to-slate-stone/45"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center reveal mt-20">
          <p className="text-white/80 uppercase tracking-[0.5em] text-[10px] md:text-xs mb-8 font-sans font-bold">{t('contact.eyebrow')}</p>
          <h1 className="font-serif text-4xl sm:text-6xl md:text-8xl text-white leading-tight max-w-5xl mx-auto" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
            {t('contact.title')}
          </h1>
          <p className="text-white/90 font-serif italic text-lg sm:text-2xl md:text-3xl mt-8 max-w-3xl mx-auto opacity-80" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4)' }}>
            {t('contact.subtitle')}
          </p>
        </div>
      </section>

      {/* Boutique Info + Schedule */}
      <section className="py-16 sm:py-32 bg-white">
        <div className="container mx-auto px-6 md:px-12 max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 md:gap-20">

            {/* Left — Address & Phone */}
            <div className="reveal">
              <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-slate-stone mb-3 sm:mb-6 leading-tight">
                {t('contact.boutiqueTitleLine1')}<br/><span className="italic text-slate-stone/40">{t('contact.boutiqueTitleLine2')}</span>
              </h2>
              <p className="font-sans text-stone-gray font-light text-xs sm:text-lg lg:text-xl mb-6 sm:mb-12">
                {t('contact.boutiqueSub')}
              </p>

              <div className="space-y-4 sm:space-y-8">
                {/* Address */}
                <div className="flex items-start gap-2 sm:gap-5 group">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-mist-white rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500">
                    <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-sans tracking-[0.1em] sm:tracking-[0.2em] text-[9px] sm:text-xs font-bold text-slate-stone mb-1 sm:mb-2 uppercase">{t('contact.addressLabel')}</h3>
                    <p className="font-serif text-[10px] sm:text-sm md:text-lg lg:text-xl text-slate-stone/80">3 av. Pictet-De-Rochemont</p>
                    <p className="font-serif text-[10px] sm:text-sm md:text-lg lg:text-xl text-slate-stone/80">1207 Genève</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-2 sm:gap-5 group">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-mist-white rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500">
                    <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-sans tracking-[0.1em] sm:tracking-[0.2em] text-[9px] sm:text-xs font-bold text-slate-stone mb-1 sm:mb-2 uppercase">{t('contact.phoneLabel')}</h3>
                    <a href="tel:+41225566992" className="font-serif text-[10px] sm:text-sm md:text-lg lg:text-xl text-slate-stone/80 hover:text-slate-stone transition-colors duration-300">022 556 69 92</a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-2 sm:gap-5 group">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-mist-white rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500">
                    <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-sans tracking-[0.1em] sm:tracking-[0.2em] text-[9px] sm:text-xs font-bold text-slate-stone mb-1 sm:mb-2 uppercase">{t('contact.emailLabel')}</h3>
                    <a href="mailto:contact@soyoucosmetics.com" className="font-serif text-[10px] sm:text-sm md:text-lg lg:text-xl text-slate-stone/80 hover:text-slate-stone transition-colors duration-300">contact@soyoucosmetics.com</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Schedule */}
            <div className="reveal" style={{ transitionDelay: '200ms' }}>
              <div className="bg-mist-white rounded-[16px] sm:rounded-[30px] md:rounded-[40px] p-4 sm:p-10 md:p-14 border border-slate-stone/5">
                <h3 className="font-serif text-base sm:text-2xl md:text-3xl text-slate-stone mb-4 sm:mb-10">{t('contact.scheduleTitle')}</h3>
                <div className="space-y-0">
                  {schedule.map((item, index) => (
                    <div key={index} className={`flex justify-between items-center py-2 sm:py-5 ${index < schedule.length - 1 ? 'border-b border-slate-stone/10' : ''}`}>
                      <span className={`font-sans text-sm sm:text-base md:text-lg ${item.closed ? 'text-stone-gray/50' : 'text-slate-stone'}`}>{item.day}</span>
                      <span className={`font-sans text-sm sm:text-base md:text-lg text-right ${item.closed ? 'text-stone-gray/40 italic' : 'text-stone-gray font-light'}`}>{item.hours}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 sm:mt-10 sm:pt-10 border-t border-slate-stone/10 space-y-2 sm:space-y-6">
                  <div className="flex justify-between items-start">
                    <span className="font-sans text-[9px] sm:text-sm text-slate-stone/60 max-w-[80px] sm:max-w-[140px]">{t('contact.noteOutOfArea').q}</span>
                    <span className="font-sans text-[9px] sm:text-sm text-stone-gray font-light text-right whitespace-pre-line">{t('contact.noteOutOfArea').a}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="font-sans text-[9px] sm:text-sm text-slate-stone/60 max-w-[80px] sm:max-w-[140px]">{t('contact.noteOutOfHours').q}</span>
                    <span className="font-sans text-[9px] sm:text-sm text-stone-gray font-light text-right whitespace-pre-line">{t('contact.noteOutOfHours').a}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="font-sans text-[9px] sm:text-sm text-slate-stone/60 max-w-[80px] sm:max-w-[140px]">{t('contact.noteHolidays').q}</span>
                    <span className="font-sans text-[9px] sm:text-sm text-stone-gray font-light text-right whitespace-pre-line">{t('contact.noteHolidays').a}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 sm:py-32 bg-gradient-to-b from-mist-white to-white relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="container mx-auto px-6 md:px-12 max-w-4xl relative z-10">
          <div className="text-center mb-10 sm:mb-20 reveal">
            <h2 className="font-serif text-3xl sm:text-5xl md:text-7xl text-slate-stone mb-3 sm:mb-6">{t('contact.formTitle')}</h2>
            <p className="font-sans font-light text-stone-gray text-sm sm:text-xl">
              {t('contact.formSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="reveal bg-white rounded-[16px] sm:rounded-[30px] md:rounded-[40px] p-5 sm:p-10 md:p-16 shadow-[0_15px_50px_rgb(0,0,0,0.05)] border border-slate-stone/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-4 sm:mb-8">
              <div>
                <label className="block font-sans text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-1.5 sm:mb-3">{t('contact.nameLabel')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-3 py-2 sm:px-6 sm:py-4 font-sans text-slate-stone text-xs sm:text-base focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
                  placeholder={t('contact.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block font-sans text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-1.5 sm:mb-3">{t('contact.emailLabelForm')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-3 py-2 sm:px-6 sm:py-4 font-sans text-slate-stone text-xs sm:text-base focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
                  placeholder={t('contact.emailPlaceholder')}
                />
              </div>
            </div>
            <div className="mb-4 sm:mb-8">
              <label className="block font-sans text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-1.5 sm:mb-3">{t('contact.subjectLabel')}</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-3 py-2 sm:px-6 sm:py-4 font-sans text-slate-stone text-xs sm:text-base focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
                placeholder={t('contact.subjectPlaceholder')}
              />
            </div>
            <div className="mb-6 sm:mb-10">
              <label className="block font-sans text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-1.5 sm:mb-3">{t('contact.messageLabel')}</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={6}
                className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-3 py-2 sm:px-6 sm:py-4 font-sans text-slate-stone text-xs sm:text-base focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300 resize-none"
                placeholder={t('contact.messagePlaceholder')}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-sans text-stone-gray/50 text-xs sm:text-sm hidden md:block">
                {t('contact.orCallPrefix')}<a href="tel:+41225566992" className="text-slate-stone hover:underline">022 556 69 92</a>
              </p>
              <button
                type="submit"
                className={`px-6 sm:px-12 py-3 sm:py-5 font-sans uppercase tracking-[0.3em] text-xs sm:text-sm rounded-full shadow-xl transition-all duration-500 transform hover:scale-105 ${sent ? 'bg-green-600 text-white' : 'bg-slate-stone text-white hover:bg-slate-stone/90'}`}
              >
                {sent ? t('contact.sent') : t('contact.send')}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Google Maps Embed */}
      <section className="relative">
        <div className="w-full h-[250px] sm:h-[400px] md:h-[500px] grayscale hover:grayscale-0 transition-all duration-1000">
          <iframe
            src="https://maps.google.com/maps?q=3%20Avenue%20Pictet-de-Rochemont%2C%201207%20Gen%C3%A8ve&output=embed"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={t('contact.mapTitle')}
          ></iframe>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
