// Echofield backend — proxies Adzuna Jobs API so the app_id/app_key never
// sit exposed in frontend JS. Deployed on Render as a Web Service.

const express = require('express');
const cors = require('cors');

const app = express();

// Allow requests from your Netlify frontend (and localhost while testing).
// Add your real Netlify URL to ALLOWED_ORIGINS on Render once you have it.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins
}));

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const ADZUNA_COUNTRY = process.env.ADZUNA_COUNTRY || 'in';

// Health check — Render/you can hit this to confirm the service is alive.
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'echofield-backend' });
});

// Main proxy endpoint. Mirrors the exact params the frontend already builds:
// page, what, what_or, full_time, results_per_page.
app.get('/api/jobs/:page', async (req, res) => {
  try {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
      return res.status(500).json({ error: 'MISSING_KEYS' });
    }

    const page = req.params.page || '1';
    const {
      what = '',
      what_or = '',
      full_time = '',
      results_per_page = '8'
    } = req.query;

    const params = new URLSearchParams({
      app_id: ADZUNA_APP_ID,
      app_key: ADZUNA_APP_KEY,
      results_per_page,
      what,
      'content-type': 'application/json',
      sort_by: 'date'
    });
    if (what_or) params.set('what_or', what_or);
    if (full_time) params.set('full_time', full_time);

    const url = `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/${page}?${params.toString()}`;

    const adzunaRes = await fetch(url);
    if (!adzunaRes.ok) {
      const code = (adzunaRes.status === 401 || adzunaRes.status === 403) ? 'BAD_KEYS' : 'ADZUNA_ERROR';
      return res.status(adzunaRes.status).json({ error: code });
    }
    const data = await adzunaRes.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Echofield backend running on port ${PORT}`));
