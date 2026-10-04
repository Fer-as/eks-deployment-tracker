import express from 'express';

export const statuses = ['pending', 'in_progress', 'succeeded', 'failed'];

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.get('/deployments', async (_req, res) => {
    const { rows } = await db.query('SELECT id, application_name, environment, version, status, created_at FROM deployments ORDER BY created_at DESC, id DESC');
    res.json(rows);
  });

  app.post('/deployments', async (req, res) => {
    const fields = ['application_name', 'environment', 'version', 'status'];
    const body = req.body ?? {};
    if (fields.some(field => typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 100)) {
      return res.status(400).json({ error: 'All four fields are required and must be strings of 1–100 characters.' });
    }
    const values = fields.map(field => body[field].trim());
    if (!statuses.includes(values[3])) {
      return res.status(400).json({ error: `Status must be one of: ${statuses.join(', ')}.` });
    }
    const { rows } = await db.query(
      'INSERT INTO deployments (application_name, environment, version, status) VALUES ($1, $2, $3, $4) RETURNING id, application_name, environment, version, status, created_at',
      values,
    );
    res.status(201).json(rows[0]);
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
    console.error('Request failed:', error.message);
    res.status(500).json({ error: 'Unable to complete request.' });
  });
  return app;
}
