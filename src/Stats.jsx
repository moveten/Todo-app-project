import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

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

const AREA_LABEL = { family: "가족", work: "업무", self: "나" };
const AREA_ORDER = ["family", "work", "self"];
const MOOD_EMOJI = { 5: "😊", 4: "🙂", 3: "😐", 2: "😞", 1: "😣" };
const moodEmoji = (avg) => (avg == null ? "–" : MOOD_EMOJI[Math.min(5, Math.max(1, Math.round(avg)))]);

const PERIODS = [
  { key: 7, label: "7일" },
  { key: 30, label: "30일" },
  { key: 90, label: "90일" },
  { key: 0, label: "전체" },
];

const INDIGO = "#4F46E5";

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
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#EEF1F3" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 4} fontSize="11" textAnchor="end">{MOOD_EMOJI[v]}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={INDIGO} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.score)} r="3.2" fill="#fff" stroke={INDIGO} strokeWidth="2" />
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="10.5" fill="#9AA3AF" textAnchor="middle">{fmtShort(points[i].date)}</text>
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
                <div style={{ ...s.barFill, height: h, background: v && best && v.dow === best.dow ? INDIGO : "#C7CCFF" }} />
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
  const color = (n) => (n == null ? "#E5E9EC" : n >= 100 ? INDIGO : n >= 70 ? "#A5ACF7" : n > 0 ? "#F2C46B" : "#F2B8AE");
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
          <div style={{ ...s.taNum, color: "#DC5B45" }}>{ta.zero}</div>
          <div style={s.taLabel}>0점</div>
        </div>
      </div>
      <div style={s.taBars}>
        {ta.days.map((d) => (
          <div key={d.date} style={s.taBarCol} title={`${d.date} ${d.score ?? "-"}`}>
            <div style={{ ...s.taBar, height: d.score == null ? 4 : Math.max(4, (d.score / 100) * 60), background: color(d.score), ...(d.pending ? { border: "1px dashed #A5ACF7", background: "transparent" } : {}) }} />
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
    <Card title="영역별 만족도" sub={key && key.gap > 0 ? `요즘 기분을 가장 좌우하는 건 ${AREA_LABEL[key.area]}이에요` : "영역별 평균 만족도 (5점)"}>
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
                만족도 높은 날 기분 {i.highMood ?? "–"} · 낮은 날 기분 {i.lowMood ?? "–"}
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
        const color = x.diff > 0 ? INDIGO : x.diff < 0 ? "#DC5B45" : "#8A93A0";
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
        const color = diff > 0 ? INDIGO : diff < 0 ? "#DC5B45" : "#8A93A0";
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
    <Card title="잘한 점 · 보완할 점 모아보기">
      <div style={s.filterRow}>
        {[
          { k: "good", l: "잘한 점" },
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
  body: { flex: 1, padding: "12px 16px 60px", borderTop: "1px solid #EBEEF0" },
  periodRow: { display: "flex", background: "#ECEEF1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 12 },
  periodBtn: { flex: 1, border: "none", background: "transparent", color: "#8A93A0", fontSize: 13, fontWeight: 700, padding: "8px 0", borderRadius: 8 },
  periodBtnOn: { background: "#fff", color: INDIGO, boxShadow: "0 1px 3px rgba(15,23,42,0.08)" },
  center: { display: "flex", justifyContent: "center", padding: "60px 0" },
  empty: { textAlign: "center", color: "#8A93A0", fontSize: 13.5, padding: "60px 20px", lineHeight: 1.6 },
  card: { background: "#fff", borderRadius: 14, padding: "14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 10 },
  cardTitle: { fontSize: 14.5, fontWeight: 800, color: "#1F2937" },
  cardSub: { fontSize: 12, color: "#8A93A0", marginTop: 2, marginBottom: 8 },
  hint: { fontSize: 12.5, color: "#9AA3AF", padding: "8px 0" },
  summaryRow: { display: "flex", gap: 8, marginBottom: 10 },
  summaryBox: { flex: 1, background: "#fff", borderRadius: 14, padding: "12px 6px", textAlign: "center", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" },
  summaryNum: { fontSize: 17, fontWeight: 800, color: INDIGO },
  summaryLabel: { fontSize: 11, color: "#8A93A0", fontWeight: 600, marginTop: 3 },
  barRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 6, marginTop: 8 },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  barValue: { fontSize: 10.5, color: "#5B6470", fontWeight: 700, height: 14 },
  barTrack: { width: "100%", maxWidth: 28, height: 90, background: "#F3F4F6", borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 11.5, color: "#8A93A0", fontWeight: 700 },
  progRow: { marginTop: 10 },
  progHead: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  progName: { fontSize: 13, fontWeight: 700, color: "#1F2937" },
  progNum: { fontSize: 12, color: "#8A93A0" },
  progTrack: { height: 8, background: "#F0F2F4", borderRadius: 6, overflow: "hidden" },
  progFill: { height: "100%", background: INDIGO, borderRadius: 6 },
  taRow: { display: "flex", gap: 6, marginTop: 8 },
  taStat: { flex: 1, textAlign: "center", background: "#F7F8FA", borderRadius: 10, padding: "8px 2px" },
  taNum: { fontSize: 17, fontWeight: 800, color: INDIGO },
  taLabel: { fontSize: 10.5, color: "#8A93A0", fontWeight: 700, marginTop: 2 },
  taBars: { display: "flex", alignItems: "flex-end", gap: 2, height: 64, marginTop: 12 },
  taBarCol: { flex: 1, display: "flex", alignItems: "flex-end", height: "100%" },
  taBar: { width: "100%", borderRadius: 3, boxSizing: "border-box" },
  taAxis: { display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#9AA3AF", marginTop: 4 },
  areaMoodNote: { fontSize: 11.5, color: "#8A93A0", marginTop: 4 },
  planRateRow: { display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0" },
  planRate: { fontSize: 24, fontWeight: 800, color: INDIGO },
  planRateLabel: { fontSize: 12, color: "#8A93A0", fontWeight: 600 },
  planItem: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 },
  planItemText: { flex: 1, color: "#1F2937" },
  planItemDate: { fontSize: 11.5, color: "#9AA3AF" },
  areaLabel: { fontSize: 12, fontWeight: 800, color: "#5B6470", marginTop: 8 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagChip: { background: "#EEF0FF", color: INDIGO, fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 20 },
  relRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #F3F4F6" },
  relTag: { fontSize: 13, fontWeight: 700, color: "#1F2937", minWidth: 60 },
  relVals: { flex: 1, fontSize: 12, color: "#8A93A0" },
  relDiff: { fontSize: 13.5, fontWeight: 800 },
  filterRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 6 },
  filterBtn: { border: "1px solid #E5E9EC", background: "#fff", color: "#8A93A0", fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 20 },
  filterGoodOn: { background: "#EEF0FF", border: "1px solid #C7CCFF", color: INDIGO },
  filterImproveOn: { background: "#FDF3DC", border: "1px solid #F3DDA6", color: "#B06A00" },
  areaBtn: { border: "none", background: "transparent", color: "#9AA3AF", fontSize: 12, fontWeight: 700, padding: "4px 4px" },
  areaBtnOn: { color: "#1F2937", textDecoration: "underline", textUnderlineOffset: 3 },
  refRow: { padding: "9px 0", borderBottom: "1px solid #F3F4F6" },
  refMeta: { fontSize: 11.5, color: "#9AA3AF", fontWeight: 600, marginBottom: 2 },
  refText: { fontSize: 13.5, color: "#1F2937", lineHeight: 1.5, whiteSpace: "pre-wrap" },
};
