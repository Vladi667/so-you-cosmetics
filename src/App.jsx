import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
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
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import AboutPage from './pages/AboutPage';
import WorkshopsPage from './pages/WorkshopsPage';
import WorkshopDetailPage from './pages/WorkshopDetailPage';
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
    } else if (category === 'Contact') {
      navigate('/contact');
    } else {
      navigate(`/category/${encodeURIComponent(category)}`);
    }
  };

  const addToCart = (product) => {
    setCart(prev => [...prev, product]);
    const cartIcon = document.getElementById('cart-icon');
    if (cartIcon) {
      cartIcon.style.animation = 'none';
      setTimeout(() => cartIcon.style.animation = 'cartBounce 0.5s ease', 10);
    }
  };

  const removeFromCart = (product, index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const toggleFavorite = (product) => {
    setFavorites(prev => {
      if (prev.find(p => p.id === product.id)) return prev.filter(p => p.id !== product.id);
      return [...prev, product];
    });
    const favIcon = document.getElementById('fav-icon');
    if (favIcon) {
      favIcon.style.animation = 'none';
      setTimeout(() => favIcon.style.animation = 'cartBounce 0.5s ease', 10);
    }
  };

  const removeFavorite = (product) => {
    setFavorites(prev => prev.filter(p => p.id !== product.id));
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    const observeReveals = () => {
      document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    };

    observeReveals();

    const mutationObserver = new MutationObserver((mutations) => {
      let shouldObserve = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) shouldObserve = true;
      });
      if (shouldObserve) {
        observeReveals();
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return (
    <div className="font-sans antialiased text-stone-gray bg-mist-white min-h-screen flex flex-col overflow-x-hidden">
      {!isAdminPage && <PageLoader isVisible={isLoading} />}
      {!isAdminPage && <AbsenceNotice />}
      {!isAdminPage && (
        <Navbar 
          cartCount={cart.length} 
          favCount={favorites.length} 
          onCategorySelect={handleCategorySelect}
          onCartClick={() => setCartOpen(true)}
          onFavClick={() => setFavOpen(true)}
        />
      )}
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/workshops" element={<WorkshopsPage />} />
          <Route path="/workshops/:id" element={<WorkshopDetailPage />} />
          <Route path="/contact" element={<ContactPage />} />
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
          />
          <SideDrawer
            isOpen={favOpen}
            onClose={() => setFavOpen(false)}
            items={favorites}
            type="favorites"
            onRemove={removeFavorite}
          />
        </>
      )}

    </div>
  );
}

export default App;

