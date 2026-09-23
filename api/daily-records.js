import { neon } from '@neondatabase/serverless';

function getConnectionString() {
  return (
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

// 통계용 컬럼 자동 추가 (함수가 새로 켜질 때 한 번만 실행)
let schemaReady = false;
async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS mood_score INTEGER`;
  await sql`ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS routines JSONB DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
  await sql`ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS advice TEXT`;
  await sql`ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS plan TEXT`;
  await sql`ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS plan_done BOOLEAN`;
  // 이미 저장된 과거 기록도 기분 점수를 채워서 통계에 포함되게 함
  await sql`
    UPDATE daily_records SET mood_score = CASE mood
      WHEN '😊' THEN 5 WHEN '🙂' THEN 4 WHEN '😐' THEN 3 WHEN '😞' THEN 2 WHEN '😣' THEN 1 END
    WHERE mood_score IS NULL AND mood IS NOT NULL
  `;
  schemaReady = true;
}

const MOOD_SCORES = { '😊': 5, '🙂': 4, '😐': 3, '😞': 2, '😣': 1 };

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean))].slice(0, 20);
}

export default async function handler(req, res) {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return res.status(500).json({ error: 'DB connection string not found.' });
  }
  const sql = neon(connectionString);

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const { date } = req.query || {};
      if (date) {
        const rows = await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, reflection, routines, advice, plan, plan_done, updated_at FROM daily_records WHERE date = ${date}`;
        return res.status(200).json(rows[0] || null);
      }
      const rows = await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, reflection, routines, advice, plan, plan_done, updated_at FROM daily_records ORDER BY date DESC LIMIT 100`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { date, mood, categories, reflection, routines, advice, plan } = req.body || {};
      if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

      const moodScore = MOOD_SCORES[mood] ?? null;
      const cat = categories || {};
      const cleanCats = {};
      for (const k of ['work', 'family', 'self']) {
        cleanCats[k] = {
          text: (cat[k] && cat[k].text) || '',
          good: (cat[k] && cat[k].good) || '',
          improve: (cat[k] && cat[k].improve) || '',
          score: [1, 2, 3, 4, 5].includes(Number(cat[k] && cat[k].score)) ? Number(cat[k].score) : null,
          tags: cleanTags(cat[k] && cat[k].tags),
        };
      }
      const cleanRoutines = {};
      if (routines && typeof routines === 'object') {
        for (const [name, done] of Object.entries(routines)) {
          if (name.trim()) cleanRoutines[name.trim()] = Boolean(done);
        }
      }

      const catJson = JSON.stringify(cleanCats);
      const refJson = JSON.stringify(reflection || {});
      const routJson = JSON.stringify(cleanRoutines);

      const rows = await sql`
        INSERT INTO daily_records (date, mood, mood_score, categories, reflection, routines, advice, plan, updated_at)
        VALUES (${date}, ${mood || null}, ${moodScore}, ${catJson}, ${refJson}, ${routJson}, ${advice || null}, ${plan || null}, NOW())
        ON CONFLICT (date) DO UPDATE
        SET mood = ${mood || null},
            mood_score = ${moodScore},
            categories = ${catJson},
            reflection = ${refJson},
            routines = ${routJson},
            advice = ${advice || null},
            plan = ${plan || null},
            updated_at = NOW()
        RETURNING to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, reflection, routines, advice, plan, plan_done, updated_at
      `;
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'PATCH') {
      const { date, plan_done } = req.body || {};
      if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
      const val = plan_done === null || plan_done === undefined ? null : Boolean(plan_done);
      const rows = await sql`UPDATE daily_records SET plan_done = ${val} WHERE date = ${date} RETURNING to_char(date, 'YYYY-MM-DD') AS date, plan, plan_done`;
      return res.status(200).json(rows[0] || null);
    }

    if (req.method === 'DELETE') {
      const { date } = req.query || {};
      if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
      await sql`DELETE FROM daily_records WHERE date = ${date}`;
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('daily-records API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
