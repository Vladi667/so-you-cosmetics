import React, { useEffect, useState, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import { lirePanier, lireFavoris, ecrirePanier, ecrireFavoris, resoudre, ajouter, fixerQuantite, nombreArticles, sursautPanier, EVT_OUVRIR_PANIER } from './services/panier';
import { getProducts } from './services/products';
import AbsenceNotice from './components/AbsenceNotice';
import Hero from './components/Hero';
import BrandEssence from './components/BrandEssence';
import SignatureProducts from './components/SignatureProducts';
import Catalog from './components/Catalog';
import HandmadeGeneva from './components/HandmadeGeneva';
import Ingredients from './components/Ingredients';
import Workshops from './components/Workshops';
import Footer from './components/Footer';
import PageLoader from './components/PageLoader';
import SideDrawer from './components/SideDrawer';
import { Routes, Route, useLocation } from 'react-router-dom';
import { separerLangue } from './i18n/routes';
import ScrollToTop from './components/ScrollToTop';
import PersonnalisationPage from './pages/PersonnalisationPage';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import AboutPage from './pages/AboutPage';
import WorkshopsPage from './pages/WorkshopsPage';
import WorkshopDetailPage from './pages/WorkshopDetailPage';
import JournalPage from './pages/JournalPage';
import ContactPage from './pages/ContactPage';
import ProductPage from './pages/ProductPage';
import SearchPage from './pages/SearchPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
// L'administration est chargee a la demande.
//
// Les deux ecrans pesaient 188 Ko de source dans le paquet principal, telecharge
// par chaque cliente alors qu'elle seule s'y connecte. React.lazy en fait des
// morceaux separes, demandes au moment ou /admin est ouvert.
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
import NotFoundPage from './pages/NotFoundPage';

function App() {
  // localStorage n'existe pas sur le serveur, et cette lecture-ci n'était pas
  // protégée : elle levait au premier rendu et faisait échouer le rendu serveur
  // de la page entière, pas seulement de l'administration.
  //
  // Faux par défaut, et c'est le bon défaut : le serveur ne doit jamais rendre
  // une administration connectée. Le navigateur corrige au montage.
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    try {
      return !!localStorage.getItem('adminToken');
    } catch {
      return false;
    }
  });
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  // Ce qui a été conservé du dernier passage, lu tout de suite : les lignes
  // {id, qty} seules, sans prix ni nom, qu'on résout ensuite contre le catalogue.
  const [lignesSauvees] = useState(() => ({ panier: lirePanier(), favoris: lireFavoris() }));
  const [panierHydrate, setPanierHydrate] = useState(false);

  // Redonne aux lignes conservées leur produit complet, au prix du catalogue du
  // jour. Un produit disparu est retiré : mieux vaut un panier plus court qu'une
  // ligne qui échouera à la commande.
  useEffect(() => {
    let actif = true;
    getProducts()
      .then((catalogue) => {
        if (!actif) return;
        if (lignesSauvees.panier.length) setCart(resoudre(lignesSauvees.panier, catalogue));
        if (lignesSauvees.favoris.length) setFavorites(resoudre(lignesSauvees.favoris, catalogue));
      })
      .catch(() => { /* catalogue indisponible : on démarre à vide */ })
      .finally(() => { if (actif) setPanierHydrate(true); });
    return () => { actif = false; };
  }, [lignesSauvees]);

  // On n'écrit qu'une fois l'hydratation terminée, sinon le premier rendu — où
  // le panier est encore vide — effacerait ce qu'on vient de lire.
  useEffect(() => { if (panierHydrate) ecrirePanier(cart); }, [cart, panierHydrate]);
  useEffect(() => { if (panierHydrate) ecrireFavoris(favorites); }, [favorites, panierHydrate]);
  // The loader now only covers the first paint. It used to be held open by a
  // 2s timer ("load simulation") and re-triggered for 1.2s on every navigation,
  // which meant ~3.2s of deliberate waiting on a site whose routing is entirely
  // client-side. Latency on the interaction path is the fastest way to make an
  // interface feel unresponsive, so both timers are gone.
  const [isLoading, setIsLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);

  useEffect(() => {
    // Dismiss on the next frame: long enough to avoid a flash of unstyled
    // content, short enough to be imperceptible.
    //
    // rAF alone is not enough: a background tab does not composite, so the
    // callback never runs and the loader would stay up until the tab is
    // focused. The timeout is the floor that guarantees dismissal either way.
    const raf = requestAnimationFrame(() => setIsLoading(false));
    const fallback = setTimeout(() => setIsLoading(false), 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(fallback); };
  }, []);

  const location = useLocation();
  // Le préfixe de langue est retiré d'abord : sans cela « /en/admin » ne serait
  // pas reconnu comme l'administration, et la barre, le pied de page et les
  // tiroirs reviendraient se poser par-dessus.
  const isAdminPage = separerLangue(location.pathname).chemin.startsWith('/admin');

  // handleCategorySelect vivait ici : la barre et le menu mobile lui passaient
  // une clef de rubrique et il appelait navigate(). Les deux émettent
  // maintenant de vrais liens, dont l'adresse est la destination — il n'y a
  // plus de traduction à faire entre les deux, ni de gestionnaire à exécuter
  // pour qu'un robot sache où mène une entrée de menu.

  const addToCart = (product, quantite = 1) => {
    // Fusionne les quantités : six savons font une ligne « ×6 », pas six lignes.
    setCart(prev => ajouter(prev, product, quantite));
    sursautPanier(document.getElementById('cart-icon'));
  };

  const removeFromCart = (product) => {
    // Par identifiant, plus par position : une ligne porte maintenant une
    // quantité, et l'index d'une liste qui fusionne ne désigne plus rien de
    // stable.
    setCart(prev => fixerQuantite(prev, product, 0));
  };

  const toggleFavorite = (product) => {
    setFavorites(prev => {
      if (prev.find(p => p.id === product.id)) return prev.filter(p => p.id !== product.id);
      return [...prev, product];
    });
    sursautPanier(document.getElementById('fav-icon'));
  };

  const removeFavorite = (product) => {
    setFavorites(prev => prev.filter(p => p.id !== product.id));
  };

  useEffect(() => {
    const ouvrir = () => setCartOpen(true);
    window.addEventListener(EVT_OUVRIR_PANIER, ouvrir);
    return () => window.removeEventListener(EVT_OUVRIR_PANIER, ouvrir);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('active');
          // Une apparition n'a lieu qu'une fois. Sans ce retrait, chaque bloc
          // deja apparu restait observe pour toute la visite et rappelait
          // l'observateur a chaque passage devant lui.
          observer.unobserve(entry.target);
        });
      },
      {
        // Le seuil de 0,1 demandait que 10 % de l'element soit visible. Sur un
        // bloc plus haut que l'ecran, cela n'arrive qu'apres l'avoir largement
        // depasse : le contenu apparaissait sous les yeux du lecteur, en retard
        // sur son propre defilement. On declenche des que le haut de l'element
        // franchit le dernier dixieme de la fenetre.
        threshold: 0,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    // `:not(.active)` : les blocs deja apparus n'ont plus rien a apprendre, et
    // la page en contient vite des dizaines.
    const observerLesApparitions = () => {
      document.querySelectorAll('.reveal:not(.active)').forEach((el) => observer.observe(el));
    };

    observerLesApparitions();

    // Le catalogue, les tiroirs et les messages d'ajout modifient le DOM en
    // permanence. Un seul passage par image suffit : sans cela, ajouter un
    // article relancait une recherche sur tout le document a chaque mutation.
    let planifie = false;
    const mutationObserver = new MutationObserver((mutations) => {
      if (planifie) return;
      if (!mutations.some((m) => m.addedNodes.length > 0)) return;
      planifie = true;
      requestAnimationFrame(() => {
        planifie = false;
        observerLesApparitions();
      });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // L'arbre des pages, déclaré une fois et monté sous chacune des trois
  // langues. Les chemins sont relatifs au préfixe : « about » et non
  // « /about », sans quoi ils ne se résoudraient que sous la racine.
  const pages = (
    <Routes>
      <Route index element={<Home addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
      <Route path="about" element={<AboutPage />} />
      <Route path="workshops" element={<WorkshopsPage />} />
      <Route path="workshops/:id" element={<WorkshopDetailPage />} />
      <Route path="journal" element={<JournalPage />} />
      <Route path="journal/:slug" element={<JournalPage />} />
      <Route path="contact" element={<ContactPage />} />
      <Route path="personnalisation" element={<PersonnalisationPage />} />
      <Route path="category/:categoryName" element={<CategoryPage addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
      <Route path="product/:id" element={<ProductPage addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
      <Route path="search/:query" element={<SearchPage addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
      <Route path="terms" element={<TermsPage />} />
      <Route path="privacy" element={<PrivacyPage />} />
      <Route
        path="admin"
        element={
          // Le morceau arrive par le reseau : sans Suspense, React leve.
          // L'attente est le fond du site, pas un ecran blanc.
          <Suspense fallback={<div className="min-h-screen bg-mist-white" />}>
            {isAdminLoggedIn ? (
              <AdminDashboard onLogout={() => { localStorage.removeItem('adminToken'); setIsAdminLoggedIn(false); }} />
            ) : (
              <AdminLogin onLoginSuccess={() => setIsAdminLoggedIn(true)} />
            )}
          </Suspense>
        }
      />
      {/* Tout le reste. Sans cette route, une adresse inconnue rendait un
          <main> vide entre la barre et le pied de page. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );

  return (
    <div className="font-sans antialiased text-stone-gray bg-mist-white min-h-screen flex flex-col overflow-x-hidden">
      <ScrollToTop />
      {!isAdminPage && <PageLoader isVisible={isLoading} />}
      {!isAdminPage && <AbsenceNotice />}
      {/* Les deux tiroirs occupent exactement la meme place, sur le bord droit.
          Ouvrir les favoris par-dessus le panier posait un panneau sur l'autre :
          on fermait celui du dessus et le premier reapparaissait sans qu'on
          l'ait demande. Un seul a la fois. */}
      {!isAdminPage && (
        <Navbar 
          cartCount={nombreArticles(cart)} 
          favCount={favorites.length} 
          onCartClick={() => { setFavOpen(false); setCartOpen(true); }}
          onFavClick={() => { setCartOpen(false); setFavOpen(true); }}
        />
      )}
      
      <main className="flex-grow">
        {/* Les mêmes pages, sous trois adresses.
            Le français reste à la racine — aucune adresse existante ne change —
            et l'anglais et l'allemand prennent un préfixe. Les chemins internes
            sont relatifs : c'est ce qui permet de déclarer l'arbre une seule
            fois pour les trois langues. */}
        <Routes>
          <Route path="/en/*" element={pages} />
          <Route path="/de/*" element={pages} />
          <Route path="/*" element={pages} />
        </Routes>
      </main>

      {!isAdminPage && <Footer />}

      {/* Side Drawers */}
      {!isAdminPage && (
        <>
          <SideDrawer
            isOpen={cartOpen}
            onClose={() => setCartOpen(false)}
            items={cart}
            type="cart"
            onRemove={removeFromCart}
            onQuantityChange={(item, q) => setCart((prev) => fixerQuantite(prev, item, q))}
          />
          <SideDrawer
            isOpen={favOpen}
            onClose={() => setFavOpen(false)}
            items={favorites}
            type="favorites"
            onRemove={removeFavorite}
            onAddToCart={addToCart}
          />
        </>
      )}

    </div>
  );
}

export default App;

