import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';

const formatDate = (iso, language) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locales = { fr: 'fr-CH', en: 'en-GB', de: 'de-CH' };
  return d.toLocaleDateString(locales[language] || 'fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });
};

// The Journal — list and article, one component because they share their whole
// visual language and differ only in what they fetch.
//
// Articles are written in one language, not three. Writing every post three
// times is not sustainable for one person, and a half-translated post reads
// worse than an honestly monolingual one; a post whose language differs from the
// visitor's says so rather than pretending.
const JournalPage = () => {
  const { slug } = useParams();
  const { t, language } = useLanguage();
  useMetadonnees({ titre: t('journal.title'), description: t('journal.intro') });
  const [articles, setArticles] = useState([]);
  const [article, setArticle] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;
    const url = slug ? `/api/articles/${slug}` : '/api/articles';
    setState('loading');
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (!active) return;
        if (slug) setArticle(data); else setArticles(Array.isArray(data) ? data : []);
        setState('ready');
      })
      .catch(() => { if (active) setState(slug ? 'missing' : 'ready'); });
    return () => { active = false; };
  }, [slug]);

  if (state === 'loading') {
    return <div className="min-h-screen bg-mist-white flex items-center justify-center"><p className="text-sm text-stone-gray">…</p></div>;
  }

  if (state === 'missing') {
    return (
      <div className="min-h-screen bg-mist-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl text-slate-stone mb-4">{t('journal.notFoundTitle')}</h1>
          <Link to="/journal" className="inline-block mt-4 px-8 py-3 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone/90 transition-colors">
            {t('journal.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  // ---- un article ----------------------------------------------------------
  if (slug && article) {
    return (
      <article className="min-h-screen bg-mist-white pt-28 sm:pt-36 pb-20">
        <div className="container mx-auto px-6 md:px-12 max-w-3xl">
          <Link to="/journal" className="inline-block font-sans text-xs uppercase tracking-widest text-stone-gray hover:text-slate-stone transition-colors mb-8">
            ← {t('journal.backToList')}
          </Link>

          <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-stone-gray/70 mb-4">
            {formatDate(article.date, language)}
          </p>
          <h1 className="font-serif font-light text-slate-stone text-3xl sm:text-4xl md:text-5xl mb-8">
            {article.title}
          </h1>

          {article.language && article.language !== language && (
            <p className="mb-8 px-4 py-2.5 bg-lake-mist border border-slate-stone/10 rounded-xl font-sans text-xs text-stone-gray">
              {t('journal.otherLanguage')}
            </p>
          )}

          {article.image_url && (
            <div className="relative aspect-[16/9] rounded-3xl overflow-hidden mb-10 bg-ivory border border-slate-stone/[0.07]">
              <img src={article.image_url} alt="" className="absolute inset-0 w-full h-full object-cover brightness-[1.02] saturate-[0.93]" />
              <div className="absolute inset-0 bg-[#B9A891]/[0.12] mix-blend-soft-light pointer-events-none" />
            </div>
          )}

          <div
            className="prose prose-sm sm:prose max-w-[65ch] mx-auto font-sans font-light text-stone-gray leading-relaxed
                       prose-headings:font-serif prose-headings:text-slate-stone prose-headings:font-normal
                       prose-strong:text-slate-stone prose-strong:font-medium"
            dangerouslySetInnerHTML={{ __html: article.body || '' }}
          />
        </div>
      </article>
    );
  }

  // ---- la liste ------------------------------------------------------------
  return (
    <div className="min-h-screen bg-mist-white pt-28 sm:pt-36 pb-20">
      <div className="container mx-auto px-6 md:px-12 max-w-5xl">
        <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-stone-gray/70 mb-4 text-center">
          {t('journal.eyebrow')}
        </p>
        <h1 className="font-serif font-light text-slate-stone text-4xl sm:text-5xl mb-4 text-center">
          {t('journal.title')}
        </h1>
        <p className="font-sans font-light text-stone-gray text-center max-w-xl mx-auto mb-14">
          {t('journal.intro')}
        </p>

        {articles.length === 0 ? (
          <p className="text-center font-sans text-sm text-stone-gray">{t('journal.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((a) => (
              <Link key={a.id} to={`/journal/${a.slug}`} className="group block">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-ivory border border-slate-stone/[0.07] mb-4 shadow-sm group-hover:shadow-xl transition-shadow duration-300">
                  {a.image_url ? (
                    <>
                      <img src={a.image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover brightness-[1.02] saturate-[0.93] transition-transform duration-500 group-hover:scale-[1.04]" />
                      <div className="absolute inset-0 bg-[#B9A891]/[0.12] mix-blend-soft-light pointer-events-none" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-alpine-silver/60">
                      <span className="font-serif text-slate-stone/40 text-3xl tracking-widest">SY</span>
                    </div>
                  )}
                </div>
                <p className="font-sans text-[10px] uppercase tracking-widest text-mist-blue mb-1">{formatDate(a.date, language)}</p>
                <h2 className="font-serif text-xl text-slate-stone leading-snug group-hover:text-stone-gray transition-colors">{a.title}</h2>
                {a.excerpt && <p className="font-sans text-sm text-stone-gray mt-2 leading-relaxed">{a.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalPage;
