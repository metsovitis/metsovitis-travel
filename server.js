const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:plhZVkkOfWzNSdDbvxAcKSkdLdZBuZbI@ballast.proxy.rlwy.net:56334/railway',
  ssl: { rejectUnauthorized: false }
});
async function initDB() {
  await pool.query('CREATE TABLE IF NOT EXISTS trips (id BIGINT PRIMARY KEY, data JSONB NOT NULL)');
  await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)');
  // Πίνακας διαγραμμένων IDs
  await pool.query('CREATE TABLE IF NOT EXISTS deleted_trips (id BIGINT PRIMARY KEY, deleted_at TIMESTAMP DEFAULT NOW())');
}
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// GET: επιστρέφει ΟΛΑ τα trips (εξαιρώντας τα διαγραμμένα)
app.get('/api/trips', async (req, res) => {
  res.set('Cache-Control','no-store,no-cache,must-revalidate');
  res.set('Pragma','no-cache');
  try {
    const r = await pool.query(`
      SELECT t.data FROM trips t
      WHERE t.id NOT IN (SELECT id FROM deleted_trips)
      ORDER BY (t.data->>'date') ASC, (t.data->>'time') ASC
    `);
    res.json(r.rows.map(x => x.data));
  } catch(e) { res.json([]); }
});

// POST: UPSERT — κάθε trip αποθηκεύεται ξεχωριστά, δεν σβήνεται τίποτα
app.post('/api/trips', async (req, res) => {
  const trips = req.body;
  if (!Array.isArray(trips)) return res.json({ ok: true });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const t of trips) {
        if (!t.id) continue;
        // Μην αποθηκεύεις αν είναι διαγραμμένο
        const del = await client.query('SELECT id FROM deleted_trips WHERE id=$1', [t.id]);
        if (del.rows.length > 0) continue;
        await client.query(
          'INSERT INTO trips (id,data) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data',
          [t.id, JSON.stringify(t)]
        );
      }
      await client.query('COMMIT');
      res.json({ ok: true, count: trips.length });
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE ενός trip — αποθηκεύει στο deleted_trips ώστε να μην ξαναεμφανιστεί
app.delete('/api/trips/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query('INSERT INTO deleted_trips (id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
    await pool.query('DELETE FROM trips WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM trips');
    res.json({ ok: true, trips: parseInt(r.rows[0].count) });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});
app.get('/api/drivers', async (req, res) => {
  try {
    const r = await pool.query("SELECT value FROM settings WHERE key='drivers'");
    if(r.rows.length) res.json(r.rows[0].value); else res.json([]);
  } catch(e) { res.json([]); }
});
app.post('/api/drivers', async (req, res) => {
  const drivers = req.body;
  if(!Array.isArray(drivers)) return res.status(400).json({ error: 'Invalid' });
  try {
    await pool.query("INSERT INTO settings (key,value) VALUES ('drivers',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [JSON.stringify(drivers)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/partners', async (req, res) => {
  try {
    const r = await pool.query("SELECT value FROM settings WHERE key='partners'");
    if(r.rows.length) res.json(r.rows[0].value); else res.json([]);
  } catch(e) { res.json([]); }
});
app.post('/api/partners', async (req, res) => {
  const partners = req.body;
  if(!Array.isArray(partners)) return res.status(400).json({ error: 'Invalid' });
  try {
    await pool.query("INSERT INTO settings (key,value) VALUES ('partners',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [JSON.stringify(partners)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ai-parse', async (req, res) => {
  const { text } = req.body;
  if(!text) return res.status(400).json({ error: 'No text' });
  try {
    const postData = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: text }]
    });
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      const req2 = https.request(options, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
      });
      req2.on('error', reject);
      req2.write(postData);
      req2.end();
    });
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
initDB().then(() => app.listen(PORT, () => console.log('Port ' + PORT)));
