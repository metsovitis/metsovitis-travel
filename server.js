const express = require('express');
const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbPath = process.env.DB_PATH || './db.json';
const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({ trips: [] }).write();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '.')));

// Serve index.html for root
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ===== API =====

// Get all trips
app.get('/api/trips', (req, res) => {
  const trips = db.get('trips').value();
  res.json(trips);
});

// Save all trips (full sync)
app.post('/api/trips', (req, res) => {
  const trips = req.body;
  if (!Array.isArray(trips)) return res.status(400).json({ error: 'Invalid data' });
  db.set('trips', trips).write();
  res.json({ ok: true, count: trips.length });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, trips: db.get('trips').size().value() });
});

app.listen(PORT, () => {
  console.log(`Metsovitis Travel running on port ${PORT}`);
});
