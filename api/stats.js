import { neon } from '@neondatabase/serverless';

function getConnectionString() {
  return (
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

const AREAS = ['family', 'work', 'daily', 'friend'];

// 예전 구조(가족/업무/나 고정 칸)를 새 항목 구조로 변환
function legacyToEntries(c) {
  if (!c) return [];
  const map = [
    ['family', 'family', (x) => ({ did: x.text, feel: x.good, improve: x.improve })],
    ['work', 'work', (x) => ({ did: x.text, improve: x.improve, good: x.good })],
    ['self', 'daily', (x) => ({ did: x.text, feel: x.good, improve: x.improve })],
  ];
  return map
    .filter(([k]) => c[k] && (c[k].text || c[k].good || c[k].improve || c[k].score || (c[k].tags || []).length))
    .map(([k, type, f]) => ({
      type,
      score: c[k].score || null,
      fields: Object.fromEntries(Object.entries(f(c[k])).filter(([, v]) => v)),
      tags: c[k].tags || [],
    }));
}
const splitNames = (t) =>
  String(t || '')
    .replace(/•/g, ',')
    .split(/[,，、\n]|\s와\s|\s랑\s|\s과\s/)
    .map((x) => x.trim())
    .filter(Boolean);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

export default async function handler(req, res) {
  const cs = getConnectionString();
  if (!cs) return res.status(500).json({ error: 'DB connection string not found.' });
  const sql = neon(cs);

  try {
    const from = (req.query && req.query.from) || null; // YYYY-MM-DD, 없으면 전체
    const rows = from
      ? await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, entries, routines, plan, plan_done, write_score
                  FROM daily_records WHERE date >= ${from} ORDER BY date`
      : await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, mood, mood_score, categories, entries, routines, plan, plan_done, write_score
                  FROM daily_records ORDER BY date`;

    // 날짜별로 항목을 종류별로 묶음 (같은 종류 카드가 여러 개면 점수는 평균, 태그는 합침)
    rows.forEach((r) => {
      r._entries = Array.isArray(r.entries) && r.entries.length ? r.entries : legacyToEntries(r.categories);
      r._t = {};
      AREAS.forEach((t) => {
        const es = r._entries.filter((e) => e.type === t);
        if (!es.length) return;
        const sc = es.map((e) => e.score).filter(Boolean);
        r._t[t] = { score: sc.length ? Math.round(avg(sc)) : null, tags: [...new Set(es.flatMap((e) => e.tags || []))] };
      });
    });

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
        const tags = (r._t[area] && r._t[area].tags) || [];
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
      const withScore = rows.filter((r) => r._t[area] && r._t[area].score);
      const scores = withScore.map((r) => r._t[area].score);
      const high = withScore.filter((r) => r._t[area].score >= 4 && r.mood_score != null).map((r) => r.mood_score);
      const low = withScore.filter((r) => r._t[area].score <= 2 && r.mood_score != null).map((r) => r.mood_score);
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

    // 9) 기록 타임어택: 기간의 모든 날짜 (안 쓴 날 = 0점)
    const to = (req.query && req.query.to) || null; // 앱 기준 "오늘"
    const addDay = (iso, n) => {
      const d = new Date(iso + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    let timeAttack = null;
    const startDate = from || (rows[0] && rows[0].date);
    if (startDate && to && startDate <= to) {
      const days = [];
      for (let d = startDate; d <= to && days.length < 400; d = addDay(d, 1)) {
        const r = byDate[d];
        // 오늘인데 아직 안 썼으면 "진행 중"(null), 예전 기록 중 점수 없는 건 제외(null)
        let score;
        if (r) score = r.write_score != null ? r.write_score : null;
        else score = d === to ? null : 0;
        days.push({ date: d, score, pending: !r && d === to });
      }
      const known = days.filter((x) => x.score != null).map((x) => x.score);
      let streak = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].pending) continue;
        if (days[i].score != null && days[i].score > 0) streak++;
        else break;
      }
      timeAttack = {
        avg: known.length ? Math.round(avg(known)) : null,
        streak,
        onTime: days.filter((x) => x.score != null && x.score >= 70).length,
        zero: days.filter((x) => x.score === 0).length,
        days: days.slice(-30),
      };
    }

    // 6) 잘한 점 / 보완할 점 모아보기 (최신순)
    const reflections = [];
    [...rows].reverse().forEach((r) => {
      r._entries.forEach((e) => {
        const f = e.fields || {};
        const good = f.feel || f.good;
        if (good) reflections.push({ date: r.date, area: e.type, type: 'good', text: good });
        if (f.improve) reflections.push({ date: r.date, area: e.type, type: 'improve', text: f.improve });
      });
    });

    // 10) 친구: 자주 만난 사람, 자주 간 곳
    const who = {};
    const where = {};
    let meetings = 0;
    rows.forEach((r) =>
      r._entries
        .filter((e) => e.type === 'friend')
        .forEach((e) => {
          meetings++;
          splitNames(e.fields && e.fields.who).forEach((n) => (who[n] = (who[n] || 0) + 1));
          const w = ((e.fields && e.fields.where) || '').trim();
          if (w) where[w] = (where[w] || 0) + 1;
        })
    );
    const top = (o) => Object.entries(o).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    const friends = { meetings, who: top(who), where: top(where) };

    return res.status(200).json({
      friends,
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
      timeAttack,
    });
  } catch (err) {
    console.error('stats API error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
