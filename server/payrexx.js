// TWINT, par Payrexx — à côté de SumUp, pas à sa place.
//
// Sa demande : un seul passage en caisse, les cartes, PayPal, Apple Pay et
// Google Pay toujours par SumUp, et TWINT par Payrexx. « Je ne souhaite pas
// remplacer SumUp. » Ce module ne parle donc qu'à Payrexx ; la commande, la
// facture, l'avis et le stock restent ceux de routes.js, partagés.
//
// Le principe est celui déjà retenu pour SumUp : le navigateur et le webhook
// ne font que DÉSIGNER une commande. Si elle est payée, c'est Payrexx qui le
// dit, interrogé par le serveur avec sa clé. Leur documentation le demande en
// toutes lettres — ne jamais conclure d'une redirection ni d'un webhook seul.
//
// API : https://api.payrexx.com/v1.0/<Objet>/<id>?instance=<instance>,
// authentifiée par l'en-tête X-API-KEY (le secret d'API de l'instance).

const axios = require('axios');
const db = require('./db');

const BASE = (process.env.PAYREXX_API_BASE || 'https://api.payrexx.com/v1.0').replace(/\/+$/, '');

function actif() {
  const { instance, apiKey } = db.getPayrexxConfig();
  return !!(instance && apiKey);
}

function client() {
  const { instance, apiKey } = db.getPayrexxConfig();
  if (!instance || !apiKey) throw new Error('Payrexx non configuré (instance + clé API)');
  return { instance, headers: { 'X-API-KEY': apiKey } };
}

// Une passerelle de paiement restreinte à TWINT, pour une commande.
//
// Le montant part en centimes, comme Payrexx l'attend. referenceId porte
// l'identifiant de la commande : c'est lui que le webhook renverra.
async function creerPasserelleTwint(order, { retour, langue = 'fr' } = {}) {
  const { instance, headers } = client();
  const corps = new URLSearchParams();
  corps.append('amount', String(Math.round(Number(order.total) * 100)));
  corps.append('currency', 'CHF');
  corps.append('pm[0]', 'twint');
  corps.append('referenceId', order.id);
  corps.append('purpose', `Commande ${order.id} - So You Cosmetics`);
  corps.append('language', langue);
  // Le retour sert à refermer proprement la fenêtre, jamais à conclure : la
  // décision vient de lirePasserelle().
  if (retour) {
    corps.append('successRedirectUrl', `${retour}?twint=succes`);
    corps.append('failedRedirectUrl', `${retour}?twint=echec`);
    corps.append('cancelRedirectUrl', `${retour}?twint=annule`);
  }
  if (order.customer_email) corps.append('fields[email][value]', order.customer_email);

  const { data } = await axios.post(`${BASE}/Gateway/`, corps.toString(), {
    params: { instance },
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  const passerelle = data && Array.isArray(data.data) ? data.data[0] : null;
  if (!passerelle || !passerelle.id || !passerelle.link) {
    throw new Error(`réponse Payrexx inattendue : ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { id: passerelle.id, lien: passerelle.link };
}

// Ce que Payrexx dit de cette passerelle : payée ou non, et combien.
// null si Payrexx ne répond pas — l'appelant laisse alors la commande en
// attente plutôt que de la supposer payée.
async function lirePasserelle(id) {
  try {
    const { instance, headers } = client();
    const { data } = await axios.get(`${BASE}/Gateway/${encodeURIComponent(id)}/`, {
      params: { instance }, headers, timeout: 15000,
    });
    const g = data && Array.isArray(data.data) ? data.data[0] : null;
    if (!g) return null;
    return {
      // « confirmed » est le seul état d'un paiement abouti. « authorized » et
      // « reserved » ne concernent que les préautorisations, qu'on n'utilise pas.
      paid: g.status === 'confirmed',
      amount: Number(g.amount) / 100,
      currency: g.currency,
      referenceId: g.referenceId,
    };
  } catch (err) {
    console.error('Payrexx gateway lookup failed:', err.response ? err.response.data : err.message);
    return null;
  }
}

module.exports = { actif, creerPasserelleTwint, lirePasserelle };
