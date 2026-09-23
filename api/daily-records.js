import { neon } from '@neondatabase/serverless';

// Vercel's Neon integration can name the connection string differently
// depending on the prefix chosen during setup. Try common variants.
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
    return res.status(500).json({
      error:
        'DB connection string not found in environment variables. Check Vercel Settings > Environment Variables for the exact name (e.g. STORAGE_DATABASE_URL) and update api/daily-records.js accordingly.',
    });
  }

  const sql = neon(connectionString);

  try {
    if (req.method === 'GET') {
      const { date } = req.query || {};
      if (date) {
        const rows = await sql`SELECT * FROM daily_records WHERE date = ${date}`;
        return res.status(200).json(rows[0] || null);
      }
      const rows = await sql`SELECT * FROM daily_records ORDER BY date DESC LIMIT 100`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { date, mood, categories, reflection } = req.body || {};

      if (!date) {
        return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
      }

      const rows = await sql`
        INSERT INTO daily_records (date, mood, categories, reflection)
        VALUES (${date}, ${mood || null}, ${JSON.stringify(categories || {})}, ${JSON.stringify(reflection || {})})
        ON CONFLICT (date) DO UPDATE
        SET mood = ${mood || null},
            categories = ${JSON.stringify(categories || {})},
            reflection = ${JSON.stringify(reflection || {})}
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const { date } = req.query || {};
      if (!date) {
        return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
      }
      await sql`DELETE FROM daily_records WHERE date = ${date}`;
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('daily-records API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
