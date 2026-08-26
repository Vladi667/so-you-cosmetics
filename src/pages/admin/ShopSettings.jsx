import React, { useState, useEffect } from 'react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const LANGUES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

// Opening hours, the away notice, and maintenance mode — the three things she
// asked to be able to change herself around her holidays. Hard-coded hours meant
// a deployment every time her schedule moved.
const ShopSettings = ({ fetchHeaders }) => {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ success: '', error: '' });

  useEffect(() => {
    let active = true;
    fetch('/api/admin/settings/shop', { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (active) setSettings(d); })
      .catch(() => { if (active) setStatus({ success: '', error: 'Chargement impossible.' }); });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = (patch) => {
    setStatus({ success: '', error: '' });
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const majJour = (i, patch) => {
    const hours = settings.hours.map((h, k) => (k === i ? { ...h, ...patch } : h));
    maj({ hours });
  };

  const enregistrer = () => {
    setSaving(true);
    setStatus({ success: '', error: '' });
    fetch('/api/admin/settings/shop', {
      method: 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify(settings),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        setSettings(d);
        setStatus({ success: 'Enregistré. Rechargez le site pour voir le résultat.', error: '' });
      })
      .catch(() => setStatus({ success: '', error: "L'enregistrement a échoué." }))
      .finally(() => setSaving(false));
  };

  if (!settings) {
    return <p className="text-sm text-stone-gray">{status.error || 'Chargement…'}</p>;
  }

  const champ = "w-full px-4 py-2.5 bg-mist-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40";

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">Horaires & absences</h1>
      <p className="text-sm text-stone-gray mb-8">
        Vos horaires d'ouverture, le message affiché pendant vos absences, et la mise en
        maintenance du site.
      </p>

      {status.success && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium">{status.success}</div>
      )}
      {status.error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{status.error}</div>
      )}

      {/* Horaires */}
      <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-6">
        <h2 className="font-serif text-xl text-slate-stone mb-1">Horaires d'ouverture</h2>
        <p className="text-xs text-stone-gray mb-5">Affichés sur la page Contact.</p>
        <div className="space-y-3">
          {settings.hours.map((h, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-slate-stone">{JOURS[i] || h.day}</span>
              <label className="flex items-center gap-2 text-xs text-stone-gray shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(h.closed)}
                  onChange={(e) => majJour(i, { closed: e.target.checked })}
                />
                Fermé
              </label>
              <input
                type="text"
                value={h.hours || ''}
                disabled={Boolean(h.closed)}
                placeholder="11:00–13:00 / 14:00–18:30"
                onChange={(e) => majJour(i, { hours: e.target.value })}
                className={champ + ' disabled:opacity-40'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Absence */}
      <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h2 className="font-serif text-xl text-slate-stone">Message d'absence</h2>
          <label className="flex items-center gap-2 text-sm text-slate-stone">
            <input
              type="checkbox"
              checked={Boolean(settings.absence.active)}
              onChange={(e) => maj({ absence: { ...settings.absence, active: e.target.checked } })}
            />
            Afficher
          </label>
        </div>
        <p className="text-xs text-stone-gray mb-5">
          S'affiche en haut de <strong>toutes</strong> les pages, y compris le panier — c'est là que
          la question du délai d'expédition se pose. Laissé vide, rien ne s'affiche.
        </p>
        <div className="space-y-3">
          {LANGUES.map((l) => (
            <div key={l.code}>
              <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">{l.label}</label>
              <textarea
                rows={2}
                value={settings.absence[l.code] || ''}
                placeholder={l.code === 'fr' ? "En vacances jusqu'au 15 août : les commandes seront expédiées à mon retour." : ''}
                onChange={(e) => maj({ absence: { ...settings.absence, [l.code]: e.target.value } })}
                className={champ}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Frais de port */}
      <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-6">
        <h2 className="font-serif text-xl text-slate-stone mb-1">Frais de port</h2>
        <p className="text-xs text-stone-gray mb-5">
          Vos tarifs, tels qu'ils s'affichent à la caisse. Ils étaient écrits dans le code : une
          hausse de La Poste demandait une intervention. <strong className="text-slate-stone">
          Les intitulés se modifient, pas les identifiants</strong> — trois règles s'y appuient,
          dont l'adresse exigée hors retrait et la limite des deux kilos.
        </p>

        <div className="mb-5">
          <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">
            Livraison offerte dès (CHF)
          </label>
          <input
            type="number" min="0" step="1"
            value={settings.shipping?.freeFrom ?? ''}
            onChange={(e) => maj({ shipping: { ...settings.shipping, freeFrom: e.target.value === '' ? null : Number(e.target.value) } })}
            className={champ + ' max-w-[12rem]'}
          />
          <p className="text-[11px] text-stone-gray mt-1">
            Ne s'applique qu'au mode coché « offert au-delà du seuil » ci-dessous.
          </p>
        </div>

        <div className="space-y-2">
          {(settings.shipping?.options || []).map((o, i) => (
            <div key={o.id} className="grid grid-cols-12 items-center gap-2">
              <input
                type="text"
                value={o.label || ''}
                onChange={(e) => {
                  const options = settings.shipping.options.map((x, k) => (k === i ? { ...x, label: e.target.value } : x));
                  maj({ shipping: { ...settings.shipping, options } });
                }}
                className={champ + ' col-span-12 sm:col-span-6'}
              />
              <input
                type="number" min="0" step="0.05"
                value={o.price ?? ''}
                onChange={(e) => {
                  const options = settings.shipping.options.map((x, k) => (k === i ? { ...x, price: Number(e.target.value) } : x));
                  maj({ shipping: { ...settings.shipping, options } });
                }}
                className={champ + ' col-span-5 sm:col-span-2'}
              />
              <input
                type="text"
                placeholder="note"
                value={o.note || ''}
                onChange={(e) => {
                  const options = settings.shipping.options.map((x, k) => (k === i ? { ...x, note: e.target.value } : x));
                  maj({ shipping: { ...settings.shipping, options } });
                }}
                className={champ + ' col-span-7 sm:col-span-3'}
              />
              <label className="col-span-12 sm:col-span-1 flex items-center gap-2 text-[11px] text-stone-gray" title="Offert au-delà du seuil">
                <input
                  type="checkbox"
                  checked={Boolean(o.economy)}
                  onChange={(e) => {
                    // Un seul mode peut porter la franchise : l'offrir sur
                    // plusieurs reviendrait à l'offrir sur le plus cher.
                    const options = settings.shipping.options.map((x, k) => ({ ...x, economy: k === i ? e.target.checked : false }));
                    maj({ shipping: { ...settings.shipping, options } });
                  }}
                />
                <span className="sm:hidden">Offert au-delà du seuil</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Alertes */}
      <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-6">
        <h2 className="font-serif text-xl text-slate-stone mb-1">Vos alertes</h2>
        <p className="text-xs text-stone-gray mb-5">
          Le stock est retiré automatiquement à chaque paiement confirmé, et un produit épuisé est
          retiré de la vente. Indiquez ci-dessous où vous prévenir — commandes payées, ruptures de
          stock, et messages reçus par le formulaire de contact. <strong className="text-slate-stone">
          Laissé vide, tout part sur contact@soyoucosmetics.com.</strong>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Votre adresse e-mail</label>
            <input type="email" placeholder="contact@soyoucosmetics.com" value={settings.alerts?.email || ''}
              onChange={(e) => maj({ alerts: { ...settings.alerts, email: e.target.value } })} className={champ} />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Seuil de stock bas</label>
            <input type="number" min="0" step="1" value={settings.alerts?.lowStockThreshold ?? 3}
              onChange={(e) => maj({ alerts: { ...settings.alerts, lowStockThreshold: Number(e.target.value) } })} className={champ} />
          </div>
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-stone">
            <input type="checkbox" checked={Boolean(settings.alerts?.onNewOrder)}
              onChange={(e) => maj({ alerts: { ...settings.alerts, onNewOrder: e.target.checked } })} />
            M'avertir à chaque commande payée
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-stone">
            <input type="checkbox" checked={Boolean(settings.alerts?.onLowStock)}
              onChange={(e) => maj({ alerts: { ...settings.alerts, onLowStock: e.target.checked } })} />
            M'avertir en cas de rupture ou de stock bas
          </label>
        </div>
      </div>

      {/* Emballage cadeau */}
      <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h2 className="font-serif text-xl text-slate-stone">Emballage cadeau</h2>
          <label className="flex items-center gap-2 text-sm text-slate-stone">
            <input
              type="checkbox"
              checked={Boolean(settings.giftWrap?.enabled)}
              onChange={(e) => maj({ giftWrap: { ...settings.giftWrap, enabled: e.target.checked } })}
            />
            Proposer
          </label>
        </div>
        <p className="text-xs text-stone-gray mb-5">
          Une case à cocher apparaît à la caisse, et le supplément est <strong className="text-slate-stone">
          facturé par le serveur</strong> — jamais seulement affiché dans le panier. Désactivé, rien
          n'est proposé et rien n'est débité.
        </p>
        <div className="max-w-[200px]">
          <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Supplément (CHF)</label>
          <input
            type="number"
            step="0.05"
            min="0"
            value={settings.giftWrap?.price ?? 5}
            onChange={(e) => maj({ giftWrap: { ...settings.giftWrap, price: Number(e.target.value) } })}
            className={champ}
          />
        </div>
      </div>

      {/* Facturation */}
      <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h2 className="font-serif text-xl text-slate-stone">Facturation</h2>
          <label className="flex items-center gap-2 text-sm text-slate-stone">
            <input
              type="checkbox"
              checked={Boolean(settings.invoice?.enabled)}
              onChange={(e) => maj({ invoice: { ...settings.invoice, enabled: e.target.checked } })}
            />
            Envoyer une facture
          </label>
        </div>
        <p className="text-xs text-stone-gray mb-5">
          Une facture numérotée est envoyée au client dès le paiement confirmé. Laissez le numéro
          de TVA vide si vous n'êtes pas assujettie : la facture indiquera « TVA non applicable ».
          <strong className="text-slate-stone"> Afficher une TVA à 0 % en étant assujettie serait faux.</strong>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Numéro de TVA</label>
            <input type="text" placeholder="CHE-123.456.789 TVA" value={settings.invoice?.vatNumber || ''}
              onChange={(e) => maj({ invoice: { ...settings.invoice, vatNumber: e.target.value } })} className={champ} />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Taux (%)</label>
            <input type="number" step="0.1" min="0" value={settings.invoice?.vatRate ?? 0}
              onChange={(e) => maj({ invoice: { ...settings.invoice, vatRate: Number(e.target.value) } })} className={champ} />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Prochain numéro</label>
            <input type="number" min="1" value={settings.invoice?.nextNumber ?? 1}
              onChange={(e) => maj({ invoice: { ...settings.invoice, nextNumber: Number(e.target.value) } })} className={champ} />
          </div>
        </div>
      </div>

      {/* Maintenance */}
      <div className="bg-white rounded-3xl border border-amber-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h2 className="font-serif text-xl text-slate-stone">Mode maintenance</h2>
          <label className="flex items-center gap-2 text-sm text-slate-stone">
            <input
              type="checkbox"
              checked={Boolean(settings.maintenance.active)}
              onChange={(e) => maj({ maintenance: { ...settings.maintenance, active: e.target.checked } })}
            />
            Activer
          </label>
        </div>
        <p className="text-xs text-amber-800 mb-5">
          Rend le site inaccessible au public et affiche le message ci-dessous à la place. Votre
          administration reste accessible — vous pourrez toujours le désactiver d'ici.
        </p>
        <textarea
          rows={2}
          value={settings.maintenance.fr || ''}
          placeholder="Le site est momentanément en maintenance. Merci de votre patience."
          onChange={(e) => maj({ maintenance: { ...settings.maintenance, fr: e.target.value } })}
          className={champ}
        />
      </div>

      <button
        type="button"
        onClick={enregistrer}
        disabled={saving}
        className="mt-6 px-8 py-3 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest font-medium disabled:opacity-40 hover:bg-slate-stone/90 transition-colors"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
};

export default ShopSettings;
