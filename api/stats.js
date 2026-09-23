import { neon } from '@neondatabase/serverless';

function getConnectionString() {
  return (
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

const AREAS = ['family', 'work', 'self'];
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

export default async function handler(req, res) {
  const cs = getConnectionString();
  if (!cs) return res.status(500).json({ error: 'DB connection string not found.' });
  const sql = neon(cs);

  try {
    const from = (req.query && req.query.from) || null; // YYYY-MM-DD, 없으면 전체
    const rows = from
      ? await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, routines
                  FROM daily_records WHERE date >= ${from} ORDER BY date`
      : await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, routines
                  FROM daily_records ORDER BY date`;

    const scored = rows.filter((r) => r.mood_score != null);

    // 1) 기분 추이
    const moodTrend = scored.map((r) => ({ date: r.date, score: r.mood_score }));

    // 2) 요일별 평균 기분 (0=일 ~ 6=토)
    const byDow = Array.from({ length: 7 }, () => []);
    scored.forEach((r) => byDow[new Date(r.date + 'T00:00:00Z').getUTCDay()].push(r.mood_score));
    const weekday = byDow.map((arr, dow) => ({ dow, avg: round1(avg(arr)), count: arr.length }));

    // 3) 루틴 달성률
    const routineMap = {};
    rows.forEach((r) => {
      Object.entries(r.routines || {}).forEach(([name, done]) => {
        routineMap[name] = routineMap[name] || { name, done: 0, total: 0 };
        routineMap[name].total += 1;
        if (done) routineMap[name].done += 1;
      });
    });
    const routines = Object.values(routineMap)
      .map((x) => ({ ...x, rate: x.total ? Math.round((x.done / x.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);

    // 4) 영역별 태그 순위 + 5) 태그와 기분의 관계
    const tagsByArea = {};
    const tagDays = {}; // tag -> Set(date)
    AREAS.forEach((area) => {
      const counts = {};
      rows.forEach((r) => {
        const tags = (r.categories && r.categories[area] && r.categories[area].tags) || [];
        tags.forEach((t) => {
          counts[t] = (counts[t] || 0) + 1;
          (tagDays[t] = tagDays[t] || new Set()).add(r.date);
        });
      });
      tagsByArea[area] = Object.entries(counts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    });
    const tagMood = Object.entries(tagDays)
      .map(([tag, set]) => {
        const withT = scored.filter((r) => set.has(r.date)).map((r) => r.mood_score);
        const withoutT = scored.filter((r) => !set.has(r.date)).map((r) => r.mood_score);
        return { tag, days: set.size, withAvg: round1(avg(withT)), withoutAvg: round1(avg(withoutT)) };
      })
      .filter((x) => x.days >= 2 && x.withAvg != null && x.withoutAvg != null)
      .sort((a, b) => b.days - a.days)
      .slice(0, 6);

    // 6) 잘한 점 / 보완할 점 모아보기 (최신순)
    const reflections = [];
    [...rows].reverse().forEach((r) => {
      AREAS.forEach((area) => {
        const c = (r.categories && r.categories[area]) || {};
        if (c.good) reflections.push({ date: r.date, area, type: 'good', text: c.good });
        if (c.improve) reflections.push({ date: r.date, area, type: 'improve', text: c.improve });
      });
    });

    return res.status(200).json({
      summary: { days: rows.length, avgMood: round1(avg(scored.map((r) => r.mood_score))) },
      moodTrend,
      weekday,
      routines,
      tagsByArea,
      tagMood,
      reflections,
    });
  } catch (err) {
    console.error('stats API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
