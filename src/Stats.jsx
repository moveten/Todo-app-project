import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
        let url = "/api/stats";
        if (period > 0) {
          const d = new Date();
          d.setDate(d.getDate() - (period - 1));
          url += `?from=${toISO(d)}`;
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
          <Summary summary={data.summary} />
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

function Summary({ summary }) {
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
