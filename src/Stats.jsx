import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { C, F, shared } from "./theme";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 앱 기준 오늘 (새벽 4시 전은 전날)
const logicalToday = () => {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return toISO(d);
};
const fmtShort = (iso) => {
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const fmtFull = (iso) => {
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const AREA_LABEL = { family: "가족", work: "업무", daily: "일상", friend: "친구", self: "일상" };
const AREA_ORDER = ["family", "work", "daily", "friend"];
const MOOD_EMOJI = { 5: "😊", 4: "🙂", 3: "😐", 2: "😞", 1: "😣" };
const moodEmoji = (avg) => (avg == null ? "–" : MOOD_EMOJI[Math.min(5, Math.max(1, Math.round(avg)))]);

const PERIODS = [
  { key: 7, label: "7일" },
  { key: 30, label: "30일" },
  { key: 90, label: "90일" },
  { key: 0, label: "전체" },
];

const INDIGO = C.wine;

export default function Stats() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const today = logicalToday();
        let url = `/api/stats?to=${today}`;
        if (period > 0) {
          const d = new Date(today + "T00:00:00");
          d.setDate(d.getDate() - (period - 1));
          url += `&from=${toISO(d)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("fail");
        const json = await res.json();
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [period]);

  return (
    <div style={s.body}>
      <div style={s.periodRow}>
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{ ...s.periodBtn, ...(period === p.key ? s.periodBtnOn : {}) }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.center}>
          <Loader2 size={20} color={INDIGO} />
        </div>
      ) : error ? (
        <div style={s.empty}>통계를 불러오지 못했어요. 인터넷 연결을 확인해주세요.</div>
      ) : !data || data.summary.days === 0 ? (
        <div style={s.empty}>이 기간에 저장된 기록이 없어요. 기록이 쌓이면 여기에 통계가 나타나요.</div>
      ) : (
        <>
          <Summary summary={data.summary} routines={data.routines || []} />
          <TimeAttackStats ta={data.timeAttack} />
          <AreaScores items={data.areaScores || []} />
          <Plans plans={data.plans} />
          <Checks routines={data.routines || []} />
          <CheckMood items={data.routineMood || []} />
          <MoodTrend points={data.moodTrend} />
          <Weekday weekday={data.weekday} />
          <Friends friends={data.friends} />
          <Tags tagsByArea={data.tagsByArea} />
          <TagMood tagMood={data.tagMood} />
          <Reflections items={data.reflections} />
        </>
      )}
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
      {children}
    </div>
  );
}

function Summary({ summary, routines }) {
  const done = routines.reduce((a, r) => a + r.done, 0);
  const total = routines.reduce((a, r) => a + r.total, 0);
  const rate = total ? Math.round((done / total) * 100) : null;
  return (
    <div style={s.summaryRow}>
      <div style={s.summaryBox}>
        <div style={s.summaryNum}>{summary.days}일</div>
        <div style={s.summaryLabel}>기록한 날</div>
      </div>
      <div style={s.summaryBox}>
        <div style={s.summaryNum}>
          {moodEmoji(summary.avgMood)} {summary.avgMood ?? "–"}
        </div>
        <div style={s.summaryLabel}>평균 기분 (5점)</div>
      </div>
      <div style={s.summaryBox}>
        <div style={s.summaryNum}>{rate == null ? "–" : `${rate}%`}</div>
        <div style={s.summaryLabel}>체크리스트</div>
      </div>
    </div>
  );
}

function MoodTrend({ points }) {
  if (points.length < 2) {
    return (
      <Card title="기분 추이">
        <div style={s.hint}>기록이 2일 이상 쌓이면 그래프가 그려져요.</div>
      </Card>
    );
  }
  const W = 320, H = 150, padL = 26, padR = 10, padT = 10, padB = 24;
  const x = (i) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v) => padT + ((5 - v) * (H - padT - padB)) / 4;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const labelIdx = points.length <= 7 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <Card title="기분 추이" sub="위로 갈수록 좋은 날이에요">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="기분 추이 그래프">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 4} fontSize="11" textAnchor="end">{MOOD_EMOJI[v]}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={INDIGO} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.score)} r="3.2" fill={C.paper} stroke={INDIGO} strokeWidth="2" />
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="10.5" fill={C.ink2} textAnchor="middle">{fmtShort(points[i].date)}</text>
        ))}
      </svg>
    </Card>
  );
}

function Weekday({ weekday }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = ["일", "월", "화", "수", "목", "금", "토"];
  const vals = order.map((d) => weekday.find((w) => w.dow === d));
  const valid = vals.filter((v) => v && v.avg != null);
  if (!valid.length) return null;
  const best = valid.reduce((a, b) => (b.avg > a.avg ? b : a));
  const worst = valid.reduce((a, b) => (b.avg < a.avg ? b : a));
  return (
    <Card
      title="요일별 평균 기분"
      sub={valid.length > 1 && best.dow !== worst.dow ? `${names[best.dow]}요일이 가장 좋고, ${names[worst.dow]}요일이 가장 낮아요` : null}
    >
      <div style={s.barRow}>
        {vals.map((v, i) => {
          const avg = v && v.avg;
          const h = avg ? (avg / 5) * 90 : 0;
          return (
            <div key={i} style={s.barCol}>
              <div style={s.barValue}>{avg ?? ""}</div>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, height: h, background: v && best && v.dow === best.dow ? INDIGO : C.paperAlt }} />
              </div>
              <div style={s.barLabel}>{names[order[i]]}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimeAttackStats({ ta }) {
  if (!ta || !ta.days.length) return null;
  const color = (n) => (n == null ? C.line : n >= 100 ? C.wine : n >= 70 ? C.wine : n > 0 ? C.ochre : C.brick);
  return (
    <Card title="⏱ 기록 타임어택" sub="안 쓴 날은 0점이에요">
      <div style={s.taRow}>
        <div style={s.taStat}>
          <div style={s.taNum}>{ta.avg ?? "–"}</div>
          <div style={s.taLabel}>평균 점수</div>
        </div>
        <div style={s.taStat}>
          <div style={s.taNum}>🔥 {ta.streak}</div>
          <div style={s.taLabel}>연속 기록</div>
        </div>
        <div style={s.taStat}>
          <div style={s.taNum}>{ta.onTime}</div>
          <div style={s.taLabel}>자정 전 기록</div>
        </div>
        <div style={s.taStat}>
          <div style={{ ...s.taNum, color: C.brick }}>{ta.zero}</div>
          <div style={s.taLabel}>0점</div>
        </div>
      </div>
      <div style={s.taBars}>
        {ta.days.map((d) => (
          <div key={d.date} style={s.taBarCol} title={`${d.date} ${d.score ?? "-"}`}>
            <div style={{ ...s.taBar, height: d.score == null ? 4 : Math.max(4, (d.score / 100) * 60), background: color(d.score), ...(d.pending ? { border: `1px dashed ${C.wine}`, background: "transparent" } : {}) }} />
          </div>
        ))}
      </div>
      <div style={s.taAxis}>
        <span>{fmtShort(ta.days[0].date)}</span>
        <span>{fmtShort(ta.days[ta.days.length - 1].date)}</span>
      </div>
    </Card>
  );
}

function AreaScores({ items }) {
  const valid = items.filter((i) => i.days > 0);
  if (!valid.length) return null;
  // 만족도 높은 날과 낮은 날의 기분 차이가 가장 큰 영역 = 기분을 가장 좌우하는 영역
  const gaps = valid.filter((i) => i.highMood != null && i.lowMood != null).map((i) => ({ ...i, gap: i.highMood - i.lowMood }));
  const key = gaps.length ? gaps.reduce((a, b) => (b.gap > a.gap ? b : a)) : null;
  return (
    <Card title="항목별 점수" sub={key && key.gap > 0 ? `요즘 기분을 가장 좌우하는 건 ${AREA_LABEL[key.area]}이에요` : "항목별 평균 점수 (5점)"}>
      {AREA_ORDER.map((a) => {
        const i = items.find((x) => x.area === a);
        if (!i || !i.days) return null;
        return (
          <div key={a} style={s.progRow}>
            <div style={s.progHead}>
              <span style={s.progName}>{AREA_LABEL[a]}</span>
              <span style={s.progNum}>
                평균 <b style={{ color: INDIGO }}>{i.avg}</b> · {i.days}일
              </span>
            </div>
            <div style={s.progTrack}>
              <div style={{ ...s.progFill, width: `${(i.avg / 5) * 100}%` }} />
            </div>
            {(i.highMood != null || i.lowMood != null) && (
              <div style={s.areaMoodNote}>
                점수 높은 날 기분 {i.highMood ?? "–"} · 낮은 날 기분 {i.lowMood ?? "–"}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function Plans({ plans }) {
  if (!plans || !plans.made) return null;
  return (
    <Card title="🎯 내일 딱 한 가지" sub={`다짐 ${plans.made}개 중 ${plans.checked}개 확인`}>
      {plans.rate != null ? (
        <>
          <div style={s.planRateRow}>
            <span style={s.planRate}>{plans.rate}%</span>
            <span style={s.planRateLabel}>
              실행률 ({plans.done}/{plans.checked})
            </span>
          </div>
          <div style={s.progTrack}>
            <div style={{ ...s.progFill, width: `${plans.rate}%` }} />
          </div>
          {(plans.moodDone != null || plans.moodNotDone != null) && (
            <div style={s.areaMoodNote}>
              다짐을 실행한 날 기분 {plans.moodDone ?? "–"} · 못한 날 기분 {plans.moodNotDone ?? "–"}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            {plans.recent.map((p) => (
              <div key={p.date} style={s.planItem}>
                <span>{p.done ? "✅" : "❌"}</span>
                <span style={s.planItemText}>{p.plan}</span>
                <span style={s.planItemDate}>{fmtShort(p.date)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={s.hint}>다음 날 "했어요/못했어요"를 체크하면 실행률이 나타나요.</div>
      )}
    </Card>
  );
}

function Checks({ routines }) {
  if (!routines.length) return null;
  return (
    <Card title="체크리스트 달성률" sub="자주 해낸 순서예요">
      {routines.map((r) => (
        <div key={r.name} style={s.progRow}>
          <div style={s.progHead}>
            <span style={s.progName}>{r.name}</span>
            <span style={s.progNum}>
              {r.done}/{r.total}일 · <b style={{ color: INDIGO }}>{r.rate}%</b>
            </span>
          </div>
          <div style={s.progTrack}>
            <div style={{ ...s.progFill, width: `${r.rate}%` }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function CheckMood({ items }) {
  if (!items.length) {
    return (
      <Card title="어떤 행동이 기분에 도움이 될까" sub="체크한 날 vs 안 한 날의 평균 기분">
        <div style={s.hint}>같은 항목을 한 날과 안 한 날이 각각 2일 이상 쌓이면 나타나요.</div>
      </Card>
    );
  }
  return (
    <Card title="어떤 행동이 기분에 도움이 될까" sub="체크한 날 vs 안 한 날의 평균 기분">
      {items.map((x) => {
        const color = x.diff > 0 ? INDIGO : x.diff < 0 ? C.brick : C.ink2;
        return (
          <div key={x.name} style={s.relRow}>
            <span style={{ ...s.relTag, flex: 1 }}>{x.name}</span>
            <span style={s.relVals}>
              한 날 {x.yesAvg} · 안 한 날 {x.noAvg}
            </span>
            <span style={{ ...s.relDiff, color, minWidth: 36, textAlign: "right" }}>{x.diff > 0 ? `+${x.diff}` : x.diff}</span>
          </div>
        );
      })}
    </Card>
  );
}

function Friends({ friends }) {
  if (!friends || !friends.meetings) return null;
  return (
    <Card title="🤝 친구" sub={`이 기간에 ${friends.meetings}번 만났어요`}>
      {friends.who.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={s.areaLabel}>자주 만난 사람</div>
          <div style={s.chipWrap}>
            {friends.who.map((x) => (
              <span key={x.name} style={s.tagChip}>
                {x.name} <b style={{ marginLeft: 3 }}>{x.count}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      {friends.where.length > 0 && (
        <div>
          <div style={s.areaLabel}>자주 간 곳</div>
          <div style={s.chipWrap}>
            {friends.where.map((x) => (
              <span key={x.name} style={s.tagChip}>
                {x.name} <b style={{ marginLeft: 3 }}>{x.count}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Tags({ tagsByArea }) {
  const has = AREA_ORDER.some((a) => (tagsByArea[a] || []).length);
  if (!has) return null;
  return (
    <Card title="자주 쓴 태그">
      {AREA_ORDER.map((a) =>
        (tagsByArea[a] || []).length ? (
          <div key={a} style={{ marginBottom: 10 }}>
            <div style={s.areaLabel}>{AREA_LABEL[a]}</div>
            <div style={s.chipWrap}>
              {tagsByArea[a].map((t) => (
                <span key={t.tag} style={s.tagChip}>
                  #{t.tag} <b style={{ marginLeft: 3 }}>{t.count}</b>
                </span>
              ))}
            </div>
          </div>
        ) : null
      )}
    </Card>
  );
}

function TagMood({ tagMood }) {
  if (!tagMood.length) return null;
  return (
    <Card title="태그와 기분의 관계" sub="그 태그가 있던 날 vs 없던 날의 평균 기분">
      {tagMood.map((t) => {
        const diff = Math.round((t.withAvg - t.withoutAvg) * 10) / 10;
        const color = diff > 0 ? INDIGO : diff < 0 ? C.brick : C.ink2;
        return (
          <div key={t.tag} style={s.relRow}>
            <span style={s.relTag}>#{t.tag}</span>
            <span style={s.relVals}>
              있던 날 {t.withAvg} · 없던 날 {t.withoutAvg}
            </span>
            <span style={{ ...s.relDiff, color }}>
              {diff > 0 ? `+${diff}` : diff}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

function Reflections({ items }) {
  const [type, setType] = useState("improve");
  const [area, setArea] = useState("all");
  const list = items.filter((r) => r.type === type && (area === "all" || r.area === area));
  if (!items.length) return null;
  return (
    <Card title="느낀 점 · 보완할 점 모아보기">
      <div style={s.filterRow}>
        {[
          { k: "good", l: "느낀 점" },
          { k: "improve", l: "보완할 점" },
        ].map((o) => (
          <button key={o.k} onClick={() => setType(o.k)} style={{ ...s.filterBtn, ...(type === o.k ? (o.k === "good" ? s.filterGoodOn : s.filterImproveOn) : {}) }}>
            {o.l}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {["all", ...AREA_ORDER].map((a) => (
          <button key={a} onClick={() => setArea(a)} style={{ ...s.areaBtn, ...(area === a ? s.areaBtnOn : {}) }}>
            {a === "all" ? "전체" : AREA_LABEL[a]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div style={s.hint}>해당하는 기록이 없어요.</div>
      ) : (
        list.slice(0, 30).map((r, i) => (
          <div key={i} style={s.refRow}>
            <div style={s.refMeta}>
              {fmtFull(r.date)} · {AREA_LABEL[r.area]}
            </div>
            <div style={s.refText}>{r.text}</div>
          </div>
        ))
      )}
    </Card>
  );
}

const s = {
  body: { flex: 1, padding: "0 20px 60px" },
  periodRow: { display: "flex", gap: 18, marginBottom: 8, borderBottom: `1px solid ${C.line}`, padding: "0 0 12px" },
  periodBtn: { border: "none", background: "transparent", color: C.ink2, fontSize: 13, fontWeight: 500, padding: 0, fontFamily: F.sans },
  periodBtnOn: { color: C.wine, fontWeight: 600 },
  center: { display: "flex", justifyContent: "center", padding: "60px 0" },
  empty: { textAlign: "center", color: C.ink2, fontSize: 13.5, padding: "60px 20px", lineHeight: 1.6 },
  card: { ...shared.section },
  cardTitle: { fontSize: 15, fontWeight: 600, color: C.ink, fontFamily: F.serif },
  cardSub: { fontSize: 12, color: C.ink2, marginTop: 3, marginBottom: 10 },
  hint: { fontSize: 12.5, color: C.ink2, padding: "8px 0" },
  summaryRow: { display: "flex", padding: "16px 0", borderTop: `1px solid ${C.line}` },
  summaryBox: { flex: 1, textAlign: "center", borderLeft: `1px solid ${C.line}` },
  summaryNum: { fontSize: 19, fontWeight: 700, color: C.wine, fontFamily: F.serif },
  summaryLabel: { fontSize: 11, color: C.ink2, fontWeight: 500, marginTop: 3 },
  barRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 6, marginTop: 10 },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  barValue: { fontSize: 10.5, color: C.ink2, fontWeight: 500, height: 14 },
  barTrack: { width: "100%", maxWidth: 24, height: 90, background: C.paperAlt, display: "flex", alignItems: "flex-end", overflow: "hidden" },
  barFill: { width: "100%" },
  barLabel: { fontSize: 11.5, color: C.ink2, fontWeight: 500 },
  progRow: { marginTop: 12 },
  progHead: { display: "flex", justifyContent: "space-between", marginBottom: 5 },
  progName: { fontSize: 13, fontWeight: 500, color: C.ink },
  progNum: { fontSize: 12, color: C.ink2 },
  progTrack: { height: 3, background: C.paperAlt, overflow: "hidden" },
  progFill: { height: "100%", background: C.wine },
  taRow: { display: "flex", padding: "16px 0", borderTop: `1px solid ${C.line}` },
  taStat: { flex: 1, textAlign: "center", borderLeft: `1px solid ${C.line}` },
  taNum: { fontSize: 17, fontWeight: 700, color: C.wine, fontFamily: F.serif },
  taLabel: { fontSize: 10.5, color: C.ink2, fontWeight: 500, marginTop: 3 },
  taBars: { display: "flex", alignItems: "flex-end", gap: 2, height: 60, marginTop: 14 },
  taBarCol: { flex: 1, display: "flex", alignItems: "flex-end", height: "100%" },
  taBar: { width: "100%", boxSizing: "border-box" },
  taAxis: { display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.ink2, marginTop: 5 },
  areaMoodNote: { fontSize: 11.5, color: C.ink2, marginTop: 4 },
  planRateRow: { display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0" },
  planRate: { fontSize: 24, fontWeight: 700, color: C.wine, fontFamily: F.serif },
  planRateLabel: { fontSize: 12, color: C.ink2, fontWeight: 500 },
  planItem: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 },
  planItemText: { flex: 1, color: C.ink },
  planItemDate: { fontSize: 11.5, color: C.ink2 },
  areaLabel: { fontSize: 11.5, fontWeight: 500, color: C.ink2, marginTop: 10 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagChip: { ...shared.chip },
  relRow: { display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${C.line}` },
  relTag: { fontSize: 13, fontWeight: 500, color: C.ink, minWidth: 60 },
  relVals: { flex: 1, fontSize: 12, color: C.ink2 },
  relDiff: { fontSize: 13.5, fontWeight: 600 },
  filterRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 8 },
  filterBtn: { ...shared.chip },
  filterGoodOn: { ...shared.chipOn },
  filterImproveOn: { background: C.ochreSoft, border: `1px solid ${C.ochre}55`, color: C.ochre },
  areaBtn: { border: "none", background: "transparent", color: C.ink2, fontSize: 12, fontWeight: 500, padding: "4px 4px", fontFamily: F.sans },
  areaBtnOn: { color: C.ink, textDecoration: "underline", textUnderlineOffset: 3 },
  refRow: { padding: "10px 0", borderBottom: `1px solid ${C.line}` },
  refMeta: { fontSize: 11.5, color: C.ink2, fontWeight: 500, marginBottom: 3 },
  refText: { fontSize: 13.5, color: C.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" },
};
