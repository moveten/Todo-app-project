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
      ? await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, routines, plan, plan_done
                  FROM daily_records WHERE date >= ${from} ORDER BY date`
      : await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, routines, plan, plan_done
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

    // 3-1) 체크리스트 항목을 한 날 vs 안 한 날의 기분 (어떤 행동이 기분에 도움이 되나)
    const routineMood = Object.keys(routineMap)
      .map((name) => {
        const rel = scored.filter((r) => r.routines && name in r.routines);
        const yes = rel.filter((r) => r.routines[name]).map((r) => r.mood_score);
        const no = rel.filter((r) => !r.routines[name]).map((r) => r.mood_score);
        return { name, yesDays: yes.length, noDays: no.length, yesAvg: round1(avg(yes)), noAvg: round1(avg(no)) };
      })
      .filter((x) => x.yesDays >= 2 && x.noDays >= 2)
      .map((x) => ({ ...x, diff: round1(x.yesAvg - x.noAvg) }))
      .sort((a, b) => b.diff - a.diff);

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

    // 7) 영역별 만족도: 평균 + 만족도 높은 날/낮은 날의 기분 차이 (무엇이 기분을 좌우하나)
    const areaScores = AREAS.map((area) => {
      const withScore = rows.filter((r) => r.categories && r.categories[area] && r.categories[area].score);
      const scores = withScore.map((r) => r.categories[area].score);
      const high = withScore.filter((r) => r.categories[area].score >= 4 && r.mood_score != null).map((r) => r.mood_score);
      const low = withScore.filter((r) => r.categories[area].score <= 2 && r.mood_score != null).map((r) => r.mood_score);
      return { area, avg: round1(avg(scores)), days: scores.length, highMood: round1(avg(high)), lowMood: round1(avg(low)), highDays: high.length, lowDays: low.length };
    });

    // 8) 내일 딱 한 가지: 실행률 + 실행한 날(다음날)의 기분
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
    const nextDate = (iso) => {
      const d = new Date(iso + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    const checked = rows.filter((r) => r.plan && r.plan_done != null);
    const doneList = checked.filter((r) => r.plan_done);
    const moodAfter = (list) => avg(list.map((r) => byDate[nextDate(r.date)]).filter((n) => n && n.mood_score != null).map((n) => n.mood_score));
    const plans = {
      made: rows.filter((r) => r.plan).length,
      checked: checked.length,
      done: doneList.length,
      rate: checked.length ? Math.round((doneList.length / checked.length) * 100) : null,
      moodDone: round1(moodAfter(doneList)),
      moodNotDone: round1(moodAfter(checked.filter((r) => !r.plan_done))),
      recent: [...checked].reverse().slice(0, 5).map((r) => ({ date: r.date, plan: r.plan, done: r.plan_done })),
    };

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
      areaScores,
      plans,
      routineMood,
    });
  } catch (err) {
    console.error('stats API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
