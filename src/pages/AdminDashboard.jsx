import React, { useState, useEffect } from 'react';
import ContentEditor from './admin/ContentEditor';
import ShopSettings from './admin/ShopSettings';
import RichTextEditor from './admin/RichTextEditor';
import JournalEditor from './admin/JournalEditor';

// Order status has been written in mixed case over the life of the shop
// ('paid' from the payment paths, 'Paid' from the admin dropdown). Compare on
// a folded key so a paid order is never displayed as "En attente".
const statusKey = (s) => String(s || '').toLowerCase();

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [workshopForm, setWorkshopForm] = useState({ id: null, title: '', description: '', price: '', duration: '', image_url: '' });
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ id: null, name: '', price: '', ribbon: '', collectionsText: '', images: [], description: '', stock: '', inStock: true, related: [] });
  const [productSearch, setProductSearch] = useState('');
  const [productsPage, setProductsPage] = useState(1);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  // true when the badge is free text rather than one of the two presets
  const [customBadge, setCustomBadge] = useState(false);
  const [workshopImageUploading, setWorkshopImageUploading] = useState(false);
  const PRODUCTS_PER_PAGE = 25;
  const emptyProductForm = { id: null, name: '', price: '', ribbon: '', collectionsText: '', images: [], description: '', stock: '', inStock: true, related: [], contenance: '', ingredients: '', inci: '', typePeauText: '', besoinsText: '', etiquettesText: '', bonCadeau: false, rituelId: '', rituelEtape: '', rituelGeste: '', rechargePrix: '' };
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
    name: copie ? `${p.name} (copie)` : (p.name || ''),
    price: p.price ?? '',
    ribbon: p.ribbon || '',
    collectionsText: (p.collections || []).join(', '),
    images: Array.isArray(p.images) ? [...p.images] : [],
    description: p.description || '',
    stock: p.stock == null ? '' : String(p.stock),
    inStock: p.inStock !== false,
    related: Array.isArray(p.related) ? [...p.related] : [],
    contenance: p.contenance || '',
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
  });

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

  // Upload one or more image files from the admin's computer; append the
  // resulting public URLs to the product form's image list.
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImageUploading(true);
    try {
      const urls = [];
      for (const file of files) {
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
              { id: 'products', label: 'Gestion Produits', icon: '🧴' },
              { id: 'workshops', label: 'Gestion Ateliers', icon: '🎨' },
              { id: 'clients', label: 'Fichier Clients', icon: '👤' },
              { id: 'inbox', label: 'Boîte de réception', icon: '📥' },
              { id: 'sumup', label: 'API SumUp', icon: '💳' },
              { id: 'content', label: 'Textes du site', icon: '✏️' },
              { id: 'journal', label: 'Journal', icon: '📝' },
              { id: 'shop', label: 'Horaires & absences', icon: '🕓' },
              { id: 'settings', label: 'Configuration / Password', icon: '⚙️' }
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
                      <th className="p-6">ID Réservation</th>
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
                          <p className="font-medium text-xs text-slate-stone">{booking.workshop_id || 'Atelier Cosmétique Naturelle'}</p>
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
                <h1 className="font-serif text-3xl md:text-4xl text-slate-stone">Fichier Clients</h1>
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
                      <th className="p-6 text-right">Total Dépensé</th>
                      <th className="p-6 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client, idx) => (
                      <tr key={idx} className="border-b border-slate-stone/5 hover:bg-mist-white/20 transition-colors text-sm text-slate-stone font-light">
                        <td className="p-6 font-medium">{client.name || 'Client Anonyme'}</td>
                        <td className="p-6 font-mono text-xs text-stone-gray">{client.email}</td>
                        <td className="p-6 text-center font-bold text-slate-stone/60">{client.order_count}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3.5: Workshops */}
        {activeTab === 'products' && (
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-8">Gestion des Produits</h1>

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
                  // Le quatrième endroit. La liste blanche du serveur est
                  // stricte : un champ absent d'ici est saisi, paraît accepté,
                  // et s'évapore au rechargement sans qu'aucune erreur ne le
                  // dise.
                  contenance: productForm.contenance || '',
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
                  rechargePrix: productForm.rechargePrix === '' ? null : productForm.rechargePrix
                };
                fetch(url, { method, headers: fetchHeaders, body: JSON.stringify(payload) })
                  .then(res => {
                    if (res.status === 401) { onLogout(); throw new Error('Session expirée'); }
                    if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
                    return res.json();
                  })
                  .then(() => {
                    setProductForm(emptyProductForm);
                    setCustomBadge(false);
                    loadData();
                  })
                  .catch(err => alert(err.message));
              }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" required placeholder="Nom du produit" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="px-4 py-2 border rounded" />
                <input type="number" step="0.01" min="0" required placeholder="Prix (CHF)" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="px-4 py-2 border rounded" />
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
                  <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Catégories</label>
                  <input type="text" placeholder="Séparées par des virgules" value={productForm.collectionsText} onChange={e => setProductForm({...productForm, collectionsText: e.target.value})} className="px-4 py-2 border rounded w-full" />
                  <p className="text-xs text-stone-gray mt-1">Ajoutez <strong>Coup de cœur</strong> pour afficher le produit dans la section « Nos coups de cœur » de la page d'accueil.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Images</label>
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
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 bg-slate-stone/90 text-white text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded">Principale</span>
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
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Description (HTML accepté)</label>
                  <RichTextEditor
                    value={productForm.description}
                    onChange={(html) => setProductForm({ ...productForm, description: html })}
                    placeholder="Description du produit — utilisez les boutons ci-dessus pour les sous-titres et le gras"
                  />
                </div>
                <div>
                  <div className="md:col-span-2 mb-4">
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
                    <select
                      value=""
                      disabled={(productForm.related || []).length >= 4}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v || (productForm.related || []).includes(v)) return;
                        setProductForm({ ...productForm, related: [...(productForm.related || []), v] });
                      }}
                      className="px-4 py-2 border rounded w-full text-sm disabled:opacity-40"
                    >
                      <option value="">{(productForm.related || []).length >= 4 ? 'Maximum atteint (4)' : 'Ajouter un produit…'}</option>
                      {products.filter((p) => p.id !== productForm.id).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Stock (interne, non affiché)</label>
                  <input type="number" min="0" step="1" placeholder="ex: 12" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})} className="px-4 py-2 border rounded w-full" />
                </div>

                {/* Ce qu'il y a dans le flacon.
                    Ces renseignements existent déjà pour une bonne part dans
                    l'export Wix — 104 contenances et 101 listes d'ingrédients —
                    et se relisent plutôt qu'ils ne se ressaisissent. Rien n'est
                    obligatoire : un champ vide ne s'affiche simplement pas sur
                    la fiche. */}
                <div className="md:col-span-2 border-t pt-5 mt-2">
                  <h4 className="text-xs uppercase tracking-widest text-stone-gray mb-4">Ce qu'il y a dans le flacon</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2 text-sm text-slate-stone">
                        <input type="checkbox" checked={!!productForm.bonCadeau}
                          onChange={e => setProductForm({...productForm, bonCadeau: e.target.checked})} />
                        Ce produit est un bon cadeau
                      </label>
                      <p className="text-[11px] text-stone-gray mt-1">
                        La caisse demandera alors le destinataire, un message et une date. Créez un produit par
                        montant (25, 50, 100, 150, 295) : le serveur facture toujours le prix de la fiche, jamais
                        celui que le navigateur envoie.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Contenance</label>
                      <input type="text" placeholder="ex : 100 ml, ou 50 g" value={productForm.contenance}
                        onChange={e => setProductForm({...productForm, contenance: e.target.value})}
                        className="px-4 py-2 border rounded w-full" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Étiquettes libres</label>
                      <input type="text" placeholder="une par ligne, ou séparées par des virgules" value={productForm.etiquettesText}
                        onChange={e => setProductForm({...productForm, etiquettesText: e.target.value})}
                        className="px-4 py-2 border rounded w-full" />
                    </div>
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
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Ingrédients (en français)</label>
                      <textarea rows={3} placeholder="Tels que vous les diriez à une cliente." value={productForm.ingredients}
                        onChange={e => setProductForm({...productForm, ingredients: e.target.value})}
                        className="px-4 py-2 border rounded w-full" />
                    </div>
                    <div className="md:col-span-2 border-t pt-4 mt-2">
                      <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Prix en recharge (CHF)</label>
                      <p className="text-[11px] text-stone-gray mb-2">
                        Si la cliente rapporte son flacon. Laissé vide, aucune recharge n'est proposée.
                        Une recharge se retire <strong>à la boutique</strong> — le serveur refuse de
                        l'expédier, et facture bien ce prix-là, pas le prix plein.
                      </p>
                      <input type="number" step="0.05" min="0" placeholder="ex : 15.00"
                        value={productForm.rechargePrix}
                        onChange={e => setProductForm({...productForm, rechargePrix: e.target.value})}
                        className="px-4 py-2 border rounded w-full max-w-[200px]" />
                    </div>

                    <div className="md:col-span-2 border-t pt-4 mt-2">
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

                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-widest text-stone-gray mb-1">Liste INCI</label>
                      <textarea rows={3} placeholder="La nomenclature réglementaire, telle qu'elle figure sur l'étiquette." value={productForm.inci}
                        onChange={e => setProductForm({...productForm, inci: e.target.value})}
                        className="px-4 py-2 border rounded w-full" />
                      <p className="text-[11px] text-stone-gray mt-1">
                        Aucune mise en évidence des allergènes n'est faite : elle demanderait de les saisir un à un, produit par produit.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-red-50 border border-red-200 rounded w-full">
                    <input type="checkbox" checked={!productForm.inStock} onChange={e => setProductForm({...productForm, inStock: !e.target.checked})} className="w-4 h-4 accent-red-600" />
                    <span className="text-sm text-red-700 font-medium">Marquer le produit comme épuisé</span>
                  </label>
                </div>
                <div className="md:col-span-2 flex gap-4">
                  <button type="submit" className="px-6 py-2 bg-slate-stone text-white rounded">{productForm.id ? 'Enregistrer les modifications' : 'Ajouter le produit'}</button>
                  {productForm.id && <button type="button" onClick={() => { setProductForm(emptyProductForm); setCustomBadge(false); }} className="px-6 py-2 bg-gray-200 rounded">Annuler</button>}
                </div>
              </form>
            </div>

            <div className="mb-4 flex items-center justify-between gap-4">
              <input type="text" placeholder="Rechercher un produit..." value={productSearch} onChange={e => { setProductSearch(e.target.value); setProductsPage(1); }} className="px-4 py-2 border rounded w-full max-w-sm" />
              <span className="text-sm text-stone-gray whitespace-nowrap">{products.filter(p => !productSearch || (p.name || '').toLowerCase().includes(productSearch.toLowerCase())).length} produit(s)</span>
            </div>

            <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-stone text-white font-sans text-xs tracking-widest uppercase">
                  <tr>
                    <th className="p-4">Produit</th>
                    <th className="p-4">Catégories</th>
                    <th className="p-4">Prix</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = products.filter(p => !productSearch || (p.name || '').toLowerCase().includes(productSearch.toLowerCase()));
                    const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
                    const page = Math.min(productsPage, totalPages);
                    return filtered.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE).map((p) => (
                    <tr key={p.id} className="border-b align-top">
                      <td className="p-4 flex items-center gap-3">
                        {p.images && p.images[0] && <img src={p.images[0]} alt="" className="w-10 h-10 object-cover rounded" />}
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{p.name}</span>
                          {p.inStock === false && (
                            <span className="inline-block self-start bg-red-100 text-red-700 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-medium">Épuisé</span>
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
                        <div className="flex gap-3">
                          <button onClick={() => {
                            // Duplicate: same content, no id -> the form saves it
                            // as a new product. Name is suffixed so the two are
                            // distinguishable in the list.
                            setCustomBadge(!!p.ribbon && !['coming-soon', 'best-seller'].includes(p.ribbon));
                            setProductForm(chargerProduitDansFormulaire(p, { copie: true }));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} className="text-slate-stone underline">Dupliquer</button>
                          <button onClick={() => {
                            setCustomBadge(!!p.ribbon && !['coming-soon', 'best-seller'].includes(p.ribbon));
                            setProductForm(chargerProduitDansFormulaire(p));
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
                  ));
                  })()}
                </tbody>
              </table>
            </div>

            {(() => {
              const filteredCount = products.filter(p => !productSearch || (p.name || '').toLowerCase().includes(productSearch.toLowerCase())).length;
              const totalPages = Math.max(1, Math.ceil(filteredCount / PRODUCTS_PER_PAGE));
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
            <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-8">Sécurité & Paramètres</h1>
            
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
                <h3 className="font-serif text-2xl text-slate-stone">Détails Commande</h3>
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
                <p className="font-mono text-xs mt-0.5">{selectedOrder.customer_email}</p>
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
                </select>
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

            <h4 className="font-sans text-xs tracking-widest uppercase font-bold text-stone-gray/60 mb-4">Articles Achetés</h4>
            <div className="space-y-4 mb-6 max-h-56 overflow-y-auto">
              {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm font-light">
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono text-stone-gray">CHF {parseFloat(item.price).toFixed(2)}</span>
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
                {fulfillSaving ? 'Envoi…' : fulfillForm.type === 'pickup' ? 'Marquer prêt + Avertir le client' : 'Marquer expédié + Envoyer le suivi'}
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
