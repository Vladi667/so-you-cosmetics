require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

const apiRouter = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Log HTTP requests (Morgan)
app.use(morgan('dev'));

// Parse incoming JSON requests. Preserve the raw body too so /api/sumup/webhook
// can verify SumUp's HMAC signature against the exact bytes that were signed.
// Limit is generous because product image uploads are sent as base64 JSON.
app.use(express.json({
  limit: '25mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// Serve admin-uploaded product images. Stored under server/data/uploads so they
// survive deploys (dist is overwritten on each deploy) and are never committed.
const uploadsRoot = path.join(__dirname, 'data', 'uploads');
require('fs').mkdirSync(uploadsRoot, { recursive: true });
app.use('/uploads', express.static(uploadsRoot));

// Serve ACME HTTP-01 challenge files from the filesystem (for Let's Encrypt SSL validation).
// Infomaniak writes challenge tokens into ./.well-known/acme-challenge/ at the site root.
const acmeRoot = path.join(__dirname, '..', '.well-known');
app.use('/.well-known', express.static(acmeRoot, { dotfiles: 'allow', fallthrough: false }));

// API endpoints mounted on /api
app.use('/api', apiRouter);

// Serve static built files from React in production
const buildPath = path.join(__dirname, '../dist');
app.use(express.static(buildPath));

// Catch-all handler for client-side routing. Redirects any non-API page request back to index.html
app.get('*', (req, res, next) => {
  // Never swallow ACME challenge requests with the SPA fallback
  if (req.path.startsWith('/.well-known/')) return next();
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  SoYou Cosmetics Server is now running!`);
  console.log(`  Local URL:  http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=========================================`);
});
