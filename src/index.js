import dotenv from 'dotenv';
dotenv.config(); // loads .env
dotenv.config({ path: '.env.local', override: true }); // overrides with .env.local if present
import express from 'express';
import cors from 'cors';
import { createPoolAndMigrate } from './lib/db.js';
import rastreamentosRouter from './routes/rastreamentos.js';
import etapasRouter from './routes/etapas.js';

const app = express();

// -------- CORS HARDENING & NORMALIZATION --------
// Accept a comma separated list in CORS_ORIGIN (e.g. "https://jettransp.site,https://www.jettransp.site,http://localhost:5173")
// Supports:
//  - Exact origin match after normalization
//  - Optional ignoring of leading 'www.' if counterpart listed
//  - Trailing slash tolerance
//  - Wildcard '*'
// Set CORS_DEBUG=1 to log decisions
const rawOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const DEBUG = process.env.CORS_DEBUG === '1';

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    // If it already includes protocol, URL can parse it.
    const u = new URL(value);
    return u.origin; // strips any paths/query
  } catch (e) {
    // Try to add protocol if missing
    try {
      const u2 = new URL('https://' + value.replace(/^https?:\/\//, ''));
      return u2.origin;
    } catch {
      return value.replace(/\/$/, '');
    }
  }
}

const normalizedAllowed = rawOrigins.includes('*') ? ['*'] : Array.from(new Set(rawOrigins.map(normalizeOrigin)));

function originAllowed(incoming) {
  if (!incoming) return true; // same-origin / non-browser requests
  if (normalizedAllowed.includes('*')) return true;
  const norm = normalizeOrigin(incoming);
  if (normalizedAllowed.includes(norm)) return true;
  // Handle www. variations (only if one side listed)
  if (norm) {
    if (norm.startsWith('https://www.')) {
      const withoutWww = norm.replace('https://www.', 'https://');
      if (normalizedAllowed.includes(withoutWww)) return true;
    } else if (norm.startsWith('http://www.')) {
      const withoutWww = norm.replace('http://www.', 'http://');
      if (normalizedAllowed.includes(withoutWww)) return true;
    } else if (norm.startsWith('https://')) {
      const withWww = norm.replace('https://', 'https://www.');
      if (normalizedAllowed.includes(withWww)) return true;
    } else if (norm.startsWith('http://')) {
      const withWww = norm.replace('http://', 'http://www.');
      if (normalizedAllowed.includes(withWww)) return true;
    }
  }
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    const allowed = originAllowed(origin);
    if (DEBUG) {
      console.log('[CORS]', {
        origin,
        allowed,
        normalizedAllowed
      });
    }
    if (allowed) return callback(null, true);
    return callback(new Error('CORS not allowed for origin: ' + origin));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
  optionsSuccessStatus: 204
}));

// Optional manual header injection for transparency when DEBUG enabled (does not replace cors package)
if (DEBUG) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && originAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    next();
  });
}
// -----------------------------------------------
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

const pool = await createPoolAndMigrate();
app.set('db', pool);

app.use('/rastreamentos', rastreamentosRouter(pool));
app.use('/etapas', etapasRouter(pool));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});
