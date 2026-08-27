import React, { useState, useEffect, useRef, useId } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { getShipping, shippingCostFor, exigeAdresse, getGiftWrap, modeAutorise } from '../services/shop';
import { totalPanier, nombreArticles } from '../services/panier';
import { Link } from 'react-router-dom';
import useVerrouDefilement from '../hooks/useVerrouDefilement';

const CHAMP_CAISSE = 'w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40';

const SideDrawer = ({ isOpen, onClose, items, type, onRemove, onQuantityChange, onAddToCart }) => {
  const { t } = useLanguage();
  const title = type === 'cart' ? t('drawer.cartTitle') : t('drawer.favTitle');
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [sumupCheckoutId, setSumupCheckoutId] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const shipping = getShipping();
  const [shippingId, setShippingId] = useState('');
  // L'adresse de livraison n'etait demandee nulle part, alors que huit des neuf
  // modes d'expedition sont postaux : elle devait ecrire a chaque cliente apres
  // paiement pour savoir ou envoyer le colis.
  const [adresse, setAdresse] = useState({ line1: '', line2: '', zip: '', city: '', country: 'CH' });
  // Decochee par defaut, et bloquante : une acceptation pre-cochee n'en est pas
  // une, et c'est le seul bouton du site qui declenche un paiement.
  const [cgvAcceptees, setCgvAcceptees] = useState(false);

  // Un panier contenant un bon cadeau demande à qui il est destiné. La question
  // n'a pas de sens autrement, et l'imposer à toutes les commandes ferait
  // trois champs de plus à ignorer pour tout le monde.
  const contientBonCadeau = items.some((i) => i.bonCadeau);
  // Une recharge suppose qu'on apporte son flacon : elle se retire forcément.
  // On l'impose ici, et le serveur le revérifie — l'interface ne décide pas de
  // ce qui est expédiable.
  const contientRecharge = items.some((i) => i.recharge);
  const emballageCadeau = getGiftWrap();
  const [cadeau, setCadeau] = useState({ destinataire: '', email: '', message: '', date: '', emballage: false });
  // Ne s'affiche qu'apres une tentative : reprocher a quelqu'un de ne pas avoir
  // coche une case qu'il n'a pas encore vue est un reproche gratuit.
  const [tentativeSansCgv, setTentativeSansCgv] = useState(false);

  // La page ne doit pas defiler derriere le tiroir. Voir le compteur du hook :
  // le menu mobile peut etre ouvert en meme temps.
  useVerrouDefilement(isOpen);

  const titreId = useId();
  const panneauRef = useRef(null);
  const declencheurRef = useRef(null);

  // Ouverture et fermeture au clavier.
  //
  // Le tiroir n'etait qu'une boite qui glisse : rien ne disait aux technologies
  // d'assistance que le reste de la page passait derriere, Echap ne le fermait
  // pas, et le focus restait ou il etait — sur un element devenu invisible mais
  // toujours atteignable a la tabulation.
  useEffect(() => {
    if (!isOpen) return undefined;

    // A qui rendre le focus a la fermeture : ce qu'on a quitte en ouvrant.
    declencheurRef.current = document.activeElement;

    const auClavier = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', auClavier);

    // Apres la transition d'entree : deplacer le focus vers un panneau encore
    // hors de l'ecran ferait sauter la page a sa poursuite.
    const arrivee = setTimeout(() => {
      panneauRef.current?.querySelector('[data-titre-tiroir]')?.focus();
    }, 120);

    return () => {
      document.removeEventListener('keydown', auClavier);
      clearTimeout(arrivee);
      // Rendu a son point de depart, si cet element existe encore.
      const cible = declencheurRef.current;
      if (cible && document.contains(cible) && typeof cible.focus === 'function') {
        cible.focus();
      }
    };
  }, [isOpen, onClose]);

  // Reset checkout states when drawer opens/closes
  useEffect(() => {
    if (isOpen) return;
    // Le nettoyage manquait : fermer le panier par erreur pendant un paiement
    // puis rouvrir en moins d'une demi-seconde faisait disparaître le formulaire
    // de carte et effaçait le nom et l'e-mail déjà saisis.
    const id = setTimeout(() => {
      setIsCheckoutMode(false);
      setCheckoutSuccess(false);
      setCheckoutError(null);
      setSumupCheckoutId(null);
      setOrderId(null);
      setCheckoutForm({ name: '', email: '' });
      setAdresse({ line1: '', line2: '', zip: '', city: '', country: 'CH' });
      setCgvAcceptees(false);
      setTentativeSansCgv(false);
      setCadeau({ destinataire: '', email: '', message: '', date: '', emballage: false });
    }, 500); // le temps de la transition de fermeture
    return () => clearTimeout(id);
  }, [isOpen]);

  const getImageUrl = (product) => {
    if (product.imageUrl) return product.imageUrl;
    if (product['Variant Image']) return product['Variant Image'];
    if (product.images && product.images.length > 0) return product.images[0];
    return '';
  };

  useEffect(() => {
    if (sumupCheckoutId && window.SumUpCard) {
      window.SumUpCard.mount({
        id: 'sumup-card',
        checkoutId: sumupCheckoutId,
        onResponse: function (type, body) {
          console.log('SumUp Response:', type, body);
          if (type === 'success') {
            setCheckoutSuccess(true);
            setSumupCheckoutId(null);
            // Tell the shop straight away rather than waiting on SumUp's
            // webhook. The server does not take our word for it — it asks
            // SumUp — so this only shortens the delay, it cannot fake a
            // payment. If this request never lands, the webhook still does.
            if (orderId) {
              fetch(`/api/orders/${orderId}/confirm`, { method: 'POST' })
                .catch(err => console.error('Confirmation request failed:', err));
            }
          }
        },
      });
    }
  }, [sumupCheckoutId, orderId]);

  const getPrice = (product) => {
    return product.price || product['Variant Price'] || 0;
  };

  const getName = (product) => {
    return product.name || product['Product Name'] || product['Name'] || t('drawer.productFallback');
  };

  // Une seule fonction de total, partagee avec le pied des favoris. Deux
  // reduce ecrits separement finissent par diverger, et c'est le montant
  // montre a quelqu'un qui s'apprete a payer.
  const total = totalPanier(items);

  // Ce qui sera réellement débité. Le serveur facture marchandise + expédition
  // (server/routes.js, computeOrderTotal) ; le récapitulatif n'affichait que la
  // marchandise. La cliente lisait CHF 46.00 et sa carte était débitée de
  // CHF 59.00 — un écart de facturation, et une infraction à l'obligation
  // suisse d'annoncer le prix effectivement à payer.
  // Les modes que CETTE commande peut réellement prendre. Deux règles s'y
  // composent : une recharge se retire en boutique, et les quatre tarifs
  // « Bon cadeau uniquement » ne valent que pour un panier de bons. Les
  // afficher pour les refuser à la validation ferait remplir tout le
  // formulaire avant de dire non.
  const modesProposes = shipping.options.filter(
    (o) => (!contientRecharge || !exigeAdresse(o.id)) && modeAutorise(o.id, items)
  );

  const optionChoisie = modesProposes.find((o) => o.id === shippingId) || null;
  const fraisPort = shippingCostFor(optionChoisie, total);
  // Le meme calcul que le serveur : marchandise + port + emballage. Afficher un
  // total qui ignore le supplement rejouerait le defaut des frais de port, ou
  // le client voyait CHF 46 et payait CHF 59.
  const supplementCadeau = cadeau.emballage && emballageCadeau.enabled ? emballageCadeau.price : 0;
  const totalAPayer = total + fraisPort + supplementCadeau;

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();

    // Rien ne part tant que les conditions ne sont pas acceptees. Le message
    // est celui du site, dans la langue du site : la validation native du
    // navigateur parle la sienne, qui n'est pas forcement la meme.
    if (!cgvAcceptees) {
      setTentativeSansCgv(true);
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    // Le total n'est plus envoyé : le serveur le recalcule depuis le catalogue
    // et la table des tarifs. Le navigateur choisit le mode d'expédition, jamais
    // son prix.
    const orderPayload = {
      name: checkoutForm.name,
      email: checkoutForm.email,
      shippingId,
      // Nulle pour un retrait : il n'y a rien a expedier. Le serveur refait le
      // meme controle — le navigateur ne decide pas de ce qui est exigible.
      address: exigeAdresse(shippingId) ? adresse : null,
      cadeau: (contientBonCadeau || cadeau.emballage) ? cadeau : null,
      // Le serveur refait le contrôle et date l'acceptation dans la commande :
      // la case ci-dessus bloque le bouton, elle ne prouve rien à elle seule.
      cgvAcceptees: true,
      items: items.map(item => ({
        id: item.id,
        name: getName(item),
        qty: item.qty || 1,
        price: getPrice(item),
        // Le drapeau, pas le prix : le serveur lira le tarif de recharge dans
        // le catalogue. Le navigateur demande une variante, il ne la chiffre pas.
        recharge: Boolean(item.recharge)
      }))
    };

    fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    })
      .then(async (res) => {
        if (!res.ok) {
          const e = new Error('Order creation failed');
          e.panier = res.status === 400;
          // Le serveur explique ce qui manque — adresse incomplete, mode
          // d'expedition disparu. Le taire obligerait a deviner.
          e.message400 = await res.json().then((d) => d && d.error).catch(() => null);
          throw e;
        }
        return res.json();
      })
      .then(data => {
        setIsSubmitting(false);
        setOrderId(data.orderId);
        if (data.checkoutId && !data.checkoutId.startsWith('mock_')) {
          setSumupCheckoutId(data.checkoutId);
        } else {
          setCheckoutSuccess(true);
        }
      })
      .catch(err => {
        console.error('Checkout error:', err);
        setIsSubmitting(false);
        // Surtout pas de succès de repli ici. Il affichait la coche verte et
        // « nous vous avons envoyé un récapitulatif » alors qu'aucune commande
        // n'existait et qu'aucun e-mail ne partait : la cliente attendait un
        // colis qui n'arriverait jamais, et personne n'était au courant.
        setCheckoutError(err && err.message400 ? err.message400 : (err && err.panier ? 'panier' : 'technique'));
      });
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>

      {/* Drawer */}
      {/* Le panneau n'etait pas une colonne flexible : le `flex-1` de son corps
          ne produisait donc rien, et la hauteur du corps etait ecrite en dur —
          `calc(100vh - 200px)`, soit l'estimation d'un en-tete et d'un pied qui
          ont depuis change de taille. Des que le pied depassait, la derniere
          ligne du panier passait dessous.
          `100dvh` plutot que `100vh` : sur mobile, `100vh` compte la barre
          d'adresse comme si elle n'existait pas, et le bouton « Commander » se
          retrouvait sous le bord de l'ecran. */}
      {/* `inert` retire tout le sous-arbre du parcours de tabulation et du
          calque d'accessibilite quand le tiroir est ferme. Sans lui, le panneau
          reste hors de l'ecran mais atteignable : on tabulait dans un formulaire
          de paiement invisible. `|| undefined` parce que React n'ecrit
          l'attribut que s'il n'est pas false. */}
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        inert={!isOpen || undefined}
        className={`fixed top-0 right-0 z-[70] flex h-[100dvh] w-full max-w-md flex-col bg-ivory shadow-2xl transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-stone/10">
          {/* `tabIndex={-1}` : le titre n'entre pas dans le parcours de
              tabulation, mais peut recevoir le focus par programme. C'est le
              point d'arrivee : on annonce ou l'on vient d'entrer avant de lire
              le contenu. */}
          <h2
            id={titreId}
            data-titre-tiroir
            tabIndex={-1}
            className="font-serif text-2xl text-slate-stone outline-none"
          >
            {checkoutSuccess ? t('drawer.thanks') : isCheckoutMode ? t('drawer.finalize') : title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('drawer.close')}
            className="press w-10 h-10 rounded-full bg-mist-white flex items-center justify-center hover:bg-slate-stone hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
          {checkoutSuccess ? (
            /* Checkout Success State */
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 text-green-500 animate-bounce">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-serif text-xl text-slate-stone mb-2">{t('drawer.orderConfirmed')}</h3>
              <p className="font-sans text-stone-gray/60 text-sm max-w-xs mx-auto">
                {t('drawer.orderConfirmedText')}
              </p>
              <button
                onClick={onClose}
                className="mt-8 px-8 py-3 bg-slate-stone text-white font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-slate-stone/90 press"
              >
                {t('drawer.close')}
              </button>
            </div>
          ) : sumupCheckoutId ? (
            /* SumUp Payment Widget */
            <div className="pt-4">
              <h3 className="font-serif text-xl text-slate-stone mb-4 text-center">{t('drawer.securePayment')}</h3>
              <div id="sumup-card"></div>
              <button
                type="button"
                onClick={() => setSumupCheckoutId(null)}
                className="mt-6 w-full py-3 bg-transparent text-stone-gray/60 font-sans uppercase tracking-[0.2em] text-[10px] rounded-full hover:text-slate-stone transition-all"
              >
                {t('drawer.cancel')}
              </button>
            </div>
          ) : isCheckoutMode ? (
            /* Checkout Form Screen */
            <>
            {checkoutError && (
              <div className="mb-5 p-4 bg-[#F5EDE0] border border-[#E0CFB0] rounded-2xl">
                <p className="font-sans text-sm font-medium text-[#8A6A3B] mb-1">{t('drawer.orderFailedTitle')}</p>
                {/* Quand le serveur dit ce qui manque — une adresse incomplete,
                    un mode d'expedition qui n'existe plus — on le rapporte tel
                    quel. « Une erreur est survenue » n'aide personne a corriger. */}
                <p className="font-sans text-xs text-stone-gray mb-3">
                  {checkoutError !== 'panier' && checkoutError !== 'technique'
                    ? checkoutError
                    : t('drawer.orderFailedText')}
                </p>
                <p className="font-sans text-xs text-stone-gray">
                  <a href="tel:+41225566992" className="underline underline-offset-2">022 556 69 92</a>
                  {' · '}
                  <a href="mailto:contact@soyoucosmetics.com" className="underline underline-offset-2">contact@soyoucosmetics.com</a>
                </p>
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} className="space-y-6 pt-4">
              {contientRecharge && (
                <p className="rounded-2xl bg-mist-white px-4 py-3 font-sans text-xs leading-relaxed text-stone-gray">
                  {t('drawer.refillPickupOnly')}
                </p>
              )}

              {modesProposes.length > 0 && (
                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">
                    {t('drawer.shippingTitle')}
                  </label>
                  <div className="space-y-2">
                    {modesProposes.map((o) => {
                      const cout = shippingCostFor(o, total);
                      const offert = cout === 0 && Number(o.price) > 0;
                      return (
                        <label key={o.id} className="flex items-start gap-3 bg-mist-white border border-slate-stone/10 rounded-2xl px-4 py-3 cursor-pointer hover:border-slate-stone/30 transition-colors">
                          <input
                            type="radio"
                            name="shipping"
                            required
                            checked={shippingId === o.id}
                            onChange={() => setShippingId(o.id)}
                            className="mt-1"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block font-sans text-sm text-slate-stone">{o.label}</span>
                            {o.note && <span className="block font-sans text-[11px] text-stone-gray/80">{o.note}</span>}
                          </span>
                          <span className="font-sans text-sm text-slate-stone whitespace-nowrap">
                            {cout === 0 ? (offert ? t('drawer.shippingFree') : t('drawer.shippingIncluded')) : `CHF ${cout.toFixed(2)}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {shipping.freeFrom > 0 && (
                    <p className="mt-2 font-sans text-[11px] text-stone-gray">
                      {t('drawer.shippingFreeFrom', { amount: shipping.freeFrom })}
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">{t('drawer.fullName')}</label>
                <input
                  type="text"
                  required
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                  placeholder={t('drawer.yourName')}
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 transition-all"
                />
              </div>
              
              <div>
                <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">{t('drawer.email')}</label>
                <input 
                  type="email" 
                  required
                  value={checkoutForm.email}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                  placeholder="votre@email.com"
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 transition-all"
                />
              </div>

              {/* L'adresse n'apparait que si le colis part. Pour un retrait en
                  boutique, la demander serait reclamer une donnee dont on n'a
                  aucun usage. */}
              {exigeAdresse(shippingId) ? (
                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">
                    {t('drawer.addressTitle')}
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      required
                      autoComplete="address-line1"
                      value={adresse.line1}
                      onChange={(e) => setAdresse({ ...adresse, line1: e.target.value })}
                      placeholder={t('drawer.addressLine1')}
                      className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 transition-all"
                    />
                    <input
                      type="text"
                      autoComplete="address-line2"
                      value={adresse.line2}
                      onChange={(e) => setAdresse({ ...adresse, line2: e.target.value })}
                      placeholder={t('drawer.addressLine2')}
                      className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 transition-all"
                    />
                    <div className="flex gap-3">
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        autoComplete="postal-code"
                        value={adresse.zip}
                        onChange={(e) => setAdresse({ ...adresse, zip: e.target.value })}
                        placeholder={t('drawer.addressZip')}
                        className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 transition-all w-1/3"
                      />
                      <input
                        type="text"
                        required
                        autoComplete="address-level2"
                        value={adresse.city}
                        onChange={(e) => setAdresse({ ...adresse, city: e.target.value })}
                        placeholder={t('drawer.addressCity')}
                        className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 transition-all w-2/3"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="font-sans text-xs text-stone-gray">{t('drawer.addressPickup')}</p>
              )}

              {contientBonCadeau && (
                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">
                    {t('drawer.giftTitle')}
                  </label>
                  <div className="space-y-3">
                    <input type="text" value={cadeau.destinataire}
                      onChange={(e) => setCadeau({ ...cadeau, destinataire: e.target.value })}
                      placeholder={t('drawer.giftRecipient')} className={CHAMP_CAISSE} />
                    <input type="email" value={cadeau.email}
                      onChange={(e) => setCadeau({ ...cadeau, email: e.target.value })}
                      placeholder={t('drawer.giftRecipientEmail')} className={CHAMP_CAISSE} />
                    <div>
                      <textarea rows={3} maxLength={200} value={cadeau.message}
                        onChange={(e) => setCadeau({ ...cadeau, message: e.target.value })}
                        placeholder={t('drawer.giftMessage')} className={CHAMP_CAISSE} />
                      <p className="mt-1 text-right font-sans text-[10px] text-stone-gray/60 tabular-nums">
                        {cadeau.message.length} / 200
                      </p>
                    </div>
                    <div>
                      <label className="block font-sans text-[10px] uppercase tracking-[0.16em] text-stone-gray/70 mb-1">
                        {t('drawer.giftDate')}
                      </label>
                      <input type="date" value={cadeau.date}
                        onChange={(e) => setCadeau({ ...cadeau, date: e.target.value })}
                        className={CHAMP_CAISSE} />
                      {/* Dit franchement : le bon part tout de suite, la date
                          est imprimee dessus. Un envoi differe demanderait une
                          file d'attente que rien ici ne porte, et promettre un
                          envoi qui n'arrive pas serait pire que ne rien dire. */}
                      <p className="mt-1 font-sans text-[11px] leading-relaxed text-stone-gray/80">
                        {t('drawer.giftDateNote')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {emballageCadeau.enabled && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={cadeau.emballage}
                    onChange={(e) => setCadeau({ ...cadeau, emballage: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-slate-stone" />
                  <span className="font-sans text-xs leading-relaxed text-stone-gray">
                    {t('drawer.giftWrapOffer', { price: emballageCadeau.price.toFixed(2) })}
                  </span>
                </label>
              )}

              <div className="bg-mist-white rounded-2xl p-4 border border-slate-stone/5">
                <h4 className="font-sans text-xs font-bold text-slate-stone uppercase tracking-wider mb-2">{t('drawer.orderDetails')}</h4>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-stone-gray font-light">
                      <span className="truncate pr-3">
                        {getName(item)}{(item.qty || 1) > 1 && <span className="text-slate-stone"> × {item.qty}</span>}
                      </span>
                      <span className="tabular-nums whitespace-nowrap">CHF {(parseFloat(getPrice(item)) * (item.qty || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-slate-stone/10 my-3"></div>
                <div className="flex justify-between font-sans text-xs text-stone-gray">
                  <span>{t('drawer.subtotal')}</span>
                  <span className="tabular-nums">CHF {total.toFixed(2)}</span>
                </div>
                {optionChoisie && (
                  <div className="flex justify-between font-sans text-xs text-stone-gray mt-1">
                    <span className="truncate pr-3">{t('drawer.shippingLine')} — {optionChoisie.label}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      {fraisPort === 0 ? t('drawer.shippingIncluded') : `CHF ${fraisPort.toFixed(2)}`}
                    </span>
                  </div>
                )}
                {cadeau.emballage && emballageCadeau.enabled && (
                  <div className="flex justify-between font-sans text-xs text-stone-gray mt-1">
                    <span>{t('drawer.giftWrapLine')}</span>
                    <span className="tabular-nums">CHF {emballageCadeau.price.toFixed(2)}</span>
                  </div>
                )}
                <div className="h-px bg-slate-stone/10 my-3"></div>
                <div className="flex justify-between font-sans text-base font-medium text-slate-stone">
                  <span>{t('drawer.totalToPay')}</span>
                  <span className="tabular-nums">CHF {totalAPayer.toFixed(2)}</span>
                </div>
              </div>

              {/* Le lien s'ouvre dans un onglet neuf : le lire ne doit pas
                  couter la saisie deja faite. */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cgvAcceptees}
                  onChange={(e) => setCgvAcceptees(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-slate-stone"
                />
                <span className="font-sans text-xs leading-relaxed text-stone-gray">
                  {t('drawer.acceptTerms')}{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-stone underline underline-offset-2 hover:text-stone-gray"
                  >
                    {t('drawer.acceptTermsLink')}
                  </a>.
                </span>
              </label>

              {!cgvAcceptees && tentativeSansCgv && (
                <p role="alert" className="font-sans text-xs text-red-600">{t('drawer.termsRequired')}</p>
              )}

              <div className="pt-4 flex flex-col gap-3">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-slate-stone text-white font-sans uppercase tracking-[0.3em] text-xs rounded-full hover:bg-slate-stone/90 shadow-lg press"
                >
                  {isSubmitting ? t('drawer.processing') : t('drawer.validateOrder')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCheckoutMode(false)}
                  className="w-full py-3 bg-transparent text-stone-gray/60 font-sans uppercase tracking-[0.2em] text-[10px] rounded-full hover:text-slate-stone transition-all"
                >
                  {t('drawer.backToCart')}
                </button>

                {/* Trois lignes qui repondent aux questions qu'on se pose juste
                    avant de payer : qui prend ma carte, quand j'aurai le colis,
                    a qui je m'adresse si ca tourne mal. Elles ne disent que ce
                    que le site affirme deja ailleurs. */}
                <ul className="mt-2 space-y-1.5 font-sans text-[11px] leading-relaxed text-stone-gray/80">
                  <li>{t('drawer.trustPayment')}</li>
                  <li>{t('drawer.trustMade')}</li>
                  <li>{t('drawer.trustContact')}</li>
                </ul>
              </div>
            </form>
            </>
          ) : items.length === 0 ? (
            /* Empty Drawer State */
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-20 h-20 bg-mist-white rounded-full flex items-center justify-center mb-6">
                {type === 'cart' ? (
                  <svg className="w-8 h-8 text-slate-stone/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-slate-stone/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
              </div>
              <p className="font-sans text-stone-gray/60 text-sm">
                {type === 'cart' ? t('drawer.emptyCart') : t('drawer.emptyFav')}
              </p>
            </div>
          ) : (
            /* Cart Items List */
            <div className="space-y-6">
              {items.map((item, index) => (
                <div 
                  key={`${item.id || index}-${index}`} 
                  className="flex gap-4 sm:gap-5 group bg-mist-white/50 rounded-2xl p-3 sm:p-4 hover:bg-mist-white transition-colors duration-200"
                >
                  {getImageUrl(item) && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-mist-white">
                      <img 
                        src={getImageUrl(item)} 
                        alt={getName(item)} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {/* Un favori mene a sa fiche. Sans cela on ne pouvait plus
                        rien en faire : ni le relire, ni voir ses photos. Le
                        tiroir se ferme, sinon il reste ouvert par-dessus la
                        page qu'on vient de demander. */}
                    {type === 'favorites' ? (
                      <Link
                        to={`/product/${item.id}`}
                        onClick={onClose}
                        className="font-sans text-sm font-medium text-slate-stone hover:text-stone-gray transition-colors line-clamp-2"
                      >
                        {getName(item)}
                      </Link>
                    ) : (
                      <h4 className="font-sans text-sm font-medium text-slate-stone truncate">{getName(item)}</h4>
                    )}

                    {/* Le prix de ligne en clair. « CHF 12.90 » sur une ligne de
                        deux articles laissait le lecteur faire le calcul, puis
                        douter du sous-total. */}
                    {type === 'cart' && (item.qty || 1) > 1 ? (
                      <p className="font-sans text-xs text-stone-gray/60 mt-1 tabular-nums">
                        {item.qty} × CHF {parseFloat(getPrice(item)).toFixed(2)} ={' '}
                        <span className="text-slate-stone">CHF {(parseFloat(getPrice(item)) * item.qty).toFixed(2)}</span>
                      </p>
                    ) : (
                      <p className="font-sans text-xs text-stone-gray/60 mt-1 tabular-nums">
                        CHF {parseFloat(getPrice(item)).toFixed(2)}
                      </p>
                    )}

                    {type === 'cart' && onQuantityChange && (
                      // Le compteur remplace la corbeille. Retirer une unite sur
                      // trois obligeait a tout supprimer puis a rajouter deux
                      // fois ; et zero retire la ligne, ce qui rend la corbeille
                      // superflue sans rien perdre.
                      <div className="mt-2 inline-flex items-center gap-3 rounded-full border border-slate-stone/15 bg-ivory px-3 py-1">
                        <button
                          type="button"
                          onClick={() => onQuantityChange(item, (item.qty || 1) - 1)}
                          aria-label={t('drawer.decrease')}
                          className="press text-stone-gray hover:text-slate-stone"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                        </button>
                        <span className="font-sans text-xs tabular-nums min-w-4 text-center">{item.qty || 1}</span>
                        <button
                          type="button"
                          onClick={() => onQuantityChange(item, (item.qty || 1) + 1)}
                          aria-label={t('drawer.increase')}
                          className="press text-stone-gray hover:text-slate-stone"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        </button>
                      </div>
                    )}

                    {type === 'favorites' && onAddToCart && (
                      <button
                        type="button"
                        onClick={() => onAddToCart(item, 1)}
                        className="press mt-2 rounded-full bg-slate-stone px-4 py-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-white"
                      >
                        {t('product.addToCart')}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onRemove(item)}
                    aria-label={t('drawer.removeLine')}
                    className="press w-8 h-8 rounded-full flex items-center justify-center text-stone-gray/40 hover:bg-red-50 hover:text-red-500 flex-shrink-0 self-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Le pied des favoris. Le total vient de la MEME fonction que le
            sous-total du panier : un second calcul finirait par annoncer un
            montant que la caisse ne confirme pas. */}
        {type === 'favorites' && items.length > 0 && onAddToCart && (
          <div className="shrink-0 px-4 sm:px-8 py-4 sm:py-6 border-t border-slate-stone/10 bg-ivory">
            <button
              type="button"
              onClick={() => { items.forEach((i) => onAddToCart(i, 1)); onClose(); }}
              className="press w-full rounded-full bg-slate-stone py-4 font-sans text-xs uppercase tracking-[0.2em] text-white"
            >
              {t('drawer.addAllToCart', { n: nombreArticles(items), total: total.toFixed(2) })}
            </button>
          </div>
        )}

        {/* Footer */}
        {type === 'cart' && items.length > 0 && !isCheckoutMode && !checkoutSuccess && (
          <div className="shrink-0 px-4 sm:px-8 py-4 sm:py-6 border-t border-slate-stone/10 bg-ivory">
            <div className="flex justify-between items-center mb-6">
              <span className="font-sans text-sm text-stone-gray">{t('drawer.subtotal')}</span>
              <span className="font-serif text-2xl text-slate-stone tabular-nums">
                CHF {total.toFixed(2)}
              </span>
            </div>
            <button 
              onClick={() => setIsCheckoutMode(true)}
              className="press w-full py-4 bg-slate-stone text-white font-sans uppercase tracking-[0.3em] text-xs rounded-full hover:bg-slate-stone/90 shadow-lg hover:shadow-xl"
            >
              {t('drawer.order')}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default SideDrawer;
