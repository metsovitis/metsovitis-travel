const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = '/tmp/trips.json';

function readTrips() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch(e) {}
  return [];
}

function writeTrips(trips) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(trips));
    return true;
  } catch(e) {
    return false;
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.get('/api/trips', (req, res) => {
  res.json(readTrips());
});

app.post('/api/trips', (req, res) => {
  const trips = req.body;
  if (!Array.isArray(trips)) return res.status(400).json({ error: 'Invalid data' });
  writeTrips(trips);
  res.json({ ok: true, count: trips.length });
});

app.get('/api/health', (req, res) => {
  const trips = readTrips();
  res.json({ ok: true, trips: trips.length });
});

app.listen(PORT, () => console.log('Running on port ' + PORT));
