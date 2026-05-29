import productsData from '../data/products.json';

// Module-level cache so the product list is fetched at most once per session.
// On any network failure we fall back to the bundled static JSON.
let cachedPromise = null;

export function getProducts() {
  if (cachedPromise) return cachedPromise;

  cachedPromise = fetch('/api/products')
    .then(res => {
      if (!res.ok) throw new Error('Network response not ok');
      return res.json();
    })
    .catch(err => {
      console.warn('API error fetching products, falling back to local static JSON:', err);
      return productsData.products;
    });

  return cachedPromise;
}
