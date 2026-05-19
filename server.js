const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const DB = 'postgresql://postgres:plhZVkkOfWzNSdDbvxAcKSkdLdZBuZbI@ballast.proxy.rlwy.net:56334/railway';

const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

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

initDB().then(() => app.listen(PORT, () => console.log('OK port ' + PORT)));
