// IMAP service for reading the contact@ mailbox from the admin dashboard.
// Connects on demand (no persistent connection) using ImapFlow.
// Reads credentials from db.getInboxConfig() which merges admin-saved settings
// with env-var fallback (IMAP_HOST / IMAP_PORT / IMAP_USER / IMAP_PASS / IMAP_SECURE).
const db = require('./db');

let ImapFlow = null;
try {
  ({ ImapFlow } = require('imapflow'));
} catch (_) {
  console.warn('imapflow not installed — inbox feature disabled.');
}

function isConfigured() {
  const cfg = db.getInboxConfig();
  return !!(cfg.host && cfg.user && cfg.pass);
}

function buildClient() {
  const cfg = db.getInboxConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    throw new Error('Boîte de réception non configurée');
  }
  return new ImapFlow({
    host: cfg.host,
    port: parseInt(cfg.port || '993', 10),
    secure: cfg.secure !== false && cfg.secure !== 'false',
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false
  });
}

// List recent messages with envelope info only (no body). Newest first.
async function listMessages({ mailbox = 'INBOX', limit = 50 } = {}) {
  if (!ImapFlow) throw new Error('Module IMAP indisponible côté serveur');
  const client = buildClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    const messages = [];
    try {
      const status = client.mailbox.exists || 0;
      if (status === 0) return [];
      const from = Math.max(1, status - limit + 1);
      const range = `${from}:${status}`;
      for await (const msg of client.fetch(range, { envelope: true, flags: true, uid: true, internalDate: true, size: true })) {
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: msg.envelope?.subject || '(sans objet)',
          from: (msg.envelope?.from || []).map(a => ({ name: a.name || '', address: a.address || '' })),
          to: (msg.envelope?.to || []).map(a => ({ name: a.name || '', address: a.address || '' })),
          date: msg.envelope?.date || msg.internalDate,
          seen: msg.flags ? msg.flags.has('\\Seen') : false,
          size: msg.size || 0
        });
      }
    } finally {
      lock.release();
    }
    return messages.sort((a, b) => new Date(b.date) - new Date(a.date));
  } finally {
    await client.logout().catch(() => {});
  }
}

// Fetch full body for one message by UID
async function getMessage(uid, { mailbox = 'INBOX' } = {}) {
  if (!ImapFlow) throw new Error('Module IMAP indisponible côté serveur');
  const client = buildClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const msg = await client.fetchOne(String(uid), { source: true, envelope: true, flags: true, uid: true, internalDate: true }, { uid: true });
      if (!msg) return null;
      // Try to parse text + html out of raw source very simply (mailparser would be nicer
      // but is a heavy dep; do a small best-effort here).
      const raw = msg.source ? msg.source.toString('utf8') : '';
      const { textPlain, textHtml } = naiveExtractBodies(raw);
      // Mark as read
      try { await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }); } catch (_) {}
      return {
        uid: msg.uid,
        subject: msg.envelope?.subject || '(sans objet)',
        from: (msg.envelope?.from || []).map(a => ({ name: a.name || '', address: a.address || '' })),
        to: (msg.envelope?.to || []).map(a => ({ name: a.name || '', address: a.address || '' })),
        date: msg.envelope?.date || msg.internalDate,
        text: textPlain,
        html: textHtml,
        raw
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

// Very small MIME body extractor — handles common single-part and multipart/alternative
// mails. For anything fancier (attachments, nested multipart) the raw source is still
// returned so the admin can read it.
function naiveExtractBodies(raw) {
  let textPlain = '';
  let textHtml = '';
  if (!raw) return { textPlain, textHtml };

  const headerEnd = raw.indexOf('\r\n\r\n');
  if (headerEnd < 0) return { textPlain: raw, textHtml: '' };
  const headers = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd + 4);

  const ctMatch = headers.match(/Content-Type:\s*([^;\r\n]+)(;[^\r\n]*)?/i);
  const ct = ctMatch ? ctMatch[1].trim().toLowerCase() : 'text/plain';

  if (ct.startsWith('multipart/')) {
    const boundaryMatch = headers.match(/boundary="?([^";\r\n]+)"?/i);
    if (boundaryMatch) {
      const boundary = '--' + boundaryMatch[1];
      const parts = body.split(boundary).map(p => p.replace(/^\r?\n/, ''));
      for (const part of parts) {
        if (!part || part.startsWith('--')) continue;
        const pHdrEnd = part.indexOf('\r\n\r\n');
        if (pHdrEnd < 0) continue;
        const pHdr = part.slice(0, pHdrEnd);
        const pBody = part.slice(pHdrEnd + 4).replace(/\r?\n--\s*$/, '');
        const pCt = (pHdr.match(/Content-Type:\s*([^;\r\n]+)/i) || [, ''])[1].toLowerCase();
        const pEnc = (pHdr.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i) || [, ''])[1].toLowerCase().trim();
        const decoded = decodePart(pBody, pEnc);
        if (pCt === 'text/plain' && !textPlain) textPlain = decoded;
        else if (pCt === 'text/html' && !textHtml) textHtml = decoded;
      }
    }
  } else {
    const encMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
    const enc = encMatch ? encMatch[1].toLowerCase().trim() : '';
    const decoded = decodePart(body, enc);
    if (ct === 'text/html') textHtml = decoded;
    else textPlain = decoded;
  }
  return { textPlain, textHtml };
}

function decodePart(body, encoding) {
  if (encoding === 'base64') {
    try { return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8'); } catch (_) { return body; }
  }
  if (encoding === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return body;
}

module.exports = { isConfigured, listMessages, getMessage };
