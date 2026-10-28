import React, { useState, useEffect } from 'react';
import ContentEditor from './admin/ContentEditor';
import ShopSettings from './admin/ShopSettings';
import RichTextEditor from './admin/RichTextEditor';
import JournalEditor from './admin/JournalEditor';
import InfolettreEditor from './admin/InfolettreEditor';
import PaniersAbandonnes from './admin/PaniersAbandonnes';
import ApercuFiche from './ApercuFiche';
import { imageUrl } from '../services/products';
import { SHOP_CATEGORIES } from '../data/categories';

// Order status has been written in mixed case over the life of the shop
// ('paid' from the payment paths, 'Paid' from the admin dropdown). Compare on
// a folded key so a paid order is never displayed as "En attente".
const statusKey = (s) => String(s || '').toLowerCase();

// Le marqueur qui remonte un produit en page d'accueil. Ce n'est pas une
// rubrique — il se range avec les catégories parce qu'il se saisit au même
// endroit, mais il est présenté à part pour qu'on ne le confonde pas.
const COUP_DE_COEUR = 'Coup de cœur';

// Les rubriques d'une fiche, telles qu'elle les a tapées.
const listeCategories = (texte) =>
  String(texte || '').split(',').map((s) => s.trim()).filter(Boolean);

// La comparaison ignore la casse, les accents et la ligature : « maquillage »,
// « Maquillage » et « MAQUILLAGE » désignent la même rubrique, et « Coup de
// coeur » vaut « Coup de cœur ».
const plier = (v) =>
  String(v || '').trim().toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

const aLaCategorie = (texte, nom) =>
  listeCategories(texte).some((c) => plier(c) === plier(nom));

// Ajoute ou retire, en écrivant toujours la forme exacte de la liste de
// référence : c'est tout l'intérêt du bouton par rapport à la saisie.
const basculerCategorie = (texte, nom) => {
  const liste = listeCategories(texte);
  const i = liste.findIndex((c) => plier(c) === plier(nom));
  if (i >= 0) liste.splice(i, 1);
  else liste.push(nom);
  return liste.join(', ');
};

// Les produits proposables en « Vous aimerez aussi », filtrés et rangés.
// Renvoie des groupes [titre, produits] : un seul sans titre en ordre
// alphabétique, un par rubrique sinon. La rubrique est la première de la fiche
// qui n'est pas le marqueur « Coup de cœur ».
const groupesLies = (products, form, recherche, classement) => {
  const cle = plier(recherche);
  const deja = new Set([form.id, ...(form.related || [])]);
  const alpha = (a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' });
  const liste = products
    .filter((p) => !deja.has(p.id))
    .filter((p) => !cle || plier(`${p.name} ${p.contenance || ''}`).includes(cle))
    .sort((a, b) => alpha(a.name, b.name));
  if (classement !== 'categorie') return liste.length ? [['', liste]] : [];
  const groupes = new Map();
  for (const p of liste) {
    const rubrique = (p.collections || []).find((c) => plier(c) !== plier(COUP_DE_COEUR)) || 'Sans catégorie';
    if (!groupes.has(rubrique)) groupes.set(rubrique, []);
    groupes.get(rubrique).push(p);
  }
  return [...groupes].sort(([a], [b]) => alpha(a, b));
};

// Les sections de la fiche, et ce qui compte comme rempli dans chacune.
//
// Le compteur n'est pas une note : il dit ce qui reste, pour qu'une section
// repliée dans le défilement ne se fasse pas oublier. Seuls les champs qui
// pèsent vraiment sur la boutique ou sur le référencement sont comptés — un
// champ facultatif absent du compte n'est pas un reproche.
const remplie = (v) => String(v == null ? '' : v).trim() !== '';

const SECTIONS_FICHE = [
  { id: 'identite', titre: 'Identité', total: 5, remplis: (f) =>
      [remplie(f.name), remplie(f.price), remplie(f.ordre), remplie(f.ribbon), remplie(f.collectionsText)].filter(Boolean).length },
  { id: 'photos', titre: 'Photos', total: 1, remplis: (f) => ((f.images || []).length ? 1 : 0) },
  { id: 'format', titre: 'Format et poids', total: 1, remplis: (f) => {
      const formats = (f.variantes || []).filter((v) => remplie(v.libelle) && Number(v.prix) > 0);
      return (formats.length > 1 || remplie(f.contenance)) ? 1 : 0;
    } },
  { id: 'texte', titre: 'Texte', total: 3, remplis: (f) =>
      [remplie(String(f.description || '').replace(/<[^>]*>/g, '')), remplie(f.ingredients), remplie(f.inci)].filter(Boolean).length },
  { id: 'decouverte', titre: 'Découverte', total: 4, remplis: (f) =>
      [remplie(f.typePeauText), remplie(f.besoinsText), remplie(f.etiquettesText), remplie(f.rechargePrix)].filter(Boolean).length },
  { id: 'liens', titre: 'Liens', total: 4, remplis: (f) =>
      [(f.related || []).length > 0, remplie(f.rituelId), remplie(f.rituelEtape), remplie(f.rituelGeste)].filter(Boolean).length },
];

function EnteteSection({ section, form, chapeau }) {
  const n = section.remplis(form);
  return (
    <>
      <header className="flex items-baseline gap-3 mb-1">
        <h3 className="font-serif text-2xl text-slate-stone font-light">{section.titre}</h3>
        <span className={`ml-auto font-sans text-[11px] tabular-nums ${
          n === section.total ? 'text-slate-stone font-medium' : 'text-stone-gray/50'
        }`}>{n}/{section.total}</span>
      </header>
      <p className="text-[12px] text-stone-gray mb-5 max-w-[62ch]">{chapeau}</p>
    </>
  );
}

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('orders');
  // Les inscrites a l'infolettre. Elles etaient collectees depuis le debut sans
  // qu'aucun ecran ne permette de les relire.
  const [abonnees, setAbonnees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [workshopForm, setWorkshopForm] = useState({ id: null, title: '', description: '', price: '', duration: '', image_url: '', starts_at: '' });
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ id: null, name: '', price: '', ribbon: '', collectionsText: '', images: [], description: '', stock: '', inStock: true, related: [] });
  const [productSearch, setProductSearch] = useState('');
  // Le choix des « Vous aimerez aussi » : sa propre recherche et son classement.
  const [rechercheLies, setRechercheLies] = useState('');
  const [classementLies, setClassementLies] = useState('alpha');
  const [productsPage, setProductsPage] = useState(1);
  // La cliente dont on regarde l'historique. Une seule à la fois : déplier tout
  // le fichier donnerait un mur qu'on ne lit pas.
  const [clienteOuverte, setClienteOuverte] = useState(null);
  // Cent soixante-dix-huit fiches dans l'ordre de l'export Wix : pour retrouver
  // un savon, il fallait le chercher au nom ou tourner sept pages.
  const [triProduits, setTriProduits] = useState('alpha');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  // true when the badge is free text rather than one of the two presets
  const [customBadge, setCustomBadge] = useState(false);
  const [workshopImageUploading, setWorkshopImageUploading] = useState(false);
  const PRODUCTS_PER_PAGE = 25;
  const emptyProductForm = { id: null, name: '', price: '', ribbon: '', collectionsText: '', images: [], description: '', stock: '', inStock: true, related: [], ordre: '', poids: '', contenance: '', ingredients: '', inci: '', typePeauText: '', besoinsText: '', etiquettesText: '', bonCadeau: false, rituelId: '', rituelEtape: '', rituelGeste: '', rechargePrix: '', variantes: [], enLigne: true };
  // Charger un produit dans le formulaire.
  //
  // Les deux entrées — « Modifier » et « Dupliquer » — construisaient chacune
  // cet objet à la main, et toutes deux OUBLIAIENT `related`. Le payload, lui,
  // envoie toujours `related`, donc à undefined il partait comme liste vide :
  // ouvrir une fiche et l'enregistrer effaçait en silence sa sélection « Vous
  // aimerez aussi ». Écrit une fois, le champ ne peut plus manquer d'un côté.
  const chargerProduitDansFormulaire = (p, { copie = false } = {}) => ({
    ...emptyProductForm,
    id: copie ? null : p.id,
    // « (copie) » ne s'empile pas. Dupliquer une copie donnait « (copie)
    // (copie) », et une troisième fois en aurait mis trois — trois fiches dont
    // le nom ne disait plus rien de ce qui les distingue. Une seule mention
    // suffit à signaler qu'il reste un nom à écrire.
    name: copie
      ? (/\(copie\)\s*$/i.test(p.name || '') ? p.name : `${p.name} (copie)`)
      : (p.name || ''),
    price: p.price ?? '',
    ribbon: p.ribbon || '',
    collectionsText: (p.collections || []).join(', '),
    images: Array.isArray(p.images) ? [...p.images] : [],
    description: p.description || '',
    stock: p.stock == null ? '' : String(p.stock),
    inStock: p.inStock !== false,
    enLigne: p.enLigne !== false,
    related: Array.isArray(p.related) ? [...p.related] : [],
    contenance: p.contenance || '',
    poids: p.poids ?? '',
    ordre: p.ordre ?? '',
    ingredients: p.ingredients || '',
    inci: p.inci || '',
    // Les listes redeviennent du texte pour la saisie, et le serveur les
    // redécoupe. La forme stockée reste un tableau.
    typePeauText: (p.typePeau || []).join(', '),
    besoinsText: (p.besoins || []).join(', '),
    etiquettesText: (p.etiquettes || []).join(', '),
    bonCadeau: !!p.bonCadeau,
    rituelId: (p.rituel && p.rituel.id) || '',
    rituelEtape: (p.rituel && p.rituel.etape) || '',
    rituelGeste: (p.rituel && p.rituel.geste) || '',
    rechargePrix: p.rechargePrix == null ? '' : String(p.rechargePrix),
    // Tout en texte dans le formulaire : un champ nombre vidé rendrait NaN, et
    // NaN dans une valeur d'input fait perdre le focus à chaque frappe.
    variantes: (p.variantes || []).map((v) => ({
      libelle: v.libelle || '',
      prix: v.prix == null ? '' : String(v.prix),
      poids: v.poids == null ? '' : String(v.poids),
    })),
  });

  // L'empreinte de la fiche telle qu'elle a été ouverte.
  //
  // C'est elle qui dit à la barre d'action s'il reste quelque chose à
  // enregistrer. Comparer deux sérialisations coûte moins cher que de poser un
  // drapeau dans chacun des vingt-cinq gestionnaires de saisie — et surtout,
  // aucun ne peut l'oublier.
  const [empreinteOuverture, setEmpreinteOuverture] = useState(() => JSON.stringify(emptyProductForm));
  const ficheModifiee = JSON.stringify(productForm) !== empreinteOuverture;

  // La section qu'on est en train de lire, pour l'éclairer dans le sommaire.
  const [sectionActive, setSectionActive] = useState('identite');

  useEffect(() => {
    const cibles = SECTIONS_FICHE
      .map((s) => document.getElementById('fiche-' + s.id))
      .filter(Boolean);
    if (cibles.length === 0) return undefined;
    const observateur = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => {
        if (e.isIntersecting) setSectionActive(e.target.id.replace('fiche-', ''));
      });
    }, { rootMargin: '-10% 0px -70% 0px' });
    cibles.forEach((c) => observateur.observe(c));
    return () => observateur.disconnect();
    // Les sections n'existent que sur l'onglet des produits : l'observateur se
    // repose quand on en change, sinon il surveillerait des nœuds détachés.
  }, [activeTab]);

  // La liste des fiches, filtrée et rangée. Elle était recalculée à trois
  // endroits — le compte, le tableau, la pagination — et rien ne garantissait
  // que les trois disent la même chose.
  const produitsListes = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const filtres = products.filter((p) => !q || (p.name || '').toLowerCase().includes(q));
    const parNom = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
    if (triProduits === 'alpha') return [...filtres].sort(parNom);
    if (triProduits === 'rubrique') {
      return [...filtres].sort((a, b) => {
        // Une fiche sans rubrique se range en fin de liste plutôt qu'en tête :
        // c'est un oubli à corriger, pas une catégorie.
        const ra = (a.collections || [])[0] || '\uffff';
        const rb = (b.collections || [])[0] || '\uffff';
        return ra.localeCompare(rb, 'fr', { sensitivity: 'base' }) || parNom(a, b);
      });
    }
    return filtres;
  }, [products, productSearch, triProduits]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState({ success: '', error: '' });

  // SumUp settings state
  const [sumupSettings, setSumupSettings] = useState({ apiKeyConfigured: false, apiKeyLast4: null, merchantEmail: '', webhookSecretConfigured: false });
  const [sumupForm, setSumupForm] = useState({ apiKey: '', merchantEmail: '', webhookSecret: '' });
  const [sumupStatus, setSumupStatus] = useState({ success: '', error: '' });
  const [sumupSaving, setSumupSaving] = useState(false);
  
  // Email modal state
  const [emailModal, setEmailModal] = useState({ isOpen: false, to: '', subject: '', message: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');

  // Selected order details modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Fulfillment form state (within order details modal)
  const [fulfillForm, setFulfillForm] = useState({ type: 'pickup', carrier: 'La Poste Suisse', tracking_number: '' });
  const [fulfillSaving, setFulfillSaving] = useState(false);
  const [fulfillStatus, setFulfillStatus] = useState({ success: '', error: '' });

  // Inbox state
  const [inboxMessages, setInboxMessages] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState('');
  const [openMessage, setOpenMessage] = useState(null);
  const [openMessageLoading, setOpenMessageLoading] = useState(false);

  // Inbox settings
  const [inboxSettings, setInboxSettings] = useState({ host: '', port: '993', secure: true, user: '', passConfigured: false });
  const [inboxForm, setInboxForm] = useState({ host: '', port: '993', secure: true, user: '', pass: '' });
  const [inboxSettingsStatus, setInboxSettingsStatus] = useState({ success: '', error: '' });
  const [inboxSettingsSaving, setInboxSettingsSaving] = useState(false);
  const [showInboxSettings, setShowInboxSettings] = useState(false);

  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));

  // Téléchargement via fetch plutôt qu'un lien : la route exige le jeton
  // d'administration, qu'un <a href> ne transporte pas.
  const exporterVentes = () => {
    fetch(`/api/admin/orders/export?year=${exportYear}`, { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventes-so-you-${exportYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert("L'export n'a pas pu être généré."));
  };

  const token = localStorage.getItem('adminToken');
  const username = localStorage.getItem('adminUser') || 'admin';

  const fetchHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Invalidate the session server-side, then clear local state.
  const handleLogout = () => {
    fetch('/api/admin/logout', { method: 'POST', headers: fetchHeaders })
      .catch(() => {})
      .finally(() => onLogout());
  };

  // Réduit une photo avant de l'envoyer.
  //
  // Les dix photos téléversées depuis l'atelier pèsent de 900 Ko à 4,5 Mo :
  // elles sortent d'un téléphone, en 4000 px, et partaient telles quelles. Une
  // fiche produit en chargeait onze mégaoctets — c'est la lenteur qu'elle
  // signale, et c'est aussi ce que Google mesure pour classer la page.
  //
  // 1600 px suffit : c'est la plus grande taille que la boutique demande, sur
  // un écran de bureau en pleine largeur. Le travail se fait dans son
  // navigateur, donc rien à installer sur le serveur.
  const reduirePhoto = (file) => new Promise((resolve, reject) => {
    // Un format que le canvas ne sait pas décoder (HEIC, un TIFF) passe
    // inchangé plutôt que d'échouer : mieux vaut une photo lourde qu'aucune.
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      const brut = new FileReader();
      brut.onload = () => resolve(brut.result);
      brut.onerror = reject;
      brut.readAsDataURL(file);
      return;
    }
    const lecteur = new FileReader();
    lecteur.onerror = reject;
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(lecteur.result);
      img.onload = () => {
        const MAX = 1600;
        const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
        if (ratio === 1 && file.size < 400 * 1024) return resolve(lecteur.result);
        const toile = document.createElement('canvas');
        toile.width = Math.round(img.width * ratio);
        toile.height = Math.round(img.height * ratio);
        const ctx = toile.getContext('2d');
        ctx.drawImage(img, 0, 0, toile.width, toile.height);
        // 0,82 : au-delà le fichier grossit sans que l'œil y gagne.
        const reduite = toile.toDataURL('image/jpeg', 0.82);
        resolve(reduite.length < lecteur.result.length ? reduite : lecteur.result);
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(file);
  });

  // Upload one or more image files from the admin's computer; append the
  // resulting public URLs to the product form's image list.
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImageUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const dataUrl = await reduirePhoto(file);
        const resp = await fetch('/api/admin/products/upload-image', {
          method: 'POST',
          headers: fetchHeaders,
          body: JSON.stringify({ filename: file.name, data: dataUrl })
        });
        if (resp.status === 401) { onLogout(); throw new Error('Session expirée'); }
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j.error || 'Échec du téléversement');
        }
        const j = await resp.json();
        urls.push(j.url);
      }
      setProductForm(f => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      alert(err.message);
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  // Workshops reuse the product image endpoint — it is admin-authed and not
  // product-specific, so no server change was needed to accept these uploads.
  const handleWorkshopImageUpload = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setWorkshopImageUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const resp = await fetch('/api/admin/products/upload-image', {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({ filename: file.name, data: dataUrl })
      });
      if (resp.status === 401) { onLogout(); throw new Error('Session expirée'); }
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Échec du téléversement');
      }
      const j = await resp.json();
      setWorkshopForm(f => ({ ...f, image_url: j.url }));
    } catch (err) {
      alert(err.message);
    } finally {
      setWorkshopImageUploading(false);
      e.target.value = '';
    }
  };

  const loadData = () => {
    setLoading(true);
    setError('');
    
    const endpoints = {
      orders: '/api/admin/orders',
      bookings: '/api/admin/bookings',
      clients: '/api/admin/clients',
      workshops: '/api/admin/workshops',
      products: '/api/admin/products'
    };

    // Tabs that own their loading (Textes du site, Configuration, API SumUp)
    // have no entry here. Without this guard the fetch would go to the literal
    // URL "undefined" and paint an error banner over a panel that is working.
    const endpoint = endpoints[activeTab];
    if (!endpoint) {
      setLoading(false);
      return;
    }

    fetch(endpoint, { headers: fetchHeaders })
      .then(res => {
        if (res.status === 401) {
          onLogout(); // Token expired or invalid
          throw new Error('Session expirée');
        }
        if (!res.ok) throw new Error('Erreur lors du chargement des données');
        return res.json();
      })
      .then(data => {
        if (activeTab === 'orders') setOrders(data);
        if (activeTab === 'bookings') setBookings(data);
        if (activeTab === 'clients') setClients(data);
        // Le fichier clients et les inscrites vivent au meme endroit : ce sont
        // les memes personnes, arrivees par deux portes differentes.
        if (activeTab === 'clients') {
          fetch('/api/admin/newsletter', { headers: fetchHeaders })
            .then((r) => (r.ok ? r.json() : []))
            .then((l) => setAbonnees(Array.isArray(l) ? l : []))
            .catch(() => setAbonnees([]));
          // Les commandes aussi : le fichier clients ne donne qu'un compte et
          // un total. « Trois commandes » ne dit pas lesquelles, ni quand, ni
          // ce qu'il y avait dedans — c'est pourtant ce qu'on cherche quand on
          // ouvre la fiche de quelqu'un.
          fetch('/api/admin/orders', { headers: fetchHeaders })
            .then((r) => (r.ok ? r.json() : []))
            .then((l) => setOrders(Array.isArray(l) ? l : []))
            .catch(() => { /* le tableau reste utilisable sans l'historique */ });
        }
        if (activeTab === 'workshops') setWorkshops(data);
        if (activeTab === 'products') setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'sumup') {
      loadSumupSettings();
      return;
    }
    if (activeTab === 'inbox') {
      loadInboxSettings();
      loadInbox();
      return;
    }
    if (activeTab !== 'settings') {
      loadData();
    }
  }, [activeTab]);

  // Reset fulfillment form whenever the user opens a new order
  useEffect(() => {
    if (selectedOrder) {
      const existing = selectedOrder.fulfillment || {};
      setFulfillForm({
        type: existing.type || 'pickup',
        carrier: existing.carrier || 'La Poste Suisse',
        tracking_number: existing.tracking_number || ''
      });
      setFulfillStatus({ success: '', error: '' });
    }
  }, [selectedOrder]);

  const loadInbox = () => {
    setInboxLoading(true);
    setInboxError('');
    fetch('/api/admin/inbox', { headers: fetchHeaders })
      .then(res => {
        if (res.status === 401) { onLogout(); throw new Error('Session expirée'); }
        return res.json().then(data => ({ ok: res.ok, status: res.status, data }));
      })
      .then(({ ok, status, data }) => {
        setInboxLoading(false);
        if (!ok) {
          setInboxError(data.error || 'Erreur');
          setInboxMessages([]);
          if (status === 503) setShowInboxSettings(true);
          return;
        }
        setInboxMessages(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        setInboxLoading(false);
        setInboxError(err.message);
      });
  };

  const openInboxMessage = (uid) => {
    setOpenMessageLoading(true);
    setOpenMessage({ uid, loading: true });
    fetch(`/api/admin/inbox/${uid}`, { headers: fetchHeaders })
      .then(res => res.json())
      .then(data => {
        setOpenMessageLoading(false);
        setOpenMessage(data);
        // Mark as seen in local list
        setInboxMessages(prev => prev.map(m => m.uid === uid ? { ...m, seen: true } : m));
      })
      .catch(err => {
        setOpenMessageLoading(false);
        setOpenMessage({ error: err.message });
      });
  };

  const loadInboxSettings = () => {
    fetch('/api/admin/settings/inbox', { headers: fetchHeaders })
      .then(res => res.json())
      .then(data => {
        setInboxSettings(data);
        setInboxForm({
          host: data.host || '',
          port: data.port || '993',
          secure: data.secure !== false,
          user: data.user || '',
          pass: ''
        });
      })
      .catch(() => {});
  };

  const handleSaveInboxSettings = (e) => {
    e.preventDefault();
    setInboxSettingsSaving(true);
    setInboxSettingsStatus({ success: '', error: '' });
    const patch = {
      host: inboxForm.host,
      port: inboxForm.port,
      secure: inboxForm.secure,
      user: inboxForm.user
    };
    if (inboxForm.pass) patch.pass = inboxForm.pass;
    fetch('/api/admin/settings/inbox', {
      method: 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify(patch)
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setInboxSettingsSaving(false);
        if (!ok) throw new Error(data.error || 'Erreur');
        setInboxSettings(data);
        setInboxForm(prev => ({ ...prev, pass: '' }));
        setInboxSettingsStatus({ success: 'Paramètres enregistrés.', error: '' });
        loadInbox();
      })
      .catch(err => {
        setInboxSettingsSaving(false);
        setInboxSettingsStatus({ success: '', error: err.message });
      });
  };

  const handleFulfillOrder = (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setFulfillSaving(true);
    setFulfillStatus({ success: '', error: '' });

    const payload = { type: fulfillForm.type };
    if (fulfillForm.type === 'shipped') {
      payload.carrier = fulfillForm.carrier;
      payload.tracking_number = fulfillForm.tracking_number;
    }

    fetch(`/api/admin/orders/${selectedOrder.id}/fulfill`, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(payload)
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setFulfillSaving(false);
        if (!ok) throw new Error(data.error || 'Erreur');
        // Only claim the customer was notified if the server actually sent it.
        if (data.emailSent === false) {
          setFulfillStatus({ success: '', error: "Commande mise à jour, mais l'e-mail au client n'a pas pu être envoyé." });
        } else {
          setFulfillStatus({ success: fulfillForm.type === 'pickup' ? 'Client averti par e-mail : commande prête à retirer.' : 'Client averti par e-mail avec le numéro de suivi.', error: '' });
        }
        // Reflect updated status in the orders list + currently selected order
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: data.order.status, fulfillment: data.order.fulfillment } : o));
        setSelectedOrder(prev => prev ? { ...prev, status: data.order.status, fulfillment: data.order.fulfillment } : prev);
      })
      .catch(err => {
        setFulfillSaving(false);
        setFulfillStatus({ success: '', error: err.message });
      });
  };

  const loadSumupSettings = () => {
    setSumupStatus({ success: '', error: '' });
    fetch('/api/admin/settings/sumup', { headers: fetchHeaders })
      .then(res => {
        if (res.status === 401) { onLogout(); throw new Error('Session expirée'); }
        if (!res.ok) throw new Error('Erreur lors du chargement des paramètres SumUp');
        return res.json();
      })
      .then(data => {
        setSumupSettings(data);
        setSumupForm({ apiKey: '', merchantEmail: data.merchantEmail || '', webhookSecret: '' });
      })
      .catch(err => setSumupStatus({ success: '', error: err.message }));
  };

  const handleSaveSumup = (e) => {
    e.preventDefault();
    setSumupSaving(true);
    setSumupStatus({ success: '', error: '' });

    // Only send fields the user actually filled in. Empty apiKey/webhookSecret
    // means "leave as is" rather than "clear" — clearing is done via the
    // dedicated Effacer buttons.
    const patch = { merchantEmail: sumupForm.merchantEmail };
    if (sumupForm.apiKey) patch.apiKey = sumupForm.apiKey;
    if (sumupForm.webhookSecret) patch.webhookSecret = sumupForm.webhookSecret;

    fetch('/api/admin/settings/sumup', {
      method: 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify(patch)
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setSumupSaving(false);
        if (!ok) throw new Error(data.error || 'Erreur lors de la sauvegarde');
        setSumupSettings(data);
        setSumupForm({ apiKey: '', merchantEmail: data.merchantEmail || '', webhookSecret: '' });
        setSumupStatus({ success: 'Paramètres SumUp mis à jour. Redémarrage du serveur non nécessaire.', error: '' });
      })
      .catch(err => {
        setSumupSaving(false);
        setSumupStatus({ success: '', error: err.message });
      });
  };

  const clearSumupField = (field) => {
    const fieldToServerName = { apiKey: 'apiKey', webhookSecret: 'webhookSecret', merchantEmail: 'merchantEmail' };
    const patch = { [fieldToServerName[field]]: '' };
    fetch('/api/admin/settings/sumup', {
      method: 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify(patch)
    })
      .then(res => res.json())
      .then(data => {
        setSumupSettings(data);
        setSumupForm({ apiKey: '', merchantEmail: data.merchantEmail || '', webhookSecret: '' });
        setSumupStatus({ success: 'Champ effacé.', error: '' });
      })
      .catch(err => setSumupStatus({ success: '', error: err.message }));
  };

  const handleUpdateStatus = (orderId, newStatus) => {
    fetch(`/api/admin/orders/${orderId}`, {
      method: 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify({ status: newStatus })
    })
      .then(res => {
        if (!res.ok) throw new Error('Erreur lors du changement de statut');
        return res.json();
      })
      .then(() => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        }
      })
      .catch(err => alert(err.message));
  };

  // Supprimer une commande définitivement.
  //
  // Le serveur exige qu'elle ait d'abord été annulée ou remboursée ; ici on
  // demande de RECOPIER son numéro. Ni l'un ni l'autre n'est une formalité :
  // le premier sépare la décision d'écarter de celle d'effacer, le second
  // empêche qu'un clic de trop parte tout seul. Le numéro n'est pas rappelé
  // dans la demande — il est à l'écran, il faut aller le lire.
  const handleDeleteOrder = (order) => {
    const statut = String(order.status || '');
    if (!['Cancelled', 'Refunded'].includes(statut)) {
      alert("Passez d'abord cette commande en « Annulée » ou « Remboursée ».\n\n"
        + 'On ne supprime que ce qui a déjà été écarté : une vraie commande ne '
        + "doit pas pouvoir disparaître d'un seul geste.");
      return;
    }
    const saisi = window.prompt(
      'Suppression définitive.\n\n'
      + 'Recopiez le numéro de la commande, tel qu\'il est affiché au-dessus, '
      + 'pour confirmer.'
    );
    if (saisi === null) return;
    if (saisi.trim() !== order.id) {
      alert('Le numéro ne correspond pas. Rien n\'a été supprimé.');
      return;
    }
    fetch(`/api/admin/orders/${order.id}`, { method: 'DELETE', headers: fetchHeaders })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'La suppression a échoué');
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        setSelectedOrder(null);
      })
      .catch((err) => alert(err.message));
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setPasswordStatus({ success: '', error: '' });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ success: '', error: 'Les nouveaux mots de passe ne correspondent pas' });
      return;
    }

    fetch('/api/admin/change-password', {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify({
        username,
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      })
    })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Erreur inconnue') });
        return res.json();
      })
      .then(data => {
        setPasswordStatus({ success: 'Mot de passe modifié avec succès !', error: '' });
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      })
      .catch(err => {
        setPasswordStatus({ success: '', error: err.message });
      });
  };

  const handleSendEmailSubmit = (e) => {
    e.preventDefault();
    setEmailSending(true);
    setEmailSuccess('');

    fetch('/api/admin/send-email', {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify({
        to: emailModal.to,
        subject: emailModal.subject,
        message: emailModal.message
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Erreur d'envoi");
        return res.json();
      })
      .then(() => {
        setEmailSending(false);
        setEmailSuccess('E-mail envoyé avec succès !');
        setTimeout(() => {
          setEmailModal({ isOpen: false, to: '', subject: '', message: '' });
          setEmailSuccess('');
        }, 1500);
      })
      .catch(err => {
        alert(err.message);
        setEmailSending(false);
      });
  };

  return (
    <div className="pt-20 min-h-screen bg-mist-white flex flex-col md:flex-row font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-stone/5 p-6 flex flex-col justify-between shrink-0">
        <div>
          <div className="mb-8 pt-4">
            <h2 className="font-serif text-2xl text-slate-stone">Dashboard</h2>
            <p className="text-[10px] text-stone-gray/60 uppercase tracking-widest mt-1">Session : {username}</p>
          </div>
          
          <nav className="space-y-2">
            {[
              { id: 'orders', label: 'Commandes', icon: '🛒' },
              { id: 'paniers', label: 'Paniers abandonnés', icon: '🛒' },
              { id: 'products', label: 'Gestion des produits', icon: '🧴' },
              { id: 'workshops', label: 'Gestion des ateliers', icon: '🎨' },
              { id: 'clients', label: 'Fichier clients', icon: '👤' },
              { id: 'inbox', label: 'Boîte de réception', icon: '📥' },
              { id: 'sumup', label: 'API SumUp', icon: '💳' },
              { id: 'content', label: 'Textes du site', icon: '✏️' },
              { id: 'journal', label: 'Journal', icon: '📝' },
              { id: 'infolettre', label: 'Infolettres', icon: '📬' },
              { id: 'shop', label: 'Horaires & absences', icon: '🕓' },
              { id: 'settings', label: 'Configuration et mot de passe', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedOrder(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium tracking-wide transition-all ${activeTab === tab.id ? 'bg-slate-stone text-white shadow-md' : 'text-stone-gray hover:bg-mist-white hover:text-slate-stone'}`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="mt-12 w-full py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs uppercase tracking-widest font-bold hover:bg-red-100 transition-colors"
        >
          Déconnexion 🚪
        </button>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 p-6 sm:p-10 md:p-12 overflow-x-hidden">
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm">
            {error}
          </div>
        )}

        {/* Tab 1: Orders */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl text-slate-stone">Gestion des Commandes</h1>
                <p className="text-xs text-stone-gray font-light mt-1">Historique des achats et suivi des envois.</p>
              </div>

              {/* « Sortir un tableau chaque fin d'année regroupant toutes les
                  ventes effectuées pour ma compta ». Le fichier s'ouvre dans
                  Excel et part chez le comptable sans retaper une ligne. */}
              <div className="flex items-center gap-2">
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-slate-stone bg-white"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={exporterVentes}
                  className="px-5 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone/90 transition-colors"
                >
                  Export comptable
                </button>
              </div>
              <button onClick={loadData} className="px-4 py-2 bg-white rounded-lg border border-slate-stone/10 text-xs text-stone-gray hover:bg-slate-stone/5 transition-all">Rafraîchir 🔄</button>
            </div>

            {loading ? (
              <div className="py-24 text-center text-stone-gray/60">Chargement...</div>
            ) : orders.length === 0 ? (
              <div className="py-24 text-center bg-white rounded-3xl border border-slate-stone/5 text-stone-gray">Aucune commande enregistrée.</div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-stone/5 text-xs text-stone-gray tracking-wider uppercase font-bold bg-mist-white/30">
                      <th className="p-6">Référence</th>
                      <th className="p-6">Client</th>
                      <th className="p-6">Date</th>
                      <th className="p-6 text-right">Total</th>
                      <th className="p-6 text-center">Statut</th>
                      <th className="p-6 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id} className="border-b border-slate-stone/5 hover:bg-mist-white/20 transition-colors text-sm text-slate-stone font-light">
                        <td className="p-6 font-mono font-medium">{order.id}</td>
                        <td className="p-6">
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-xs text-stone-gray">{order.customer_email}</p>
                        </td>
                        <td className="p-6 text-xs text-stone-gray">
                          {new Date(order.created_at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-6 text-right font-medium">CHF {order.total.toFixed(2)}</td>
                        <td className="p-6 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusKey(order.status) === 'paid' ? 'bg-green-100 text-green-700' : statusKey(order.status) === 'shipped' ? 'bg-blue-100 text-blue-700' : statusKey(order.status) === 'readyforpickup' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                            {statusKey(order.status) === 'paid' ? 'Payé' : statusKey(order.status) === 'shipped' ? 'Envoyé' : statusKey(order.status) === 'readyforpickup' ? 'À retirer' : 'En attente'}
                          </span>
                        </td>
                        <td className="p-6 text-center">
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 bg-mist-white hover:bg-slate-stone hover:text-white rounded-lg text-xs tracking-wider uppercase transition-all"
                          >
                            Détails
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Bookings */}
        {activeTab === 'bookings' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl text-slate-stone">Inscriptions aux Ateliers</h1>
                <p className="text-xs text-stone-gray font-light mt-1">Liste des réservations de places pour les ateliers DIY.</p>
              </div>
              <button onClick={loadData} className="px-4 py-2 bg-white rounded-lg border border-slate-stone/10 text-xs text-stone-gray hover:bg-slate-stone/5 transition-all">Rafraîchir 🔄</button>
            </div>

            {loading ? (
              <div className="py-24 text-center text-stone-gray/60">Chargement...</div>
            ) : bookings.length === 0 ? (
              <div className="py-24 text-center bg-white rounded-3xl border border-slate-stone/5 text-stone-gray">Aucune réservation pour le moment.</div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-stone/5 text-xs text-stone-gray tracking-wider uppercase font-bold bg-mist-white/30">
                      <th className="p-6">ID réservation</th>
                      <th className="p-6">Client</th>
                      <th className="p-6">Atelier & Date</th>
                      <th className="p-6 text-center">Places</th>
                      <th className="p-6 text-center">Statut</th>
                      <th className="p-6 text-center">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(booking => (
                      <tr key={booking.id} className="border-b border-slate-stone/5 hover:bg-mist-white/20 transition-colors text-sm text-slate-stone font-light">
                        <td className="p-6 font-mono text-xs">{booking.id}</td>
                        <td className="p-6">
                          <p className="font-medium">{booking.customer_name}</p>
                          <p className="text-xs text-stone-gray">{booking.customer_email}</p>
                        </td>
                        <td className="p-6">
                          <p className="font-medium text-xs text-slate-stone">{booking.workshop_id || 'Atelier de cosmétique naturelle'}</p>
                          <p className="text-xs text-stone-gray mt-0.5">{booking.slot_date}</p>
                        </td>
                        <td className="p-6 text-center font-bold">{booking.seats}</td>
                        <td className="p-6 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-semibold">
                            Confirmé
                          </span>
                        </td>
                        <td className="p-6 text-center">
                          <button 
                            onClick={() => setEmailModal({ isOpen: true, to: booking.customer_email, subject: `Votre réservation d'atelier - So You Cosmetics`, message: `Bonjour ${booking.customer_name},\n\nConcerne votre réservation d'atelier : ${booking.slot_date}.\n\n` })}
                            className="w-8 h-8 rounded-lg bg-mist-white hover:bg-slate-stone hover:text-white transition-all flex items-center justify-center mx-auto"
                          >
                            ✉️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Clients */}
        {activeTab === 'clients' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl text-slate-stone">Fichier clients</h1>
                <p className="text-xs text-stone-gray font-light mt-1">Liste consolidée de tous les clients (commandes et ateliers).</p>
              </div>
              <button onClick={loadData} className="px-4 py-2 bg-white rounded-lg border border-slate-stone/10 text-xs text-stone-gray hover:bg-slate-stone/5 transition-all">Rafraîchir 🔄</button>
            </div>

            {loading ? (
              <div className="py-24 text-center text-stone-gray/60">Chargement...</div>
            ) : clients.length === 0 ? (
              <div className="py-24 text-center bg-white rounded-3xl border border-slate-stone/5 text-stone-gray">Aucun client répertorié.</div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-stone/5 text-xs text-stone-gray tracking-wider uppercase font-bold bg-mist-white/30">
                      <th className="p-6">Nom</th>
                      <th className="p-6">Email</th>
                      <th className="p-6 text-center">Commandes</th>
                      <th className="p-6 text-center">Ateliers</th>
                      <th className="p-6 text-right">Total dépensé</th>
                      <th className="p-6 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client, idx) => {
                      const ouverte = clienteOuverte === client.email;
                      // Ses commandes, retrouvées par l'adresse — la même clé
                      // que le fichier clients emploie pour les regrouper.
                      const siennes = ouverte
                        ? orders
                            .filter((o) => String(o.customer_email || '').trim().toLowerCase() === String(client.email || '').trim().toLowerCase())
                            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
                        : [];
                      return (
                      <React.Fragment key={idx}>
                      <tr className="border-b border-slate-stone/5 hover:bg-mist-white/20 transition-colors text-sm text-slate-stone font-light">
                        <td className="p-6 font-medium">{client.name || 'Client Anonyme'}</td>
                        <td className="p-6 font-mono text-xs text-stone-gray">{client.email}</td>
                        <td className="p-6 text-center">
                          {client.order_count > 0 ? (
                            <button
                              type="button"
                              onClick={() => setClienteOuverte(ouverte ? null : client.email)}
                              aria-expanded={ouverte}
                              className="press font-bold text-slate-stone underline underline-offset-4 decoration-slate-stone/30 hover:decoration-slate-stone"
                            >
                              {client.order_count}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-stone/60">0</span>
                          )}
                        </td>
                        <td className="p-6 text-center font-bold text-slate-stone/60">{client.booking_count}</td>
                        <td className="p-6 text-right font-medium text-slate-stone">CHF {client.total_spent.toFixed(2)}</td>
                        <td className="p-6 text-center">
                          <button 
                            onClick={() => setEmailModal({ isOpen: true, to: client.email, subject: 'So You Cosmetics - Message client', message: `Bonjour ${client.name || ''},\n\n` })}
                            className="px-3 py-1.5 bg-mist-white hover:bg-slate-stone hover:text-white rounded-lg text-xs tracking-wider uppercase transition-all"
                          >
                            ✉️ Écrire
                          </button>
                        </td>
                      </tr>
                      {ouverte && (
                        <tr className="border-b border-slate-stone/5 bg-mist-white/40">
                          <td colSpan={6} className="px-6 py-5">
                            {siennes.length === 0 ? (
                              <p className="text-xs text-stone-gray">
                                Ses commandes n'ont pas pu être chargées. Ouvrez l'onglet Commandes, puis revenez.
                              </p>
                            ) : (
                              <div className="flex flex-col gap-3">
                                {siennes.map((o) => (
                                  <div key={o.id} className="rounded-xl border border-slate-stone/10 bg-white p-4">
                                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                                      <span className="font-medium text-sm text-slate-stone">
                                        {new Date(o.created_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        <span className="ml-2 font-mono text-[11px] text-stone-gray">{o.id}</span>
                                      </span>
                                      <span className="text-sm text-slate-stone tabular-nums">
                                        CHF {Number(o.total).toFixed(2)}
                                        <span className="ml-2 text-[11px] uppercase tracking-widest text-stone-gray">{o.status}</span>
                                      </span>
                                    </div>
                                    <ul className="mt-2 flex flex-col gap-0.5">
                                      {(o.items || []).map((a, k) => (
                                        <li key={k} className="text-xs text-stone-gray">
                                          {a.qty > 1 && <span className="text-stone-gray/60">{a.qty} × </span>}
                                          {a.name}
                                        </li>
                                      ))}
                                    </ul>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOrder(o)}
                                      className="press mt-3 text-[11px] uppercase tracking-widest text-slate-stone underline underline-offset-4"
                                    >
                                      Ouvrir le détail
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Les inscriptions a l'infolettre.
                Le formulaire du pied de page les enregistrait depuis le debut,
                et rien ne permettait de les relire : ni route, ni ecran. Elle
                collectait des adresses qu'elle ne pouvait ni consulter ni
                utiliser. */}
            <div className="mt-10 bg-white rounded-3xl border border-slate-stone/5 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-serif text-xl text-slate-stone">Infolettre</h3>
                  <p className="text-xs text-stone-gray mt-1">
                    {abonnees.length === 0
                      ? "Personne ne s'est encore inscrit depuis le pied de page."
                      : `${abonnees.length} inscription${abonnees.length > 1 ? 's' : ''} depuis le pied de page du site.`}
                  </p>
                </div>
                {abonnees.length > 0 && (
                  <a
                    href="/api/admin/newsletter/export"
                    className="px-4 py-2 bg-slate-stone text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-slate-stone/90 transition-colors"
                  >
                    Exporter en CSV
                  </a>
                )}
              </div>
              {abonnees.length > 0 && (
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-stone/5">
                  {abonnees.map((a, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                      <span className="font-mono text-xs text-slate-stone truncate">{a.email}</span>
                      <span className="flex items-baseline gap-3 whitespace-nowrap">
                        <span className="text-[11px] text-stone-gray">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString('fr-CH') : '—'}
                        </span>
                        {/* La politique de confidentialité promet un retrait sur
                            simple demande. Sans ce bouton, l'honorer voulait dire
                            ouvrir un fichier sur le serveur. */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Retirer ${a.email} de l'infolettre ?`)) return;
                            fetch('/api/admin/newsletter', {
                              method: 'DELETE',
                              headers: fetchHeaders,
                              body: JSON.stringify({ email: a.email }),
                            })
                              .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
                              .then(() => setAbonnees((prev) => prev.filter((x) => x.email !== a.email)))
                              .catch(() => window.alert("Le retrait n'a pas pu être effectué."));
                          }}
                          className="text-[11px] text-stone-gray/60 hover:text-red-500 transition-colors"
                          title="Retirer de la liste"
                        >
                          Retirer
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3.5: Workshops */}
        {activeTab === 'products' && (
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-8">Gestion des produits</h1>

            <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 shadow-sm mb-8">
              <h3 className="font-serif text-xl text-slate-stone mb-4">{productForm.id ? 'Modifier le produit' : 'Ajouter un produit'}</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const url = productForm.id ? `/api/admin/products/${productForm.id}` : '/api/admin/products';
                const method = productForm.id ? 'PUT' : 'POST';
                const payload = {
                  name: productForm.name,
                  price: productForm.price,
                  ribbon: (productForm.ribbon || '').trim(),
                  description: productForm.description,
                  collections: productForm.collectionsText,
                  images: productForm.images,
                  // Only an empty list the admin created on purpose may wipe the
                  // product's images; the server ignores an empty list otherwise.
                  clearImages: productForm.images.length === 0,
                  stock: productForm.stock === '' ? null : productForm.stock,
                  related: productForm.related || [],
                  inStock: !!productForm.inStock,
                  enLigne: productForm.enLigne !== false,
                  // Le quatrième endroit. La liste blanche du serveur est
                  // stricte : un champ absent d'ici est saisi, paraît accepté,
                  // et s'évapore au rechargement sans qu'aucune erreur ne le
                  // dise.
                  contenance: productForm.contenance || '',
                  poids: productForm.poids === '' ? null : productForm.poids,
                  ordre: productForm.ordre === '' ? null : productForm.ordre,
                  ingredients: productForm.ingredients || '',
                  inci: productForm.inci || '',
                  typePeau: productForm.typePeauText || '',
                  besoins: productForm.besoinsText || '',
                  etiquettes: productForm.etiquettesText || '',
                  bonCadeau: !!productForm.bonCadeau,
                  // Le rituel : trois champs, un seul objet cote serveur.
                  rituel: productForm.rituelId
                    ? { id: productForm.rituelId, etape: productForm.rituelEtape, geste: productForm.rituelGeste }
                    : null,
                  rechargePrix: productForm.rechargePrix === '' ? null : productForm.rechargePrix,
                  // Les lignes à moitié remplies partent quand même : c'est le
                  // serveur qui tranche ce qui est une contenance et ce qui est
                  // une ligne oubliée, pour que la règle soit la même partout.
                  variantes: productForm.variantes || []
                };
                fetch(url, { method, headers: fetchHeaders, body: JSON.stringify(payload) })
                  .then(res => {
                    if (res.status === 401) { onLogout(); throw new Error('Session expirée'); }
                    if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
                    return res.json();
                  })
                  .then(() => {
                    setProductForm(emptyProductForm);
                    setEmpreinteOuverture(JSON.stringify(emptyProductForm));
                    setCustomBadge(false);
                    loadData();
                  })
                  .catch(err => alert(err.message));
              }} className="xl:grid xl:grid-cols-[minmax(0,1fr)_312px] 2xl:grid-cols-[184px_minmax(0,1fr)_336px] xl:gap-6 2xl:gap-8 xl:items-start">

                {/* Le sommaire.

                    Des onglets auraient caché des champs qu'on oublie ensuite
                    de remplir. Les ancres gardent tout à l'écran et donnent
                    quand même une carte du territoire — plus, par section, le
                    nombre de champs déjà remplis. */}
                <nav className="hidden 2xl:block sticky top-6" aria-label="Sections de la fiche">
                  <p className="font-sans text-[10px] uppercase tracking-[0.26em] text-stone-gray/70 mb-3 ml-3">La fiche</p>
                  <ol className="flex flex-col gap-0.5">
                    {SECTIONS_FICHE.map((s) => {
                      const n = s.remplis(productForm);
                      const actif = sectionActive === s.id;
                      return (
                        <li key={s.id}>
                          <a
                            href={`#fiche-${s.id}`}
                            className={`grid grid-cols-[1fr_auto] items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-colors border-l-2 ${
                              actif
                                ? 'bg-white text-slate-stone border-mist-blue shadow-sm'
                                : 'text-stone-gray border-transparent hover:bg-white/70 hover:text-slate-stone'
                            }`}
                          >
                            <span>{s.titre}</span>
                            <span className={`font-sans text-[11px] tabular-nums ${
                              n === s.total ? 'text-slate-stone font-medium' : 'text-stone-gray/50'
                            }`}>{n}/{s.total}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                </nav>

                {/* La colonne des sections. `pb-28` laisse la place à la barre
                    d'action, qui flotte au-dessus du bas de l'écran. */}
                <div className="flex flex-col gap-4 pb-28">

                  {/* ── Identité ─────────────────────────────────────────── */}
                  <section id="fiche-identite" className="scroll-mt-6 bg-white rounded-2xl border border-slate-stone/10 p-5 sm:p-6 shadow-sm">
                    <EnteteSection section={SECTIONS_FICHE[0]} form={productForm}
                      chapeau="Ce qu'on lit en premier, sur la grille comme dans l'onglet du navigateur." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Nom du produit</label>
                        <input type="text" required placeholder="Nom du produit" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="px-4 py-2 border rounded w-full" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Prix (CHF)</label>
                        <input type="number" step="0.01" min="0" required placeholder="Prix (CHF)" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="px-4 py-2 border rounded w-full" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Rang dans la boutique</label>
                        <input type="number" step="1" placeholder="ex : 1" value={productForm.ordre}
                          onChange={e => setProductForm({...productForm, ordre: e.target.value})}
                          className="px-4 py-2 border rounded w-full" />
                        <p className="text-[11px] text-stone-gray mt-1 leading-snug">
                          Plus le nombre est petit, plus la fiche paraît tôt. Laissé vide, elle garde sa
                          place actuelle, derrière celles qui portent un rang.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Badge sur l'image</label>
                        <select
                          value={customBadge ? '__custom__' : productForm.ribbon}
                          onChange={e => {
                            const v = e.target.value;
                            if (v === '__custom__') {
                              setCustomBadge(true);
                              setProductForm({ ...productForm, ribbon: '' });
                            } else {
                              setCustomBadge(false);
                              setProductForm({ ...productForm, ribbon: v });
                            }
                          }}
                          className="px-4 py-2 border rounded w-full"
                        >
                          <option value="">Aucun badge</option>
                          <option value="coming-soon">Coming Soon / Bientôt disponible</option>
                          <option value="best-seller">Best Seller / Meilleure vente</option>
                          <option value="__custom__">Texte personnalisé…</option>
                        </select>
                        {customBadge && (
                          <input
                            type="text"
                            autoFocus
                            placeholder="ex : Hydrolat"
                            value={productForm.ribbon}
                            onChange={e => setProductForm({ ...productForm, ribbon: e.target.value })}
                            className="px-4 py-2 border rounded w-full mt-2"
                          />
                        )}
                        <p className="text-xs text-stone-gray mt-1">« Épuisé » s'affiche automatiquement via la case ci-dessous.</p>
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Stock (interne, non affiché)</label>
                        <input type="number" min="0" step="1" placeholder="ex: 12" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})} className="px-4 py-2 border rounded w-full" />
                        {/* Elle demandait à quel format ce nombre correspond. À
                            aucun en particulier : server/db.js décrémente ce
                            compteur unique pour toute vente, quel qu'en soit le
                            format. Autant le dire là où on le saisit. */}
                        {(productForm.variantes || []).length > 1 && (
                          <p className="text-[11px] text-stone-gray mt-1">
                            Un seul stock pour tous les formats : saisissez le total. Chaque vente, quel que soit le format, le diminue.
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Catégories</label>
                        {/* Le champ était libre, sans aucune liste sous les yeux :
                            « maquillage » au lieu de « Maquillage » créait une
                            rubrique distincte, non traduite, rangée en fin de menu
                            au lieu de sa place — sans erreur ni avertissement.
                            Les boutons écrivent la forme exacte ; le champ reste
                            ouvert pour les rubriques qu'elle invente. */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {SHOP_CATEGORIES.map((cat) => {
                            const active = aLaCategorie(productForm.collectionsText, cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setProductForm({ ...productForm, collectionsText: basculerCategorie(productForm.collectionsText, cat) })}
                                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                  active
                                    ? 'bg-slate-stone text-white border-slate-stone'
                                    : 'bg-white text-stone-gray border-gray-300 hover:border-slate-stone'
                                }`}
                              >
                                {cat}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            aria-pressed={aLaCategorie(productForm.collectionsText, COUP_DE_COEUR)}
                            onClick={() => setProductForm({ ...productForm, collectionsText: basculerCategorie(productForm.collectionsText, COUP_DE_COEUR) })}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              aLaCategorie(productForm.collectionsText, COUP_DE_COEUR)
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-amber-700 border-amber-300 hover:border-amber-600'
                            }`}
                          >
                            ♥ {COUP_DE_COEUR}
                          </button>
                        </div>
                        <input type="text" placeholder="Séparées par des virgules" value={productForm.collectionsText} onChange={e => setProductForm({...productForm, collectionsText: e.target.value})} className="px-4 py-2 border rounded w-full" />
                        <p className="text-xs text-stone-gray mt-1">Cliquez une rubrique pour l’ajouter ou la retirer. <strong>{COUP_DE_COEUR}</strong> affiche le produit sur la page d’accueil. Vous pouvez aussi taper une rubrique à vous : elle apparaîtra dans le menu.</p>
                      </div>
                      <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 sm:items-center">
                        <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-red-50 border border-red-200 rounded">
                          <input type="checkbox" checked={!productForm.inStock} onChange={e => setProductForm({...productForm, inStock: !e.target.checked})} className="w-4 h-4 accent-red-600" />
                          <span className="text-sm text-red-700 font-medium">Marquer le produit comme épuisé</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-stone">
                          <input type="checkbox" checked={!!productForm.bonCadeau}
                            onChange={e => setProductForm({...productForm, bonCadeau: e.target.checked})} />
                          Ce produit est un bon cadeau
                        </label>
                        {/* « En attente » n'est pas « épuisé » : épuisé
                            s'affiche en boutique avec sa pastille rouge, en
                            attente n'y existe pas du tout. */}
                        <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-amber-50 border border-amber-200 rounded">
                          <input type="checkbox" checked={productForm.enLigne === false}
                            onChange={e => setProductForm({...productForm, enLigne: !e.target.checked})}
                            className="w-4 h-4 accent-amber-600" />
                          <span className="text-sm text-amber-800 font-medium">Garder en attente (hors ligne)</span>
                        </label>
                      </div>
                      <p className="md:col-span-2 text-[11px] text-stone-gray -mt-2">
                        Un bon cadeau : la caisse demandera le destinataire, un message et une date. Créez un produit par
                        montant (25, 50, 100, 150, 295) : le serveur facture toujours le prix de la fiche, jamais
                        celui que le navigateur envoie.
                      </p>
                    </div>
                  </section>

                  {/* ── Photos ───────────────────────────────────────────── */}
                  <section id="fiche-photos" className="scroll-mt-6 bg-white rounded-2xl border border-slate-stone/10 p-5 sm:p-6 shadow-sm">
                    <EnteteSection section={SECTIONS_FICHE[1]} form={productForm}
                      chapeau="La première est celle de la grille. Les autres se voient sur la fiche." />
                    <div className="flex items-center gap-3 mb-2">
                      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded cursor-pointer text-sm font-medium ${imageUploading ? 'bg-gray-200 text-stone-gray cursor-wait' : 'bg-slate-stone text-white hover:opacity-90'}`}>
                        {imageUploading ? 'Téléversement…' : '📤 Téléverser depuis mon ordinateur'}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={imageUploading} onChange={handleImageUpload} className="hidden" />
                      </label>
                      <span className="text-xs text-stone-gray">PNG, JPG, WEBP · plusieurs fichiers possibles</span>
                    </div>
                    {productForm.images.length > 0 ? (
                      <div className="flex flex-wrap gap-3 mb-3">
                        {productForm.images.map((url, idx) => (
                          <div key={`${url}-${idx}`} className="relative group">
                            <img
                              src={url}
                              alt={`Image ${idx + 1}`}
                              className="w-24 h-24 object-cover rounded border border-slate-stone/10 bg-mist-white"
                              onError={e => { e.currentTarget.style.opacity = '0.25'; }}
                            />
                            {idx === 0 ? (
                              <span className="absolute bottom-1 left-1 bg-slate-stone/90 text-white text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded">Principale</span>
                            ) : (
                              /* Changer de photo principale demandait de retirer
                                 les précédentes puis de tout recharger. Un clic
                                 suffit, et l'aperçu suit. */
                              <button
                                type="button"
                                title="Mettre cette photo en première"
                                onClick={() => setProductForm(f => ({
                                  ...f,
                                  images: [f.images[idx], ...f.images.filter((_, i) => i !== idx)],
                                }))}
                                className="absolute inset-x-1 bottom-1 bg-white/90 text-slate-stone text-[9px] tracking-wider uppercase py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Mettre en 1re
                              </button>
                            )}
                            <button
                              type="button"
                              title="Retirer cette image"
                              onClick={() => setProductForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs leading-none shadow hover:bg-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
                        Aucune image. Si vous enregistrez ainsi, le produit s'affichera sans photo.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="…ou collez une URL d'image / un lien Google Drive"
                        value={imageUrlInput}
                        onChange={e => setImageUrlInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          const v = imageUrlInput.trim();
                          if (!v) return;
                          setProductForm(f => ({ ...f, images: [...f.images, v] }));
                          setImageUrlInput('');
                        }}
                        className="px-4 py-2 border rounded flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = imageUrlInput.trim();
                          if (!v) return;
                          setProductForm(f => ({ ...f, images: [...f.images, v] }));
                          setImageUrlInput('');
                        }}
                        className="px-4 py-2 bg-gray-200 rounded text-sm whitespace-nowrap"
                      >
                        Ajouter l'URL
                      </button>
                    </div>
                    <p className="text-xs text-stone-gray mt-1">La première image est celle affichée sur la boutique. Cliquez sur ✕ pour retirer une image ; les autres champs peuvent être modifiés sans y toucher.</p>
                  </section>

                  {/* ── Format et poids ──────────────────────────────────── */}
                  <section id="fiche-format" className="scroll-mt-6 bg-white rounded-2xl border border-slate-stone/10 p-5 sm:p-6 shadow-sm">
                    <EnteteSection section={SECTIONS_FICHE[2]} form={productForm}
                      chapeau="Ce produit existe-t-il en un seul format, ou en plusieurs — 15, 30, 50 ml ?" />
        {/* Format et poids.

            Ces deux champs étaient seuls dans la grille, et le bloc
            des formats multiples se trouvait huit champs plus bas :
            rien ne disait qu'on pouvait en déclarer plusieurs, ni
            que les deux se remplacent l'un l'autre. On pose donc la
            question d'abord — un format, ou plusieurs — et on ne
            montre que les champs de la réponse. */}
        <div className="md:col-span-2 rounded-xl border border-slate-stone/15 bg-ivory/40 p-4">
          <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Format et poids</label>
          <p className="text-[11px] text-stone-gray mb-3">
            Ce produit existe-t-il en un seul format, ou en plusieurs — 15, 30, 50 ml ?
          </p>

          <div className="inline-flex rounded-full border border-slate-stone/20 bg-white p-1 mb-4">
            {[false, true].map((multi) => {
              const enPlusieurs = (productForm.variantes || []).length > 0;
              const actif = enPlusieurs === multi;
              return (
                <button
                  key={String(multi)}
                  type="button"
                  onClick={() => {
                    if (multi) {
                      // Deux lignes d'emblée : une liste à une seule
                      // ligne se lit comme un champ, pas comme une liste.
                      if (!enPlusieurs) {
                        setProductForm({ ...productForm, variantes: [
                          { libelle: '', prix: '', poids: '' },
                          { libelle: '', prix: '', poids: '' },
                        ] });
                      }
                      return;
                    }
                    const remplies = (productForm.variantes || []).filter((v) => v.libelle || v.prix || v.poids);
                    if (remplies.length > 0 && !window.confirm(
                      'Revenir à un format unique effacera les ' + remplies.length + ' format(s) saisi(s). Continuer ?'
                    )) return;
                    setProductForm({ ...productForm, variantes: [] });
                  }}
                  aria-pressed={actif}
                  className={'press rounded-full px-4 py-2 text-xs ' + (actif ? 'bg-slate-stone text-white' : 'text-slate-stone')}
                >
                  {multi ? 'Plusieurs formats' : 'Un seul format'}
                </button>
              );
            })}
          </div>

          {(productForm.variantes || []).length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Contenance</label>
                <input type="text" placeholder="ex : 100 ml, ou 50 g" value={productForm.contenance}
                  onChange={e => setProductForm({...productForm, contenance: e.target.value})}
                  className="px-4 py-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Poids expédié (g)</label>
                <input type="number" min="1" step="1" placeholder="ex : 140" value={productForm.poids}
                  onChange={e => setProductForm({...productForm, poids: e.target.value})}
                  className="px-4 py-2 border rounded w-full" />
                {/* La contenance est ce qu'il y a dedans, le poids ce que
                    la Poste pèse : emballage compris. Un savon de 90 g
                    part souvent à 140 g une fois emballé. */}
                <p className="text-[11px] text-stone-gray mt-1 leading-snug">
                  Emballage compris. Renseigné sur tous les produits d'une commande, il choisit
                  le tarif postal au lieu du forfait. Laissé vide, rien ne change.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-stone-gray mb-3 leading-snug">
                Une seule fiche, et une barre de choix sur le site. Chaque format porte son
                prix et son <strong>poids</strong> — c'est le poids qui décide de l'envoi
                possible : au-delà de 2 kg, la Poste refuse le colis, et le site refusera de
                le proposer. Emballage compris, là aussi.
              </p>
              {/* L'en-tête ne paraît qu'à partir du moment où les
                  colonnes s'alignent. En dessous, chaque champ
                  porte son propre libellé : sur un téléphone, la
                  ligne se plie, et trois nombres sans étiquette ne
                  se distinguent plus une fois saisis. */}
              <div className="hidden sm:grid grid-cols-[1fr_110px_110px_36px] gap-2 mb-1 text-[11px] uppercase tracking-widest text-stone-gray">
                <span>Format</span><span>Prix (CHF)</span><span>Poids (g)</span><span />
              </div>
              {(productForm.variantes || []).map((v, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_110px_110px_36px] gap-2 mb-3 sm:mb-2 pb-3 sm:pb-0 border-b sm:border-0 border-slate-stone/10 last:border-0">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="sm:hidden block text-[10px] uppercase tracking-widest text-stone-gray mb-1">Format</span>
                    <input type="text" placeholder="ex : 50 ml" value={v.libelle} aria-label="Format"
                      onChange={e => setProductForm({
                        ...productForm,
                        variantes: productForm.variantes.map((x, k) => k === i ? { ...x, libelle: e.target.value } : x)
                      })}
                      className="px-4 py-2 border rounded w-full" />
                  </div>
                  <div>
                    <span className="sm:hidden block text-[10px] uppercase tracking-widest text-stone-gray mb-1">Prix (CHF)</span>
                    <input type="number" step="0.05" min="0" placeholder="45.00" value={v.prix} aria-label="Prix en francs"
                      onChange={e => setProductForm({
                        ...productForm,
                        variantes: productForm.variantes.map((x, k) => k === i ? { ...x, prix: e.target.value } : x)
                      })}
                      className="px-4 py-2 border rounded w-full" />
                  </div>
                  <div>
                    <span className="sm:hidden block text-[10px] uppercase tracking-widest text-stone-gray mb-1">Poids (g)</span>
                    <input type="number" step="1" min="0" placeholder="120" value={v.poids} aria-label="Poids en grammes"
                      onChange={e => setProductForm({
                        ...productForm,
                        variantes: productForm.variantes.map((x, k) => k === i ? { ...x, poids: e.target.value } : x)
                      })}
                      className="px-4 py-2 border rounded w-full" />
                  </div>
                  {/* Une croix de 36 px se vise mal au pouce, et le
                      mot dit ce qu'elle fait. À l'écran large, la
                      colonne est trop étroite pour le mot. */}
                  <button type="button" title="Retirer ce format"
                    onClick={() => setProductForm({
                      ...productForm,
                      variantes: productForm.variantes.filter((_, k) => k !== i)
                    })}
                    className="press col-span-2 sm:col-span-1 rounded border px-4 py-2 sm:px-0 sm:py-0 sm:self-end sm:h-[42px] text-xs text-stone-gray hover:text-red-600 hover:border-red-300">
                    <span className="sm:hidden">Retirer ce format</span>
                    <span className="hidden sm:inline">×</span>
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => setProductForm({
                  ...productForm,
                  variantes: [...(productForm.variantes || []), { libelle: '', prix: '', poids: '' }]
                })}
                className="press mt-1 rounded-full border px-4 py-2 text-xs uppercase tracking-widest">
                + Ajouter un format
              </button>

              {/* Ce que la boutique montrera, calculé sous ses yeux :
                  le prix de la fiche et la contenance de la carte
                  viennent des formats, pas des deux champs que ce
                  mode a masqués. Autant le dire ici plutôt que de la
                  laisser le découvrir en ligne. */}
              {(() => {
                const remplies = (productForm.variantes || [])
                  .filter((v) => String(v.libelle).trim() && Number(v.prix) > 0);
                if (remplies.length === 0) return null;
                if (remplies.length === 1) return (
                  <p className="mt-3 text-[11px] text-amber-700 leading-snug">
                    Un seul format rempli : la barre de choix ne s'affichera pas, il n'y aurait
                    rien à choisir. Ajoutez-en un second, ou revenez à « Un seul format ».
                  </p>
                );
                const mini = Math.min(...remplies.map((v) => Number(v.prix)));
                // La même règle que le serveur, sinon l'aperçu
                // promettrait autre chose que ce qui s'affichera.
                const libelles = remplies.map((v) => String(v.libelle).trim());
                const unites = libelles.map((l) => (l.match(/[a-zA-Z]+\.?$/) || [''])[0].toLowerCase());
                const memeUnite = unites[0] && unites.every((u) => u === unites[0]);
                const resume = memeUnite
                  ? libelles.map((l) => l.replace(/\s*[a-zA-Z]+\.?$/, '').trim()).join(' · ') + ' ' + unites[0]
                  : libelles.join(' · ');
                return (
                  <p className="mt-3 text-[11px] text-stone-gray leading-snug">
                    Sur la grille, la carte annoncera <strong>dès CHF {mini.toFixed(2)}</strong>,
                    et sous le nom : <strong>{resume}</strong>.
                    La fiche s'ouvrira sur le format le moins cher.
                  </p>
                );
              })()}
            </div>
          )}
        </div>
                  </section>

                  {/* ── Texte ────────────────────────────────────────────── */}
                  <section id="fiche-texte" className="scroll-mt-6 bg-white rounded-2xl border border-slate-stone/10 p-5 sm:p-6 shadow-sm">
                    <EnteteSection section={SECTIONS_FICHE[3]} form={productForm}
                      chapeau="Ce que Google lit, et ce qu'une cliente lit avant d'acheter. Ce sont les mêmes mots." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Description (HTML accepté)</label>
                        <RichTextEditor
                          value={productForm.description}
                          onChange={(html) => setProductForm({ ...productForm, description: html })}
                          placeholder="Description du produit — utilisez les boutons ci-dessus pour les sous-titres et le gras"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Ingrédients (en français)</label>
                        <textarea rows={4} placeholder="Tels que vous les diriez à une cliente." value={productForm.ingredients}
                          onChange={e => setProductForm({...productForm, ingredients: e.target.value})}
                          className="px-4 py-2 border rounded w-full" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Liste INCI</label>
                        <textarea rows={4} placeholder="La nomenclature réglementaire, telle qu'elle figure sur l'étiquette." value={productForm.inci}
                          onChange={e => setProductForm({...productForm, inci: e.target.value})}
                          className="px-4 py-2 border rounded w-full" />
                        <p className="text-[11px] text-stone-gray mt-1">
                          Aucune mise en évidence des allergènes n'est faite : elle demanderait de les saisir un à un, produit par produit.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* ── Découverte ───────────────────────────────────────── */}
                  <section id="fiche-decouverte" className="scroll-mt-6 bg-white rounded-2xl border border-slate-stone/10 p-5 sm:p-6 shadow-sm">
                    <EnteteSection section={SECTIONS_FICHE[4]} form={productForm}
                      chapeau="Ce par quoi on tombe sur la fiche sans la chercher : les filtres de la boutique." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Types de peau</label>
                        <input type="text" placeholder="ex : sèche, sensible" value={productForm.typePeauText}
                          onChange={e => setProductForm({...productForm, typePeauText: e.target.value})}
                          className="px-4 py-2 border rounded w-full" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Besoins</label>
                        <input type="text" placeholder="ex : hydratation, apaisement" value={productForm.besoinsText}
                          onChange={e => setProductForm({...productForm, besoinsText: e.target.value})}
                          className="px-4 py-2 border rounded w-full" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Étiquettes libres</label>
                        <input type="text" placeholder="une par ligne, ou séparées par des virgules" value={productForm.etiquettesText}
                          onChange={e => setProductForm({...productForm, etiquettesText: e.target.value})}
                          className="px-4 py-2 border rounded w-full" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Prix en recharge (CHF)</label>
                        <input type="number" step="0.05" min="0" placeholder="ex : 15.00"
                          value={productForm.rechargePrix}
                          onChange={e => setProductForm({...productForm, rechargePrix: e.target.value})}
                          className="px-4 py-2 border rounded w-full" />
                        <p className="text-[11px] text-stone-gray mt-1 leading-snug">
                          Si la cliente rapporte son flacon. Laissé vide, aucune recharge n'est proposée.
                          Une recharge se retire <strong>à la boutique</strong> — le serveur refuse de
                          l'expédier, et facture bien ce prix-là, pas le prix plein.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* ── Liens ────────────────────────────────────────────── */}
                  <section id="fiche-liens" className="scroll-mt-6 bg-white rounded-2xl border border-slate-stone/10 p-5 sm:p-6 shadow-sm">
                    <EnteteSection section={SECTIONS_FICHE[5]} form={productForm}
                      chapeau="Ce qui relie cette fiche aux autres — et retient la visite une fiche de plus." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">
                          « Vous aimerez aussi » — jusqu'à 4 produits
                        </label>
                        <p className="text-[11px] text-stone-gray mb-2">
                          Laissé vide, le site propose automatiquement des produits de la même catégorie.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {(productForm.related || []).map((rid) => {
                            const p = products.find((x) => x.id === rid);
                            return (
                              <span key={rid} className="inline-flex items-center gap-2 bg-mist-white border border-slate-stone/15 rounded-full px-3 py-1 text-xs text-slate-stone">
                                {p ? p.name.slice(0, 40) : rid}
                                <button type="button" aria-label="Retirer"
                                  onClick={() => setProductForm({ ...productForm, related: productForm.related.filter((x) => x !== rid) })}
                                  className="text-red-500 hover:text-red-700">×</button>
                              </span>
                            );
                          })}
                          {(productForm.related || []).length === 0 && (
                            <span className="text-xs text-stone-gray/70">Sélection automatique</span>
                          )}
                        </div>
                        {/* Une liste déroulante de 170 noms, dans l'ordre de la
                            base : elle demandait « une boîte de recherche » et
                            « l'ordre alphabétique ou par catégorie ». Les deux,
                            avec la contenance pour distinguer les formats. */}
                        {(productForm.related || []).length >= 4 ? (
                          <p className="text-xs text-stone-gray/70">Maximum atteint (4). Retirez-en un pour en choisir un autre.</p>
                        ) : (
                          <div className="border rounded">
                            <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-mist-white/60">
                              <input type="search" value={rechercheLies}
                                onChange={(e) => setRechercheLies(e.target.value)}
                                placeholder="Rechercher un produit…"
                                className="flex-1 min-w-[12rem] px-3 py-1.5 border rounded text-sm bg-white" />
                              <div className="flex rounded border overflow-hidden text-xs">
                                {[['alpha', 'A → Z'], ['categorie', 'Par catégorie']].map(([v, libelle]) => (
                                  <button key={v} type="button" onClick={() => setClassementLies(v)}
                                    aria-pressed={classementLies === v}
                                    className={`px-3 py-1.5 ${classementLies === v ? 'bg-slate-stone text-white' : 'bg-white text-stone-gray hover:bg-mist-white'}`}>
                                    {libelle}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                              {(() => {
                                const groupes = groupesLies(products, productForm, rechercheLies, classementLies);
                                if (groupes.length === 0) return <p className="p-3 text-xs text-stone-gray/70">Aucun produit ne correspond.</p>;
                                return groupes.map(([groupe, liste]) => (
                                  <div key={groupe || '-'}>
                                    {groupe && (
                                      <p className="sticky top-0 bg-white/95 px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-mist-blue font-medium border-b border-slate-stone/5">
                                        {groupe}
                                      </p>
                                    )}
                                    {liste.map((p) => (
                                      <button key={p.id} type="button"
                                        onClick={() => {
                                          setProductForm({ ...productForm, related: [...(productForm.related || []), p.id] });
                                          setRechercheLies('');
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-sm text-slate-stone hover:bg-mist-white flex justify-between gap-3">
                                        <span>{p.name}</span>
                                        {p.contenance && <span className="text-xs text-stone-gray/70 shrink-0">{p.contenance}</span>}
                                      </button>
                                    ))}
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Rituel</label>
                        <p className="text-[11px] text-stone-gray mb-2">
                          Donnez le même identifiant à tous les produits d'un même rituel — par exemple
                          <em> rituel-visage</em> — puis numérotez les étapes. Le bloc « Le rituel complet »
                          apparaît alors sur chacune de leurs fiches. Laissé vide, rien ne s'affiche.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input type="text" placeholder="Identifiant du rituel" value={productForm.rituelId}
                            onChange={e => setProductForm({...productForm, rituelId: e.target.value})}
                            className="px-4 py-2 border rounded w-full" />
                          <input type="text" inputMode="numeric" placeholder="N° d'étape" value={productForm.rituelEtape}
                            onChange={e => setProductForm({...productForm, rituelEtape: e.target.value})}
                            className="px-4 py-2 border rounded w-full" />
                          <input type="text" placeholder="Le geste, en une phrase" value={productForm.rituelGeste}
                            onChange={e => setProductForm({...productForm, rituelGeste: e.target.value})}
                            className="px-4 py-2 border rounded w-full" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* L'aperçu passe SOUS le formulaire en dessous de 1024 px :
                      en colonne étroite, il volerait la place de la saisie. */}
                  <div className="xl:hidden">
                    <ApercuFiche productForm={productForm} />
                  </div>
                </div>

                <div className="hidden xl:block">
                  <ApercuFiche productForm={productForm} />
                </div>

                {/* La barre d'action.

                    Le bouton d'enregistrement se trouvait tout en bas, après
                    vingt champs : il fallait traverser la fiche entière pour
                    l'atteindre, et rien ne disait s'il restait quelque chose à
                    enregistrer. */}
                <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 flex-wrap px-4 sm:px-8 py-3 bg-white/95 backdrop-blur-md border-t border-slate-stone/10 shadow-[0_-8px_24px_rgba(58,51,43,.06)]">
                  <span className="flex items-center gap-2 text-xs text-stone-gray">
                    <span className={`w-1.5 h-1.5 rounded-full ${ficheModifiee ? 'bg-amber-600' : 'bg-slate-stone/25'}`} />
                    {ficheModifiee
                      ? 'Modifications non enregistrées'
                      : (productForm.id ? 'Fiche à jour' : 'Nouvelle fiche')}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    {productForm.id && (
                      <button type="button"
                        onClick={() => {
                          if (ficheModifiee && !window.confirm('Abandonner les modifications en cours ?')) return;
                          setProductForm(emptyProductForm);
                          setCustomBadge(false);
                          setEmpreinteOuverture(JSON.stringify(emptyProductForm));
                        }}
                        className="px-6 py-2 border border-slate-stone/20 text-stone-gray rounded-full text-xs uppercase tracking-widest hover:border-slate-stone hover:text-slate-stone transition-colors">
                        Annuler
                      </button>
                    )}
                    <button type="submit" className="px-7 py-2.5 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest">
                      {productForm.id ? 'Enregistrer les modifications' : 'Ajouter le produit'}
                    </button>
                  </span>
                </div>
              </form>
            </div>

            <div className="mb-4 flex items-center gap-3 flex-wrap">
              {/* Effacer la recherche demandait d'appuyer sur la touche
                  d'effacement autant de fois qu'il y avait de lettres. */}
              <div className="relative w-full max-w-xs">
                <input type="text" placeholder="Rechercher un produit..." value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setProductsPage(1); }}
                  onKeyDown={e => { if (e.key === 'Escape') { setProductSearch(''); setProductsPage(1); } }}
                  className="px-4 py-2 pr-10 border rounded w-full" />
                {productSearch && (
                  <button type="button" aria-label="Effacer la recherche"
                    onClick={() => { setProductSearch(''); setProductsPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-stone-gray hover:bg-mist-white hover:text-slate-stone leading-none">
                    ×
                  </button>
                )}
              </div>
              <div className="inline-flex rounded-full border border-slate-stone/15 bg-white p-1">
                {[
                  { cle: 'alpha', nom: 'A → Z' },
                  { cle: 'rubrique', nom: 'Par rubrique' },
                  { cle: 'boutique', nom: 'Ordre de la boutique' },
                ].map((t) => (
                  <button
                    key={t.cle}
                    type="button"
                    aria-pressed={triProduits === t.cle}
                    onClick={() => { setTriProduits(t.cle); setProductsPage(1); }}
                    className={`px-3.5 py-1.5 rounded-full text-xs transition-colors ${
                      triProduits === t.cle ? 'bg-slate-stone text-white' : 'text-stone-gray hover:text-slate-stone'
                    }`}
                  >
                    {t.nom}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-sm text-stone-gray whitespace-nowrap">{produitsListes.length} produit(s)</span>
            </div>

            <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-stone text-white font-sans text-xs tracking-widest uppercase">
                  <tr>
                    <th className="p-4">Produit</th>
                    <th className="p-4">Catégories</th>
                    <th className="p-4">Prix</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Fiche</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalPages = Math.max(1, Math.ceil(produitsListes.length / PRODUCTS_PER_PAGE));
                    const page = Math.min(productsPage, totalPages);
                    const tranche = produitsListes.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);
                    // L'intertitre reparaît en tête de chaque page : une rubrique
                    // qui enjambe deux pages laisserait sinon la seconde sans nom.
                    let rubriquePrecedente = null;
                    return tranche.map((p) => {
                    const rubrique = (p.collections || [])[0] || 'Sans rubrique';
                    const nouvelleRubrique = triProduits === 'rubrique' && rubrique !== rubriquePrecedente;
                    rubriquePrecedente = rubrique;
                    return (
                    <React.Fragment key={p.id}>
                    {nouvelleRubrique && (
                      <tr className="bg-mist-white">
                        <td colSpan={6} className="px-4 py-2 font-sans text-[11px] uppercase tracking-[0.2em] text-stone-gray">
                          {rubrique}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b align-top">
                      <td className="p-4 flex items-center gap-3">
                        {/* Une vignette de 40 px chargeait la photo entière : 109 Ko par
                            ligne pour les images du catalogue, jusqu'à 4,5 Mo pour
                            celles téléversées depuis. Vingt-cinq lignes par page. */}
                        {p.images && p.images[0] && <img src={imageUrl(p.images[0], 400)} alt="" loading="lazy" className="w-10 h-10 object-cover rounded" />}
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{p.name}</span>
                          {p.inStock === false && (
                            <span className="inline-block self-start bg-red-100 text-red-700 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-medium">Épuisé</span>
                          )}
                          {p.enLigne === false && (
                            <span className="inline-block self-start bg-amber-100 text-amber-800 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-medium">En attente</span>
                          )}
                          {/* Dupliquer une fiche pour en dériver une variante est
                              normal — c'est le nom qu'on oublie ensuite. Trois
                              fiches sont restées « (copie) » en boutique, et la
                              cliente a signalé « le même produit plusieurs fois » :
                              rien ne les distinguait à l'œil, seul le prix
                              changeait. Le rappel se fait donc là où elle regarde. */}
                          {/\(copie\)/i.test(p.name || '') && (
                            <span className="inline-block self-start bg-amber-100 text-amber-800 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-medium">
                              À renommer
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-stone-gray">{(p.collections || []).join(', ')}</td>
                      <td className="p-4 whitespace-nowrap">CHF {p.price}</td>
                      <td className="p-4 whitespace-nowrap">
                        {p.stock == null ? (
                          <span className="text-stone-gray/50">—</span>
                        ) : (
                          <span className={
                            p.stock === 0 ? 'text-red-700 font-semibold'
                              : p.stock <= 3 ? 'text-amber-700 font-medium'
                              : 'text-slate-stone'
                          }>
                            {p.stock}
                          </span>
                        )}
                      </td>
                                            <td className="p-4">
                        {/* Ou en est cette fiche. Trois champs comptent pour la boutique et
                            pour ses CGV : la composition, la contenance, le poids. Sur 178
                            produits, sans repere visible on ne sait pas ce qui reste. */}
                        <span className="flex gap-1">
                          {[["INCI", p.inci], ["Cont.", p.contenance], ["Poids", p.poids]].map(([nom, v]) => (
                            <span key={nom} title={v ? `${nom} : renseigné` : `${nom} : à remplir`}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${v ? "bg-green-50 text-green-700" : "bg-slate-stone/5 text-stone-gray/50"}`}>
                              {nom}
                            </span>
                          ))}
                        </span>
                      </td>
<td className="p-4">
                        <div className="flex gap-3">
                          <button onClick={() => {
                            // Duplicate: same content, no id -> the form saves it
                            // as a new product. Name is suffixed so the two are
                            // distinguishable in the list.
                            setCustomBadge(!!p.ribbon && !['coming-soon', 'best-seller'].includes(p.ribbon));
                            const forme = chargerProduitDansFormulaire(p, { copie: true });
                            setProductForm(forme);
                            setEmpreinteOuverture(JSON.stringify(forme));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} className="text-slate-stone underline">Dupliquer</button>
                          <button onClick={() => {
                            setCustomBadge(!!p.ribbon && !['coming-soon', 'best-seller'].includes(p.ribbon));
                            const forme = chargerProduitDansFormulaire(p);
                            setProductForm(forme);
                            setEmpreinteOuverture(JSON.stringify(forme));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} className="text-blue-500 underline">Modifier</button>
                          <button onClick={() => {
                            if (window.confirm(`Supprimer le produit "${p.name}" ? Cette action est irréversible.`)) {
                              fetch(`/api/admin/products/${p.id}`, { method: 'DELETE', headers: fetchHeaders })
                                .then(res => { if (!res.ok) throw new Error('Erreur de suppression'); return res.json(); })
                                .then(() => loadData())
                                .catch(err => alert(err.message));
                            }
                          }} className="text-red-500 underline">Supprimer</button>
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  );
                  });
                  })()}
                </tbody>
              </table>
            </div>

            {(() => {
              const totalPages = Math.max(1, Math.ceil(produitsListes.length / PRODUCTS_PER_PAGE));
              const page = Math.min(productsPage, totalPages);
              if (totalPages <= 1) return null;
              return (
                <div className="mt-4 flex items-center justify-center gap-4">
                  <button
                    onClick={() => setProductsPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 rounded border border-slate-stone/10 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-mist-white"
                  >← Précédent</button>
                  <span className="text-sm text-stone-gray">Page {page} / {totalPages}</span>
                  <button
                    onClick={() => setProductsPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-4 py-2 rounded border border-slate-stone/10 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-mist-white"
                  >Suivant →</button>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'workshops' && (
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-8">Gestion des Ateliers</h1>
            
            <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 shadow-sm mb-8">
              <h3 className="font-serif text-xl text-slate-stone mb-4">{workshopForm.id ? 'Modifier l\'atelier' : 'Ajouter un atelier'}</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const url = workshopForm.id ? `/api/admin/workshops/${workshopForm.id}` : '/api/admin/workshops';
                const method = workshopForm.id ? 'PUT' : 'POST';
                fetch(url, {
                  method,
                  headers: fetchHeaders,
                  body: JSON.stringify(workshopForm)
                })
                .then(res => {
                  if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
                  return res.json();
                })
                .then(() => {
                  setWorkshopForm({ id: null, title: '', description: '', price: '', duration: '', image_url: '' });
                  loadData();
                })
                .catch(err => alert(err.message));
              }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" required placeholder="Titre" value={workshopForm.title} onChange={e => setWorkshopForm({...workshopForm, title: e.target.value})} className="px-4 py-2 border rounded" />
                <input type="text" required placeholder="Prix" value={workshopForm.price} onChange={e => setWorkshopForm({...workshopForm, price: e.target.value})} className="px-4 py-2 border rounded" />
                <input type="text" placeholder="Durée (ex: 2 heures)" value={workshopForm.duration} onChange={e => setWorkshopForm({...workshopForm, duration: e.target.value})} className="px-4 py-2 border rounded" />
                {/* La date et l heure de la séance. Facultative : un atelier sans
                    date reste un Service pour les moteurs ; avec une date il
                    devient un Event, le seul type qui remonte dans le carrousel
                    d événements et sur Maps. */}
                <input type="datetime-local" placeholder="Date de la séance" title="Date et heure de la séance (facultatif)" value={workshopForm.starts_at || ''} onChange={e => setWorkshopForm({...workshopForm, starts_at: e.target.value})} className="px-4 py-2 border rounded" />
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded cursor-pointer text-sm font-medium ${workshopImageUploading ? 'bg-gray-200 text-stone-gray cursor-wait' : 'bg-slate-stone text-white hover:opacity-90'}`}>
                      {workshopImageUploading ? 'Téléversement…' : '📤 Téléverser une image'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={workshopImageUploading} onChange={handleWorkshopImageUpload} className="hidden" />
                    </label>
                    {workshopForm.image_url && <img src={workshopForm.image_url} alt="" className="w-12 h-12 object-cover rounded border" />}
                  </div>
                  <input type="text" placeholder="…ou URL d'image (ex: /workshop.png)" value={workshopForm.image_url} onChange={e => setWorkshopForm({...workshopForm, image_url: e.target.value})} className="px-4 py-2 border rounded w-full" />
                </div>
                <div className="md:col-span-2">
                  <RichTextEditor
                    value={workshopForm.description}
                    onChange={(html) => setWorkshopForm({ ...workshopForm, description: html })}
                    placeholder="Description de l'atelier"
                    minHeight={140}
                  />
                </div>
                <div className="md:col-span-2 flex gap-4">
                  <button type="submit" className="px-6 py-2 bg-slate-stone text-white rounded">Enregistrer</button>
                  {workshopForm.id && <button type="button" onClick={() => setWorkshopForm({ id: null, title: '', description: '', price: '', duration: '', image_url: '' })} className="px-6 py-2 bg-gray-200 rounded">Annuler</button>}
                </div>
              </form>
            </div>

            <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-stone text-white font-sans text-xs tracking-widest uppercase">
                  <tr>
                    <th className="p-4">Titre</th>
                    <th className="p-4">Prix</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workshops.map((ws, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-4">{ws.title}</td>
                      <td className="p-4">CHF {ws.price}</td>
                      <td className="p-4 flex gap-2">
                        <button onClick={() => setWorkshopForm(ws)} className="text-blue-500 underline">Modifier</button>
                        <button onClick={() => {
                          if (window.confirm('Supprimer ?')) {
                            fetch(`/api/admin/workshops/${ws.id}`, { method: 'DELETE', headers: fetchHeaders })
                            .then(() => loadData());
                          }
                        }} className="text-red-500 underline">Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Inbox */}
        {activeTab === 'inbox' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl text-slate-stone">Boîte de réception</h1>
                <p className="text-xs text-stone-gray font-light mt-1">Messages reçus sur {inboxSettings.user || 'la boîte mail'}.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadInbox} className="px-4 py-2 bg-white rounded-lg border border-slate-stone/10 text-xs text-stone-gray hover:bg-slate-stone/5 transition-all">Rafraîchir 🔄</button>
                <button onClick={() => setShowInboxSettings(s => !s)} className="px-4 py-2 bg-white rounded-lg border border-slate-stone/10 text-xs text-stone-gray hover:bg-slate-stone/5 transition-all">{showInboxSettings ? 'Masquer' : 'Paramètres'} ⚙️</button>
              </div>
            </div>

            {showInboxSettings && (
              <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-6">
                <h3 className="font-serif text-lg text-slate-stone mb-4">Paramètres IMAP (lecture des e-mails)</h3>
                {inboxSettingsStatus.success && <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm">{inboxSettingsStatus.success}</div>}
                {inboxSettingsStatus.error && <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{inboxSettingsStatus.error}</div>}
                <form onSubmit={handleSaveInboxSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-slate-stone mb-2">Serveur IMAP</label>
                    <input value={inboxForm.host} onChange={e => setInboxForm({ ...inboxForm, host: e.target.value })} placeholder="mail.infomaniak.com" className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-slate-stone/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-slate-stone mb-2">Port</label>
                    <input value={inboxForm.port} onChange={e => setInboxForm({ ...inboxForm, port: e.target.value })} placeholder="993" className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-slate-stone/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-slate-stone mb-2">Nom d'utilisateur (e-mail)</label>
                    <input type="email" value={inboxForm.user} onChange={e => setInboxForm({ ...inboxForm, user: e.target.value })} placeholder="contact@soyoucosmetics.com" className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-slate-stone/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-slate-stone mb-2">Mot de passe</label>
                    <input type="password" autoComplete="new-password" value={inboxForm.pass} onChange={e => setInboxForm({ ...inboxForm, pass: e.target.value })} placeholder={inboxSettings.passConfigured ? 'Laisser vide pour conserver' : '••••••••'} className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-slate-stone/40" />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-stone">
                      <input type="checkbox" checked={inboxForm.secure} onChange={e => setInboxForm({ ...inboxForm, secure: e.target.checked })} />
                      <span>Connexion sécurisée (SSL/TLS)</span>
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" disabled={inboxSettingsSaving} className="px-6 py-3 bg-slate-stone text-white font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-slate-stone/90 transition-all shadow-md disabled:opacity-50">
                      {inboxSettingsSaving ? 'Sauvegarde…' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {inboxError && (
              <div className="mb-4 p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-sm">
                {inboxError}
              </div>
            )}

            {inboxLoading ? (
              <div className="py-24 text-center text-stone-gray/60">Chargement de la boîte…</div>
            ) : inboxMessages.length === 0 && !inboxError ? (
              <div className="py-24 text-center bg-white rounded-3xl border border-slate-stone/5 text-stone-gray">Aucun message.</div>
            ) : inboxMessages.length > 0 ? (
              <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-hidden shadow-sm">
                {inboxMessages.map(msg => (
                  <button key={msg.uid} onClick={() => openInboxMessage(msg.uid)} className={`w-full text-left p-5 border-b border-slate-stone/5 hover:bg-mist-white/40 transition-colors flex items-center gap-4 ${msg.seen ? 'text-stone-gray' : 'text-slate-stone font-medium'}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${msg.seen ? 'bg-transparent' : 'bg-slate-stone'}`}></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{(msg.from[0]?.name) || msg.from[0]?.address || 'Inconnu'}</p>
                      <p className="text-xs text-stone-gray truncate">{msg.subject}</p>
                    </div>
                    <span className="text-xs text-stone-gray/60 shrink-0">{msg.date ? new Date(msg.date).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Tab: API SumUp */}
        {activeTab === 'content' && <ContentEditor fetchHeaders={fetchHeaders} />}

        {activeTab === 'journal' && <JournalEditor fetchHeaders={fetchHeaders} />}
        {activeTab === 'infolettre' && <InfolettreEditor fetchHeaders={fetchHeaders} />}
        {activeTab === 'paniers' && <PaniersAbandonnes fetchHeaders={fetchHeaders} onRelancer={setEmailModal} />}

        {activeTab === 'shop' && <ShopSettings fetchHeaders={fetchHeaders} />}

        {activeTab === 'sumup' && (
          <div className="max-w-2xl">
            <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">API SumUp</h1>
            <p className="text-sm text-stone-gray mb-8">Clés d'accès SumUp utilisées pour encaisser les paiements. Modifiable uniquement par l'administrateur.</p>

            <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-10 shadow-sm space-y-6">
              {sumupStatus.success && (
                <div className="p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium">{sumupStatus.success}</div>
              )}
              {sumupStatus.error && (
                <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{sumupStatus.error}</div>
              )}

              <div className="p-4 bg-mist-white rounded-2xl border border-slate-stone/10 text-sm text-stone-gray">
                <p className="mb-2"><strong className="text-slate-stone">Statut actuel :</strong></p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Clé API : {sumupSettings.apiKeyConfigured ? <span className="text-green-600 font-medium">configurée (•••• {sumupSettings.apiKeyLast4})</span> : <span className="text-amber-600 font-medium">non configurée</span>}</li>
                  <li>Email vendeur : {sumupSettings.merchantEmail ? <span className="text-slate-stone font-medium">{sumupSettings.merchantEmail}</span> : <span className="text-amber-600">non configuré</span>}</li>
                  <li>Secret webhook : {sumupSettings.webhookSecretConfigured ? <span className="text-green-600 font-medium">configuré</span> : <span className="text-stone-gray">facultatif, non configuré</span>}</li>
                </ul>
              </div>

              <form onSubmit={handleSaveSumup} className="space-y-6">
                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Clé API SumUp</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      value={sumupForm.apiKey}
                      onChange={(e) => setSumupForm({ ...sumupForm, apiKey: e.target.value })}
                      className="flex-1 bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"
                      placeholder={sumupSettings.apiKeyConfigured ? `Laisser vide pour conserver •••• ${sumupSettings.apiKeyLast4}` : 'sup_sk_…'}
                    />
                    {sumupSettings.apiKeyConfigured && (
                      <button type="button" onClick={() => clearSumupField('apiKey')} className="px-4 py-3 text-xs uppercase tracking-widest font-bold text-red-600 hover:bg-red-50 rounded-2xl border border-red-100">Effacer</button>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-gray/70 mt-2">Trouvée dans SumUp → Paramètres → API. Stockée chiffrée côté serveur, jamais renvoyée en clair.</p>
                </div>

                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Email vendeur SumUp</label>
                  <input
                    type="email"
                    value={sumupForm.merchantEmail}
                    onChange={(e) => setSumupForm({ ...sumupForm, merchantEmail: e.target.value })}
                    className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"
                    placeholder="votre-email@example.com"
                  />
                  <p className="text-[11px] text-stone-gray/70 mt-2">Compte SumUp qui reçoit les paiements.</p>
                </div>

                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Secret webhook (facultatif)</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      value={sumupForm.webhookSecret}
                      onChange={(e) => setSumupForm({ ...sumupForm, webhookSecret: e.target.value })}
                      className="flex-1 bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"
                      placeholder={sumupSettings.webhookSecretConfigured ? 'Laisser vide pour conserver' : 'Optionnel mais recommandé'}
                    />
                    {sumupSettings.webhookSecretConfigured && (
                      <button type="button" onClick={() => clearSumupField('webhookSecret')} className="px-4 py-3 text-xs uppercase tracking-widest font-bold text-red-600 hover:bg-red-50 rounded-2xl border border-red-100">Effacer</button>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-gray/70 mt-2">À configurer si SumUp signe ses webhooks. URL webhook : <code className="text-xs">https://soyoucosmetics.com/api/sumup/webhook</code></p>
                </div>

                <button
                  type="submit"
                  disabled={sumupSaving}
                  className="px-8 py-3 bg-slate-stone text-white font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-slate-stone/90 transition-all duration-300 shadow-md disabled:opacity-50"
                >
                  {sumupSaving ? 'Sauvegarde…' : 'Enregistrer'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 4: Settings (Change Password) */}
        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-8">Sécurité et paramètres</h1>
            
            <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-10 shadow-sm">
              <h3 className="font-serif text-xl text-slate-stone mb-6">Modifier le mot de passe</h3>
              
              {passwordStatus.success && (
                <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium">
                  {passwordStatus.success}
                </div>
              )}
              {passwordStatus.error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">
                  {passwordStatus.error}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Mot de passe actuel</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"
                    placeholder="Ancien mot de passe"
                  />
                </div>
                
                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"
                    placeholder="Minimum 6 caractères"
                  />
                </div>
                
                <div>
                  <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"
                    placeholder="Confirmer"
                  />
                </div>

                <button
                  type="submit"
                  className="px-8 py-3 bg-slate-stone text-white font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-slate-stone/90 transition-all duration-300 shadow-md"
                >
                  Mettre à jour
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-stone/5 max-h-[85vh] overflow-y-auto">
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-serif text-2xl text-slate-stone">Détails de la commande</h3>
                <p className="font-mono text-sm text-stone-gray font-bold mt-1">{selectedOrder.id}</p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-10 h-10 rounded-full bg-mist-white flex items-center justify-center hover:bg-slate-stone hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-slate-stone leading-relaxed mb-8">
              <div>
                <h4 className="font-sans text-xs tracking-widest uppercase font-bold text-stone-gray/60 mb-2">Informations Client</h4>
                <p className="font-semibold text-base">{selectedOrder.customer_name}</p>
                {selectedOrder.customer_company && (
                  <p className="text-xs text-stone-gray mt-0.5">{selectedOrder.customer_company}</p>
                )}
                <p className="font-mono text-xs mt-0.5">{selectedOrder.customer_email}</p>
                {/* Cliquable : sur un téléphone, c'est un appel ; sur l'ordinateur
                    de la boutique, c'est un numéro qu'on lit sans le recopier. */}
                {selectedOrder.customer_phone && (
                  <p className="font-mono text-xs mt-0.5">
                    <a href={`tel:${selectedOrder.customer_phone.replace(/\s+/g, '')}`} className="hover:underline">
                      {selectedOrder.customer_phone}
                    </a>
                  </p>
                )}
                <p className="text-xs text-stone-gray mt-2">
                  Commandée le : {new Date(selectedOrder.created_at).toLocaleString('fr-CH', { dateStyle: 'long', timeStyle: 'short' })}
                </p>

                {/* Le mode d'expédition et, s'il y a lieu, l'adresse. Sans eux,
                    un retrait en boutique et un envoi Priority se ressemblaient
                    dans la fiche, et il fallait écrire à la cliente après
                    paiement pour savoir où livrer. */}
                {selectedOrder.shipping && (
                  <p className="text-xs text-stone-gray mt-2">
                    Expédition : <span className="text-slate-stone">{selectedOrder.shipping.label || '—'}</span>
                    {Number(selectedOrder.shipping.cost) > 0
                      ? ` — CHF ${Number(selectedOrder.shipping.cost).toFixed(2)}`
                      : ' — offerte'}
                  </p>
                )}

                {selectedOrder.address && selectedOrder.address.line1 ? (
                  <div className="mt-3 rounded-xl bg-mist-white px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-gray/60 mb-1">Adresse de livraison</p>
                    <p className="text-sm leading-snug">
                      {selectedOrder.customer_name}<br />
                      {selectedOrder.address.line1}<br />
                      {selectedOrder.address.line2 ? <>{selectedOrder.address.line2}<br /></> : null}
                      {selectedOrder.address.zip} {selectedOrder.address.city}
                      {selectedOrder.address.country && selectedOrder.address.country !== 'CH'
                        ? <><br />{selectedOrder.address.country}</>
                        : null}
                    </p>
                  </div>
                ) : selectedOrder.shipping && selectedOrder.shipping.id === 'pickup' ? (
                  <p className="mt-3 text-xs text-stone-gray">À retirer à la boutique — pas d'adresse à saisir.</p>
                ) : null}

                {/* L'acceptation des conditions générales, datée. Une preuve
                    qu'on ne peut pas produire ne sert à rien : elle est écrite
                    ici pour être lue le jour où une commande est contestée.
                    Les commandes antérieures à cette trace ne l'ont pas — on
                    le dit plutôt que de laisser croire à un refus. */}
                {selectedOrder.cgv && selectedOrder.cgv.acceptees ? (
                  <p className="text-xs text-stone-gray mt-2">
                    Conditions générales acceptées le{' '}
                    <span className="text-slate-stone">
                      {new Date(selectedOrder.cgv.date).toLocaleString('fr-CH', { dateStyle: 'long', timeStyle: 'short' })}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-stone-gray/60 mt-2">
                    Acceptation des conditions non enregistrée (commande antérieure au suivi).
                  </p>
                )}
              </div>

              <div>
                <h4 className="font-sans text-xs tracking-widest uppercase font-bold text-stone-gray/60 mb-2">Suivi Commande</h4>
                <label className="block text-xs font-medium text-stone-gray mb-1.5">Modifier le Statut :</label>
                <select 
                  value={selectedOrder.status}
                  onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                  className="bg-mist-white border border-slate-stone/10 rounded-xl px-4 py-2 font-sans text-sm focus:outline-none w-full max-w-[200px]"
                >
                  <option value="Pending">En attente (Pending)</option>
                  <option value="Paid">Payé (Paid)</option>
                  <option value="ReadyForPickup">À retirer (Ready)</option>
                  <option value="Shipped">Envoyé (Shipped)</option>
                  {/* Le serveur acceptait déjà ces deux statuts ; ils
                      n'apparaissaient nulle part dans le menu, si bien qu'une
                      commande d'essai ne pouvait pas être écartée. Une commande
                      annulée ne compte plus dans le chiffre d'affaires. */}
                  <option value="Cancelled">Annulée</option>
                  <option value="Refunded">Remboursée</option>
                </select>
                {/* La suppression ne paraît qu'une fois la commande écartée.
                    Tant qu'elle est vivante, il n'y a rien à effacer — et un
                    bouton rouge dormant à côté du menu finirait par se cliquer. */}
                {['Cancelled', 'Refunded'].includes(selectedOrder.status) && (
                  <div className="mt-4 pt-4 border-t border-slate-stone/10">
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(selectedOrder)}
                      className="text-xs text-red-700 hover:text-red-900 underline underline-offset-2"
                    >
                      Supprimer définitivement cette commande
                    </button>
                    <p className="text-[11px] text-stone-gray mt-1 leading-snug max-w-[46ch]">
                      Il faudra recopier son numéro. Une copie est conservée sur le
                      serveur, hors de la liste.
                    </p>
                  </div>
                )}
                <button 
                  onClick={() => {
                    setEmailModal({ 
                      isOpen: true, 
                      to: selectedOrder.customer_email, 
                      subject: `Votre commande ${selectedOrder.id} - So You Cosmetics`, 
                      message: `Bonjour ${selectedOrder.customer_name},\n\nConcernant votre commande ${selectedOrder.id}.\n\n` 
                    });
                    setSelectedOrder(null); // Close order detail modal
                  }}
                  className="mt-4 block w-full max-w-[200px] text-center py-2 bg-slate-stone text-white font-sans uppercase tracking-[0.2em] text-[10px] rounded-full hover:bg-slate-stone/90 transition-all"
                >
                  ✉️ Écrire au client
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-stone/10 my-6"></div>

            <h4 className="font-sans text-xs tracking-widest uppercase font-bold text-stone-gray/60 mb-4">Articles achetés</h4>
            <div className="space-y-4 mb-6 max-h-56 overflow-y-auto">
              {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center gap-3 text-sm font-light">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* La photo vient du serveur, cherchée au catalogue par
                        identifiant — la commande, elle, ne l'enregistre pas.
                        Un cadre neutre quand le produit n'a pas de photo ou
                        n'existe plus : mieux qu'une image cassée. */}
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="w-11 h-11 rounded-lg object-cover border border-slate-stone/10 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-mist-white border border-slate-stone/10 shrink-0" />
                    )}
                    <span className="font-medium truncate">
                      {item.qty > 1 && <span className="text-stone-gray">{item.qty} × </span>}
                      {item.name}
                    </span>
                  </div>
                  <span className="font-mono text-stone-gray shrink-0">CHF {parseFloat(item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-slate-stone/10 my-6"></div>
            
            <div className="flex justify-between items-center font-sans text-lg font-medium text-slate-stone">
              <span>Total Commande</span>
              <span className="text-xl font-serif">CHF {selectedOrder.total.toFixed(2)}</span>
            </div>

            {/* Fulfillment block: mark as ready (pickup) or shipped (carrier + tracking) */}
            <div className="h-px bg-slate-stone/10 my-6"></div>
            <h4 className="font-sans text-xs tracking-widest uppercase font-bold text-stone-gray/60 mb-4">Marquer comme prêt</h4>

            {selectedOrder.fulfillment && (
              <div className="mb-4 p-4 rounded-2xl bg-mist-white border border-slate-stone/10 text-sm">
                <p className="text-stone-gray text-xs uppercase tracking-widest font-bold mb-2">État actuel</p>
                {selectedOrder.fulfillment.type === 'pickup' ? (
                  <p>📍 Prête à retirer en boutique{selectedOrder.fulfillment.marked_ready_at ? ` — ${new Date(selectedOrder.fulfillment.marked_ready_at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>
                ) : (
                  <p>📦 Expédiée via <strong>{selectedOrder.fulfillment.carrier}</strong> — suivi : <span className="font-mono">{selectedOrder.fulfillment.tracking_number}</span></p>
                )}
              </div>
            )}

            {fulfillStatus.success && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm">{fulfillStatus.success}</div>
            )}
            {fulfillStatus.error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{fulfillStatus.error}</div>
            )}

            <form onSubmit={handleFulfillOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className={`cursor-pointer p-4 rounded-2xl border text-sm transition-all ${fulfillForm.type === 'pickup' ? 'bg-slate-stone text-white border-slate-stone' : 'bg-white border-slate-stone/15 text-slate-stone hover:border-slate-stone/40'}`}>
                  <input type="radio" name="fulfilltype" className="hidden" checked={fulfillForm.type === 'pickup'} onChange={() => setFulfillForm({ ...fulfillForm, type: 'pickup' })} />
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span className="font-medium">Retrait en boutique</span>
                  </div>
                </label>
                <label className={`cursor-pointer p-4 rounded-2xl border text-sm transition-all ${fulfillForm.type === 'shipped' ? 'bg-slate-stone text-white border-slate-stone' : 'bg-white border-slate-stone/15 text-slate-stone hover:border-slate-stone/40'}`}>
                  <input type="radio" name="fulfilltype" className="hidden" checked={fulfillForm.type === 'shipped'} onChange={() => setFulfillForm({ ...fulfillForm, type: 'shipped' })} />
                  <div className="flex items-center gap-2">
                    <span>📦</span>
                    <span className="font-medium">Envoi postal</span>
                  </div>
                </label>
              </div>

              {fulfillForm.type === 'shipped' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-slate-stone mb-2">Transporteur</label>
                    <select
                      value={fulfillForm.carrier}
                      onChange={(e) => setFulfillForm({ ...fulfillForm, carrier: e.target.value })}
                      className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-slate-stone/40"
                    >
                      <option>La Poste Suisse</option>
                      <option>DHL</option>
                      <option>DPD</option>
                      <option>UPS</option>
                      <option>FedEx</option>
                      <option>Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-slate-stone mb-2">Numéro de suivi</label>
                    <input
                      type="text"
                      required
                      value={fulfillForm.tracking_number}
                      onChange={(e) => setFulfillForm({ ...fulfillForm, tracking_number: e.target.value })}
                      placeholder="Ex : 99.00.123456.00000017"
                      className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-slate-stone/40"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={fulfillSaving}
                className="w-full py-3 bg-slate-stone text-white font-sans uppercase tracking-[0.25em] text-xs rounded-full hover:bg-slate-stone/90 transition-all shadow-md disabled:opacity-50"
              >
                {fulfillSaving ? 'Envoi…' : fulfillForm.type === 'pickup' ? 'Marquer prêt et avertir le client' : 'Marquer expédié et envoyer le suivi'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: Inbox message viewer */}
      {openMessage && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpenMessage(null)}></div>
          <div className="relative z-10 w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-stone/5 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-serif text-2xl text-slate-stone">{openMessage.subject || 'Message'}</h3>
              <button onClick={() => setOpenMessage(null)} className="w-10 h-10 rounded-full bg-mist-white flex items-center justify-center hover:bg-slate-stone hover:text-white transition-colors">✕</button>
            </div>
            {openMessageLoading ? (
              <p className="text-stone-gray text-sm">Chargement…</p>
            ) : openMessage.error ? (
              <p className="text-red-600 text-sm">{openMessage.error}</p>
            ) : (
              <>
                <div className="mb-6 text-sm text-stone-gray space-y-1">
                  <p><strong className="text-slate-stone">De :</strong> {(openMessage.from || []).map(a => a.name ? `${a.name} <${a.address}>` : a.address).join(', ')}</p>
                  <p><strong className="text-slate-stone">À :</strong> {(openMessage.to || []).map(a => a.address).join(', ')}</p>
                  {openMessage.date && <p><strong className="text-slate-stone">Date :</strong> {new Date(openMessage.date).toLocaleString('fr-CH', { dateStyle: 'long', timeStyle: 'short' })}</p>}
                </div>
                <div className="h-px bg-slate-stone/10 mb-6"></div>
                {openMessage.html ? (
                  <div className="text-sm text-slate-stone" dangerouslySetInnerHTML={{ __html: openMessage.html }} />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-stone">{openMessage.text || ''}</pre>
                )}
                <div className="mt-8 flex gap-3">
                  <button onClick={() => { const from = openMessage.from && openMessage.from[0]; if (from && from.address) { setEmailModal({ isOpen: true, to: from.address, subject: `Re: ${openMessage.subject || ''}`, message: '\n\n---\nMessage d\'origine :\n' + (openMessage.text || '').slice(0, 1000) }); setOpenMessage(null); } }} className="px-6 py-3 bg-slate-stone text-white font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-slate-stone/90 transition-all shadow-md">↩ Répondre</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Send Email Dashboard Component */}
      {emailModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEmailModal({ ...emailModal, isOpen: false })}></div>
          <form onSubmit={handleSendEmailSubmit} className="relative z-10 w-full max-w-lg bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-stone/5">
            
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-serif text-2xl text-slate-stone">Écrire un E-mail</h3>
              <button 
                type="button" 
                onClick={() => setEmailModal({ ...emailModal, isOpen: false })}
                className="w-10 h-10 rounded-full bg-mist-white flex items-center justify-center hover:bg-slate-stone hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {emailSuccess && (
              <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium">
                {emailSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Destinataire</label>
                <input 
                  type="email" 
                  disabled
                  value={emailModal.to}
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-mono text-xs text-stone-gray cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Sujet de l'e-mail</label>
                <input 
                  type="text" 
                  required
                  value={emailModal.subject}
                  onChange={(e) => setEmailModal({ ...emailModal, subject: e.target.value })}
                  placeholder="ex: Votre commande est en route !"
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40"
                />
              </div>

              <div>
                <label className="block font-sans text-xs tracking-widest uppercase font-bold text-slate-stone mb-2">Message (Contenu de l'e-mail)</label>
                <textarea 
                  required
                  rows={8}
                  value={emailModal.message}
                  onChange={(e) => setEmailModal({ ...emailModal, message: e.target.value })}
                  placeholder="Rédigez votre message ici..."
                  className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 resize-none"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                type="submit"
                disabled={emailSending}
                className="flex-grow py-4 bg-slate-stone text-white font-sans uppercase tracking-[0.3em] text-xs rounded-full hover:bg-slate-stone/90 transition-all shadow-lg disabled:opacity-50"
              >
                {emailSending ? 'Envoi en cours...' : 'Envoyer l\'e-mail'}
              </button>
              <button 
                type="button" 
                onClick={() => setEmailModal({ ...emailModal, isOpen: false })}
                className="px-6 py-4 bg-mist-white text-stone-gray font-sans uppercase tracking-[0.2em] text-xs rounded-full hover:bg-slate-stone/10 transition-all"
              >
                Annuler
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
