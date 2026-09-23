import { neon } from '@neondatabase/serverless';

function getConnectionString() {
  return (
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

export default async function handler(req, res) {
  const connectionString = getConnectionString();

  if (!connectionString) {
    return res.status(500).json({ error: 'DB connection string not found in environment variables.' });
  }

  const sql = neon(connectionString);

  try {
    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key) {
        return res.status(400).json({ error: 'key is required' });
      }
      await sql`
        INSERT INTO app_backups (storage_key, data)
        VALUES (${key}, ${value ?? null})
        ON CONFLICT (storage_key) DO UPDATE
        SET data = ${value ?? null}, updated_at = NOW()
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
      const { key } = req.query || {};
      if (key) {
        const rows = await sql`SELECT storage_key, data, updated_at FROM app_backups WHERE storage_key = ${key}`;
        return res.status(200).json(rows[0] || null);
      }
      const rows = await sql`SELECT storage_key, updated_at FROM app_backups ORDER BY storage_key`;
      return res.status(200).json(rows);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('backup API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
