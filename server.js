const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS trips (id BIGINT PRIMARY KEY, data JSONB NOT NULL)');
    console.log('Database OK');
  } catch (err) {
    console.error('DB error:', err.message);
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.get('/api/trips', async (req, res) => {
  try {
    const r = await pool.query("SELECT data FROM trips ORDER BY (data->>'date') ASC, (data->>'time') ASC");
    res.json(r.rows.map(x => x.data));
  } catch (err) { res.json([]); }
});

app.post('/api/trips', async (req, res) => {
  const trips = req.body;
  if (!Array.isArray(trips) || trips.length === 0) return res.json({ ok: true, count: 0 });
  try {
    await pool.query('DELETE FROM trips');
    for (const trip of trips) {
      if (trip.id) await pool.query('INSERT INTO trips (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data=$2', [trip.id, trip]);
    }
    res.json({ ok: true, count: trips.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM trips');
    res.json({ ok: true, trips: parseInt(r.rows[0].count) });
  } catch (err) { res.json({ ok: false, error: err.message }); }
});

initDB().then(() => app.listen(PORT, () => console.log('Port ' + PORT)));
