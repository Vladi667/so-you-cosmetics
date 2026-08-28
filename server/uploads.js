const fs = require('fs');
const path = require('path');

// Where admin-uploaded product images live on disk.
//
// Defaults to server/data/uploads, which survives a deploy that only replaces
// ./dist. If the host wipes the application directory on deploy (fresh
// container, rsync --delete, rebuild from git), set UPLOADS_DIR to a path on a
// persistent volume — otherwise every deploy silently deletes the shop's
// product photos while their URLs stay in the database, leaving broken images.
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'data', 'uploads');

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

module.exports = { UPLOADS_DIR, ensureUploadsDir };
