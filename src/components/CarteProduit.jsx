import React from 'react';
import Lien from './Lien';
import { imageUrl, imageSrcSet } from '../services/products';
import ProductBadge from './ProductBadge';
import ProductPlaceholder from './ProductPlaceholder';

// La carte d'un produit, telle qu'elle paraît sur la grille.
//
// Elle vivait à l'intérieur de Catalog.jsx, mêlée au panier et aux favoris.
// L'administration a maintenant besoin de la MÊME carte pour montrer à la
// cliente ce que sa saisie donnera — et un aperçu qui recopierait ces classes
// mentirait dès la première retouche du catalogue. On sort donc ce qui se
// REGARDE ; ce qui s'actionne — cœur, panier, confirmation d'ajout — reste
// chez l'appelant et arrive par `actions`.
//
// `lien` absent : la carte ne navigue plus. C'est le cas de l'aperçu, où un
// clic n'aurait nulle part où aller.
function CarteProduit({
  produit,
  lien = null,
  t,
  tCategory = (c) => c,
  actions = null,
  enfants = null,
}) {
  const sansPhoto = !produit.images || produit.images.length === 0;

  // Enveloppe cliquable, ou rien du tout selon qu'on ait une destination.
  const Vers = ({ className, children }) =>
    lien ? <Lien to={lien} className={className}>{children}</Lien> : <div className={className}>{children}</div>;

  // « dès CHF X » quand la fiche décline plusieurs prix : les senteurs d'une
  // même recette, ou les contenances d'un même soin. Annoncer « CHF 33.50 »
  // tout court pour un produit qui monte à 82.50 se découvrirait sur la fiche,
  // et se lirait comme un appât.
  const prixVarie = produit.prixVariable
    || (Array.isArray(produit.variantes)
        && produit.variantes.length > 1
        && new Set(produit.variantes.map((v) => Number(v.prix))).size > 1);

  return (
    <div className="group relative flex flex-col bg-ivory rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-shadow duration-250 apparait">
      <div className="aspect-[4/5] w-full overflow-hidden bg-lake-mist relative">
        {/* `sizes` décrit la grille : deux colonnes sur téléphone, trois puis
            quatre ensuite. Sans lui, le navigateur suppose que l'image occupe
            toute la largeur et prend la plus grande du lot — soit, sur une
            carte de 180 px, huit fois les octets utiles. */}
        {sansPhoto ? <ProductPlaceholder /> : (
          <img
            src={imageUrl(produit.images[0], 800)}
            srcSet={imageSrcSet(produit.images[0], 800)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            alt={produit.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
          />
        )}
        {produit.ribbon && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
            <ProductBadge ribbon={produit.ribbon} />
          </div>
        )}
        {produit.inStock === false && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
            <span className="inline-block bg-red-600/95 text-white text-[9px] sm:text-xs tracking-widest uppercase px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm font-medium">
              {t('catalog.outOfStock')}
            </span>
          </div>
        )}
        {/* Hover Overlay — on mobile the card image is directly tappable */}
        {lien && (
          <Lien to={lien} className="absolute inset-0 bg-slate-stone/10 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center md:backdrop-blur-[2px]">
            <span className="transform translate-y-4 md:group-hover:translate-y-0 opacity-0 md:group-hover:opacity-100 transition-all duration-250 bg-ivory text-slate-stone px-8 py-3 rounded-full font-medium tracking-wide shadow-lg hover:bg-slate-stone hover:text-white hidden md:inline">
              {t('catalog.viewDetails')}
            </span>
          </Lien>
        )}
      </div>

      <div className="p-3 sm:p-6 flex flex-col flex-grow">
        <div className="mb-2">
          <p className="text-[9px] sm:text-xs text-slate-stone/60 uppercase tracking-widest mb-0.5 sm:mb-1 truncate">
            {produit.collections && produit.collections[0]
              ? tCategory(produit.collections[0])
              : t('catalog.cosmeticsFallback')}
          </p>
          <Vers>
            <h3 className="text-sm sm:text-lg font-serif text-slate-stone leading-tight line-clamp-2 hover:text-stone-gray transition-colors">
              {produit.name}
            </h3>
          </Vers>
          {/* La contenance, sous le nom.
              Elle était saisie sur 104 fiches et n'apparaissait nulle part en
              boutique. Or c'est souvent la seule chose qui distingue deux fiches
              voisines : « Absolute » existe en 15, 30 et 50 ml, sous un nom trop
              long pour que la mention tienne dans les deux lignes du titre.
              Trois vignettes identiques, à trois prix — la cliente l'a signalé,
              et le titre tronqué ne pouvait pas y répondre. Le champ dédié, lui,
              ne se fait jamais couper. */}
          {produit.contenance && (
            <p className="mt-1 font-sans text-[10px] sm:text-xs text-stone-gray/80 tracking-wide">
              {produit.contenance}
            </p>
          )}
          {/* Le nombre de senteurs, pas la liste : sur une carte de catalogue,
              quinze noms de parfums ne se lisent pas. */}
          {produit.estRecette && (
            <p className="mt-1 font-sans text-[10px] sm:text-xs text-stone-gray/70">
              {t('catalog.scentCount', { n: produit.membres.length })}
            </p>
          )}
        </div>

        <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between border-t border-slate-stone/10">
          {/* Quatre fiches du catalogue sont a CHF 0 : les trois « Collection »
              et « Commande personnalisee ». Elles ne valent pas zero franc,
              elles n'ont pas de prix fixe — c'est le « sur devis » de son propre
              texte. Affiche « CHF 0.00 », on pouvait les commander pour le seul
              prix du port. */}
          <p className="text-slate-stone text-xs sm:text-base font-medium tracking-wide">
            {Number(produit.price) > 0
              ? (prixVarie
                  ? t('catalog.fromPrice', { price: Number(produit.price).toFixed(2) })
                  : `CHF ${Number(produit.price).toFixed(2)}`)
              : t('catalog.onQuote')}
          </p>
          <div className="flex space-x-2 sm:space-x-3">
            {actions}
          </div>
        </div>
      </div>

      {enfants}
    </div>
  );
}

export default CarteProduit;
