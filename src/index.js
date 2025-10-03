import dotenv from 'dotenv';
dotenv.config(); // loads .env
dotenv.config({ path: '.env.local', override: true }); // overrides with .env.local if present
import express from 'express';
import cors from 'cors';
import { createPoolAndMigrate } from './lib/db.js';
import rastreamentosRouter from './routes/rastreamentos.js';
import etapasRouter from './routes/etapas.js';

const app = express();
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
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
