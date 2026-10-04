import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from './app.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
pool.on('error', error => console.error('Database connection error:', error.message));

try {
  await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  const server = createApp(pool).listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`API listening on port ${process.env.PORT || 3000}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      server.close(async () => { await pool.end(); clearTimeout(timeout); });
    });
  }
} catch (error) {
  console.error('API startup failed:', error.message);
  await pool.end();
  process.exitCode = 1;
}
