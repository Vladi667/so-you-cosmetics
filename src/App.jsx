import React, { useEffect, useState } from 'react';
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
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(!!localStorage.getItem('adminToken'));
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
  const [activeCategory, setActiveCategory] = useState('All');
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

  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  const handleCategorySelect = (category) => {
    if (category === 'All' || category === 'Home') {
      navigate('/');
    } else if (category === 'About Us') {
      navigate('/about');
    } else if (category === 'Workshops') {
      navigate('/workshops');
    } else if (category === 'Journal') {
      navigate('/journal');
    } else if (category === 'Contact') {
      navigate('/contact');
    } else {
      navigate(`/category/${encodeURIComponent(category)}`);
    }
  };

  const addToCart = (product, quantite = 1) => {
    // Fusionne les quantités : six savons font une ligne « ×6 », pas six lignes.
    setCart(prev => ajouter(prev, product, quantite));
    sursautPanier(document.getElementById('cart-icon'));
  };

  const removeFromCart = (product) => {
    // Par identifiant, plus par position : une ligne porte maintenant une
    // quantité, et l'index d'une liste qui fusionne ne désigne plus rien de
    // stable.
    setCart(prev => fixerQuantite(prev, product.id, 0));
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
          onCategorySelect={handleCategorySelect}
          onCartClick={() => { setFavOpen(false); setCartOpen(true); }}
          onFavClick={() => { setCartOpen(false); setFavOpen(true); }}
        />
      )}
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/workshops" element={<WorkshopsPage />} />
          <Route path="/workshops/:id" element={<WorkshopDetailPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/journal/:slug" element={<JournalPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/personnalisation" element={<PersonnalisationPage />} />
          <Route path="/category/:categoryName" element={<CategoryPage addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
          <Route path="/product/:id" element={<ProductPage addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
          <Route path="/search/:query" element={<SearchPage addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route 
            path="/admin" 
            element={
              isAdminLoggedIn ? (
                <AdminDashboard onLogout={() => { localStorage.removeItem('adminToken'); setIsAdminLoggedIn(false); }} />
              ) : (
                <AdminLogin onLoginSuccess={() => setIsAdminLoggedIn(true)} />
              )
            } 
          />
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
            onQuantityChange={(item, q) => setCart((prev) => fixerQuantite(prev, item.id, q))}
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

