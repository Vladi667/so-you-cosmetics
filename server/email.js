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
      console.log(`Email sent successfully via SMTP. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('SMTP Email transmission failed, logging locally instead:', err);
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

  return { success: true, messageId: logEntry.id, mock: true };
}

module.exports = {
  sendMail
};
