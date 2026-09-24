import { neon } from '@neondatabase/serverless';

function getConnectionString() {
  return (
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

let schemaReady = false;
async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT,
      body TEXT,
      tags JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 15);
}

export default async function handler(req, res) {
  const connectionString = getConnectionString();
  if (!connectionString) return res.status(500).json({ error: 'DB connection string not found.' });
  const sql = neon(connectionString);

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const { id, category, q } = req.query || {};
      if (id) {
        const rows = await sql`SELECT * FROM notes WHERE id = ${id}`;
        return res.status(200).json(rows[0] || null);
      }
      let rows;
      if (q) {
        rows = await sql`
          SELECT * FROM notes
          WHERE title ILIKE ${'%' + q + '%'} OR body ILIKE ${'%' + q + '%'}
          ORDER BY updated_at DESC LIMIT 300
        `;
      } else if (category) {
        rows = await sql`SELECT * FROM notes WHERE category = ${category} ORDER BY updated_at DESC LIMIT 300`;
      } else {
        rows = await sql`SELECT * FROM notes ORDER BY updated_at DESC LIMIT 300`;
      }
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { id, category, title, body, tags } = req.body || {};
      if (!category) return res.status(400).json({ error: 'category is required' });
      const noteId = id || `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const tagJson = JSON.stringify(cleanTags(tags));
      const rows = await sql`
        INSERT INTO notes (id, category, title, body, tags, updated_at)
        VALUES (${noteId}, ${category}, ${title || null}, ${body || null}, ${tagJson}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET category = ${category}, title = ${title || null}, body = ${body || null}, tags = ${tagJson}, updated_at = NOW()
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      await sql`DELETE FROM notes WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('notes API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
