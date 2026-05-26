import React, { useState, useEffect } from 'react';

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [workshopForm, setWorkshopForm] = useState({ id: null, title: '', description: '', price: '', duration: '', image_url: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState({ success: '', error: '' });
  
  // Email modal state
  const [emailModal, setEmailModal] = useState({ isOpen: false, to: '', subject: '', message: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');

  // Selected order details modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  const token = localStorage.getItem('adminToken');
  const username = localStorage.getItem('adminUser') || 'admin';

  const fetchHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const loadData = () => {
    setLoading(true);
    setError('');
    
    const endpoints = {
      orders: '/api/admin/orders',
      bookings: '/api/admin/bookings',
      clients: '/api/admin/clients',
      workshops: '/api/admin/workshops'
    };

    fetch(endpoints[activeTab], { headers: fetchHeaders })
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
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab !== 'settings') {
      loadData();
    }
  }, [activeTab]);

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
              { id: 'bookings', label: 'Réservations Ateliers', icon: '📅' },
              { id: 'workshops', label: 'Gestion Ateliers', icon: '🎨' },
              { id: 'clients', label: 'Fichier Clients', icon: '👤' },
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
          onClick={onLogout}
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
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'Paid' ? 'bg-green-100 text-green-700' : order.status === 'Shipped' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {order.status === 'Paid' ? 'Payé' : order.status === 'Shipped' ? 'Envoyé' : 'En attente'}
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
                            onClick={() => setEmailModal({ isOpen: true, to: booking.customer_email, subject: `Votre réservation d'atelier - SoYou Cosmetics`, message: `Bonjour ${booking.customer_name},\n\nConcerne votre réservation d'atelier : ${booking.slot_date}.\n\n` })}
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
                            onClick={() => setEmailModal({ isOpen: true, to: client.email, subject: 'SoYou Cosmetics - Message client', message: `Bonjour ${client.name || ''},\n\n` })}
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
                <input type="text" placeholder="URL Image (ex: /workshop.png)" value={workshopForm.image_url} onChange={e => setWorkshopForm({...workshopForm, image_url: e.target.value})} className="px-4 py-2 border rounded" />
                <textarea required placeholder="Description" value={workshopForm.description} onChange={e => setWorkshopForm({...workshopForm, description: e.target.value})} className="px-4 py-2 border rounded md:col-span-2"></textarea>
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
                  <option value="Shipped">Envoyé (Shipped)</option>
                </select>
                <button 
                  onClick={() => {
                    setEmailModal({ 
                      isOpen: true, 
                      to: selectedOrder.customer_email, 
                      subject: `Votre commande ${selectedOrder.id} - SoYou Cosmetics`, 
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
