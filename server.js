const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: 'postgresql://postgres:plhZVkkOfWzNSdDbvxAcKSkdLdZBuZbI@ballast.proxy.rlwy.net:56334/railway',
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query('CREATE TABLE IF NOT EXISTS trips (id BIGINT PRIMARY KEY, data JSONB NOT NULL)');
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.get('/api/trips', async (req, res) => {
  try {
    const r = await pool.query("SELECT data FROM trips ORDER BY (data->>'date') ASC, (data->>'time') ASC");
    res.json(r.rows.map(x => x.data));
  } catch(e) { res.json([]); }
});

app.post('/api/trips', async (req, res) => {
  const trips = req.body;
  if (!Array.isArray(trips) || trips.length === 0) return res.json({ ok: true });
  try {
    await pool.query('DELETE FROM trips');
    for (const t of trips) {
      if (t.id) await pool.query('INSERT INTO trips (id,data) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data=$2', [t.id, t]);
    }
    res.json({ ok: true, count: trips.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM trips');
    res.json({ ok: true, trips: parseInt(r.rows[0].count) });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// Drivers API
app.get('/api/drivers', async (req, res) => {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)');
    const r = await pool.query("SELECT value FROM settings WHERE key='drivers'");
    if(r.rows.length) res.json(r.rows[0].value);
    else res.json([]);
  } catch(e) { res.json([]); }
});

app.post('/api/drivers', async (req, res) => {
  const drivers = req.body;
  if(!Array.isArray(drivers)) return res.status(400).json({ error: 'Invalid' });
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)');
    await pool.query("INSERT INTO settings (key,value) VALUES ('drivers',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [JSON.stringify(drivers)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/partners', async (req, res) => {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)');
    const r = await pool.query("SELECT value FROM settings WHERE key='partners'");
    if(r.rows.length) res.json(r.rows[0].value);
    else res.json([]);
  } catch(e) { res.json([]); }
});

app.post('/api/partners', async (req, res) => {
  const partners = req.body;
  if(!Array.isArray(partners)) return res.status(400).json({ error: 'Invalid' });
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)');
    await pool.query("INSERT INTO settings (key,value) VALUES ('partners',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [JSON.stringify(partners)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

initDB().then(() => app.listen(PORT, () => console.log('Port ' + PORT)));
