// Le fichier clients, en fiche par personne.
//
// L'offre marketing le décrit : « historique des commandes et des ateliers,
// notes internes et tags, recherche, filtres et export CSV ». Le fichier ne
// donnait qu'un nom, un nombre de commandes et un total — et ce total comptait
// aussi les paniers jamais payés et les commandes annulées.
//
// Une personne = une adresse e-mail, comme partout ailleurs dans la boutique.
// Les notes et les tags vivent à part (data/crm.json) : ils sont à elle, pas à
// la commande, et survivent à la suppression d'une commande d'essai.

const fs = require('node:fs');
const path = require('node:path');

const db = require('./db');
const comptes = require('./comptes');

const FICHIER = path.join(__dirname, 'data', 'crm.json');
const STATUTS_PAYES = ['paid', 'readyforpickup', 'pickedup', 'shipped'];

const cle = (email) => String(email || '').trim().toLowerCase();

function lireNotes() {
  try {
    const d = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    return d && typeof d.fiches === 'object' ? d : { fiches: {} };
  } catch (_) {
    return { fiches: {} };
  }
}

function ecrireNotes(d) {
  const tmp = FICHIER + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, FICHIER);
}

// Tags : courts, sans doublon, dans l'ordre où elle les a saisis.
function tagsPropres(tags) {
  const liste = Array.isArray(tags) ? tags : String(tags || '').split(',');
  const vus = new Set();
  const out = [];
  for (const t of liste) {
    const v = String(t || '').trim().slice(0, 30);
    if (v && !vus.has(v.toLowerCase())) { vus.add(v.toLowerCase()); out.push(v); }
  }
  return out.slice(0, 12);
}

function majFiche(email, { notes, tags }) {
  const k = cle(email);
  if (!k || !k.includes('@')) throw new Error('adresse invalide');
  const d = lireNotes();
  const avant = d.fiches[k] || {};
  const fiche = {
    notes: notes === undefined ? (avant.notes || '') : String(notes || '').slice(0, 4000),
    tags: tags === undefined ? (avant.tags || []) : tagsPropres(tags),
    maj: new Date().toISOString(),
  };
  if (!fiche.notes && !fiche.tags.length) delete d.fiches[k];
  else d.fiches[k] = fiche;
  ecrireNotes(d);
  return fiche;
}

// Toutes les personnes connues de la boutique : commandes, ateliers, et celles
// qu'elle a annotées à la main (une cliente de la boutique, par exemple).
async function fichier() {
  const [commandes, reservations, ateliers, inscrites] = await Promise.all([
    db.getOrders(), db.getBookings(), db.getWorkshops(), db.getNewsletterSubscribers(),
  ]);
  const titres = new Map((ateliers || []).map((w) => [String(w.id), w.title || '']));
  // Abonnée = inscription CONFIRMÉE. Une inscription jamais confirmée ne
  // reçoit rien, et vient le plus souvent d'un robot.
  const abonnees = new Set((inscrites || []).filter((n) => n && n.confirme_le).map((n) => cle(n.email)));
  const notes = lireNotes().fiches;
  const parEmail = new Map();

  const fiche = (email, nom) => {
    const k = cle(email);
    if (!k) return null;
    if (!parEmail.has(k)) {
      parEmail.set(k, {
        email: k, nom: '', telephone: '',
        commandes: [], ateliers: [],
        totalPaye: 0, nbPayees: 0, nbNonPayees: 0,
        premiere: '', derniere: '', provenance: '',
      });
    }
    const f = parEmail.get(k);
    if (nom && String(nom).length > f.nom.length) f.nom = String(nom);
    return f;
  };
  const dater = (f, iso) => {
    if (!iso) return;
    if (!f.premiere || iso < f.premiere) f.premiere = iso;
    if (!f.derniere || iso > f.derniere) f.derniere = iso;
  };

  for (const o of commandes || []) {
    const f = fiche(o.customer_email, o.customer_name);
    if (!f) continue;
    const payee = STATUTS_PAYES.includes(String(o.status || '').toLowerCase());
    f.commandes.push({
      id: o.id, date: o.created_at, total: Number(o.total) || 0, statut: o.status,
      payee, articles: (o.items || []).map((a) => ({ nom: a.name, qte: a.qty })),
    });
    if (payee) { f.nbPayees += 1; f.totalPaye += Number(o.total) || 0; }
    else if (!['cancelled', 'refunded'].includes(String(o.status || '').toLowerCase())) f.nbNonPayees += 1;
    if (o.customer_phone && !f.telephone) f.telephone = o.customer_phone;
    // La provenance de sa PREMIÈRE commande suivie : c'est elle qui dit par
    // où cette cliente est arrivée.
    if (o.source && o.source.canal && (!f._provDate || o.created_at < f._provDate)) {
      f.provenance = o.source.canal;
      f._provDate = o.created_at;
    }
    dater(f, o.created_at);
  }
  for (const b of reservations || []) {
    const f = fiche(b.customer_email, b.customer_name);
    if (!f) continue;
    f.ateliers.push({ id: b.id, atelier: titres.get(String(b.workshop_id)) || 'Atelier', date: b.slot_date || '', places: Number(b.seats) || 1, reserve: b.created_at });
    dater(f, b.created_at);
  }
  for (const k of Object.keys(notes)) fiche(k);

  return [...parEmail.values()].map((f) => {
    delete f._provDate;
    f.commandes.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const n = notes[f.email] || {};
    return {
      ...f,
      totalPaye: Math.round(f.totalPaye * 100) / 100,
      abonnee: abonnees.has(f.email),
      compte: Boolean(comptes.compteParEmail(f.email)),
      notes: n.notes || '',
      tags: n.tags || [],
    };
  });
}

function champCsv(v) {
  const s = String(v == null ? '' : v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Point-virgule et BOM : ce qu'Excel en français ouvre sans assistant.
function csv(liste) {
  const entetes = ['Nom', 'E-mail', 'Téléphone', 'Commandes payées', 'Total payé (CHF)', 'Ateliers', 'Première visite', 'Dernière visite', 'Provenance', 'Infolettre', 'Compte', 'Tags', 'Notes'];
  const lignes = liste.map((f) => [
    f.nom, f.email, f.telephone, f.nbPayees, f.totalPaye.toFixed(2), f.ateliers.length,
    String(f.premiere || '').slice(0, 10), String(f.derniere || '').slice(0, 10), f.provenance,
    f.abonnee ? 'oui' : 'non', f.compte ? 'oui' : 'non', f.tags.join(', '), f.notes.replace(/\s+/g, ' '),
  ].map(champCsv).join(';'));
  return '﻿' + [entetes.join(';'), ...lignes].join('\r\n');
}

module.exports = { fichier, majFiche, csv, tagsPropres };
