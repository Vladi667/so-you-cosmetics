const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const EMAILS_FILE = path.join(__dirname, 'data', 'sent_emails.json');

// Ensure local sent emails file exists if we run in mock mode
if (!fs.existsSync(path.dirname(EMAILS_FILE))) {
  fs.mkdirSync(path.dirname(EMAILS_FILE), { recursive: true });
}
if (!fs.existsSync(EMAILS_FILE)) {
  fs.writeFileSync(EMAILS_FILE, JSON.stringify([], null, 2), 'utf8');
}

const isProductionEmail = process.env.SMTP_HOST && process.env.SMTP_USER;
let transporter = null;

if (isProductionEmail) {
  console.log('Email Service: Configuring SMTP connection...');
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  console.log('Email Service: Running in local MOCK mode. Emails will be logged to server/data/sent_emails.json.');
}

async function sendMail({ to, subject, html, text, replyTo }) {
  // Le nom qui s'affiche dans la boite de reception de chaque cliente. Il
  // etait faux deux fois : « SoYou » colle, alors que la marque s'ecrit en
  // deux mots, et « Geneva », l'orthographe anglaise d'une ville francaise,
  // dans des messages entierement rediges en francais.
  const fromName = 'So You Cosmetics Genève';
  const fromEmail = process.env.SMTP_FROM || 'no-reply@soyoucosmetics.com';
  
  // Pourquoi l'envoi a échoué, quand il échoue.
  //
  // Ce service retombe volontairement sur un journal local dès que le SMTP
  // refuse : une confirmation de commande ne doit jamais faire échouer un
  // paiement encaissé. Mais l'appelant n'apprenait RIEN de la cause, et
  // l'infolettre a besoin de la connaître — une adresse qui n'existe pas et un
  // serveur momentanément indisponible demandent deux réactions opposées.
  // L'objet renvoyé porte donc le motif ; le comportement, lui, ne change pas.
  let echec = null;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        // Répondre à un avis de message doit écrire à la cliente, pas à
        // « no-reply ». Sans cela il faut recopier l'adresse à la main.
        ...(replyTo ? { replyTo } : {}),
        subject,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip tags for plain text fallback
        html
      });
      // Un serveur peut accepter le message ET refuser un destinataire, sans
      // lever d'erreur. Sans cette vérification, l'envoi passerait pour réussi.
      if (Array.isArray(info.rejected) && info.rejected.length > 0) {
        echec = {
          message: 'Destinataire refusé par le serveur',
          code: info.rejectedErrors && info.rejectedErrors[0] && info.rejectedErrors[0].responseCode,
          reponse: info.response,
        };
      } else {
        console.log(`Email sent successfully via SMTP. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      }
    } catch (err) {
      console.error('SMTP Email transmission failed, logging locally instead:', err);
      echec = {
        message: err.message,
        code: err.responseCode || err.code,
        reponse: err.response,
      };
    }
  }

  // Local file log mode (development fallback)
  const logEntry = {
    id: 'mail_' + Math.random().toString(36).substr(2, 9),
    from: `"${fromName}" <${fromEmail}>`,
    to,
    replyTo: replyTo || null,
    subject,
    text: text || html.replace(/<[^>]*>/g, ''),
    html,
    timestamp: new Date().toISOString()
  };

  console.log('================[ SENT EMAIL LOG ]================');
  console.log(`  To:      ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Date:    ${logEntry.timestamp}`);
  console.log('===================================================');

  try {
    const data = JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
    data.push(logEntry);
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save email log to file:', err);
  }

  return { success: true, messageId: logEntry.id, mock: true, echec };
}

module.exports = {
  sendMail
};
