import React, { useEffect, useState } from 'react';

const ContactPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    const hiddenElements = document.querySelectorAll('.reveal');
    hiddenElements.forEach((el) => observer.observe(el));

    return () => {
      hiddenElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  const schedule = [
    { day: "Lundi", hours: "Fermé", closed: true },
    { day: "Mardi", hours: "11:00–13:00 / 14:00–18:30" },
    { day: "Mercredi", hours: "11:00–13:00 / 14:00–18:30" },
    { day: "Jeudi", hours: "11:00–13:00 / 14:00–18:30" },
    { day: "Vendredi", hours: "11:00–13:00 / 14:00–18:30" },
    { day: "Samedi", hours: "11:00–16:30" },
  ];

  return (
    <div className="min-h-screen bg-mist-white overflow-hidden">

      {/* Hero Section */}
      <section className="relative h-[75vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-stone overflow-hidden">
          <img
            src="/boutique_exterior.png"
            alt="Boutique Soap Opera"
            className="w-full h-full object-cover opacity-50 mix-blend-overlay scale-105"
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)' }}></div>
          <div className="absolute inset-0 bg-amber-900/[0.04]"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-stone/70 via-transparent to-slate-stone/60"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center reveal mt-20">
          <p className="text-white/80 uppercase tracking-[0.5em] text-[10px] md:text-xs mb-8 font-sans font-bold">Genève, Suisse</p>
          <h1 className="font-serif text-6xl md:text-8xl text-white leading-tight max-w-5xl mx-auto" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
            Nous Trouver
          </h1>
          <p className="text-white/90 font-serif italic text-2xl md:text-3xl mt-8 max-w-3xl mx-auto opacity-80" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4)' }}>
            Boutique Soap Opera by So You Cosmetics
          </p>
        </div>
      </section>

      {/* Boutique Info + Schedule */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 md:px-12 max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-20">

            {/* Left — Address & Phone */}
            <div className="w-full lg:w-1/2 reveal">
              <h2 className="font-serif text-5xl md:text-6xl text-slate-stone mb-6 leading-tight">
                Notre<br/><span className="italic text-slate-stone/40">Boutique</span>
              </h2>
              <p className="font-sans text-stone-gray font-light text-xl mb-12">
                Cosmétiques naturels faits main à Genève
              </p>

              <div className="space-y-8">
                {/* Address */}
                <div className="flex items-start gap-5 group">
                  <div className="w-14 h-14 bg-mist-white rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-sans tracking-[0.2em] uppercase text-xs font-bold text-slate-stone mb-2">Adresse</h3>
                    <p className="font-serif text-xl text-slate-stone/80">3 ave. Pictet-De-Rochemont</p>
                    <p className="font-serif text-xl text-slate-stone/80">1207 Genève</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-5 group">
                  <div className="w-14 h-14 bg-mist-white rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-sans tracking-[0.2em] uppercase text-xs font-bold text-slate-stone mb-2">Téléphone</h3>
                    <a href="tel:+41225566992" className="font-serif text-xl text-slate-stone/80 hover:text-slate-stone transition-colors duration-300">022 556 69 92</a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-5 group">
                  <div className="w-14 h-14 bg-mist-white rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-sans tracking-[0.2em] uppercase text-xs font-bold text-slate-stone mb-2">Email</h3>
                    <a href="mailto:contact@soyou.ch" className="font-serif text-xl text-slate-stone/80 hover:text-slate-stone transition-colors duration-300">contact@soyou.ch</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Schedule */}
            <div className="w-full lg:w-1/2 reveal" style={{ transitionDelay: '200ms' }}>
              <div className="bg-mist-white rounded-[40px] p-10 md:p-14 border border-slate-stone/5">
                <h3 className="font-serif text-3xl text-slate-stone mb-10">Horaire d'ouverture</h3>
                <div className="space-y-0">
                  {schedule.map((item, index) => (
                    <div key={index} className={`flex justify-between items-center py-5 ${index < schedule.length - 1 ? 'border-b border-slate-stone/10' : ''}`}>
                      <span className={`font-sans text-lg ${item.closed ? 'text-stone-gray/50' : 'text-slate-stone'}`}>{item.day}</span>
                      <span className={`font-sans text-lg text-right ${item.closed ? 'text-stone-gray/40 italic' : 'text-stone-gray font-light'}`}>{item.hours}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-10 pt-10 border-t border-slate-stone/10 space-y-6">
                  <div className="flex justify-between items-start">
                    <span className="font-sans text-sm text-slate-stone/60 max-w-[140px]">Si vous n'êtes pas du quartier</span>
                    <span className="font-sans text-sm text-stone-gray font-light text-right">Prière de téléphoner à l'avance<br/>ou prenez un RDV</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="font-sans text-sm text-slate-stone/60 max-w-[140px]">En dehors de ces horaires</span>
                    <span className="font-sans text-sm text-stone-gray font-light text-right">Par Chance ou Sur RDV</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="font-sans text-sm text-slate-stone/60 max-w-[140px]">Jours fériés, vacances</span>
                    <span className="font-sans text-sm text-stone-gray font-light text-right">Prière consulter Google, pas<br/>de livraisons ni retraits ces jours</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-32 bg-gradient-to-b from-mist-white to-white relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="container mx-auto px-6 md:px-12 max-w-4xl relative z-10">
          <div className="text-center mb-20 reveal">
            <h2 className="font-serif text-6xl md:text-7xl text-slate-stone mb-6">Écrivez-nous</h2>
            <p className="font-sans font-light text-stone-gray text-xl">
              Nous vous répondrons dans les plus brefs délais.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="reveal bg-white rounded-[40px] p-10 md:p-16 shadow-[0_15px_50px_rgb(0,0,0,0.05)] border border-slate-stone/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block font-sans text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-3">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-6 py-4 font-sans text-slate-stone focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
                  placeholder="Votre nom"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-3">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-6 py-4 font-sans text-slate-stone focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
                  placeholder="votre@email.com"
                />
              </div>
            </div>
            <div className="mb-8">
              <label className="block font-sans text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-3">Sujet</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-6 py-4 font-sans text-slate-stone focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
                placeholder="Sujet de votre message"
              />
            </div>
            <div className="mb-10">
              <label className="block font-sans text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-3">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={6}
                className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-6 py-4 font-sans text-slate-stone focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300 resize-none"
                placeholder="Votre message..."
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-sans text-stone-gray/50 text-sm hidden md:block">
                Ou appelez-nous : <a href="tel:+41225566992" className="text-slate-stone hover:underline">022 556 69 92</a>
              </p>
              <button
                type="submit"
                className={`px-12 py-5 font-sans uppercase tracking-[0.3em] text-sm rounded-full shadow-xl transition-all duration-500 transform hover:scale-105 ${sent ? 'bg-green-600 text-white' : 'bg-slate-stone text-white hover:bg-slate-stone/90'}`}
              >
                {sent ? '✓ Envoyé !' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Google Maps Embed */}
      <section className="relative">
        <div className="w-full h-[500px] grayscale hover:grayscale-0 transition-all duration-1000">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2762.1234567890!2d6.1512!3d46.2044!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s3+Avenue+Pictet-de-Rochemont%2C+1207+Gen%C3%A8ve!5e0!3m2!1sfr!2sch!4v1234567890"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Boutique Soap Opera Location"
          ></iframe>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
