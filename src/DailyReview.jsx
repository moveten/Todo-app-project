import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2, Plus, Hash, PenLine, BarChart3, Sparkles, FileText, X, Download } from "lucide-react";
import html2canvas from "html2canvas";
import Stats from "./Stats.jsx";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
};
export const fmtFull = (iso) => {
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const MOODS = [
  { emoji: "😊", label: "최고" },
  { emoji: "🙂", label: "좋음" },
  { emoji: "😐", label: "보통" },
  { emoji: "😞", label: "별로" },
  { emoji: "😣", label: "힘듦" },
];

export const AREAS = [
  { key: "family", label: "가족", hint: "오늘 가족과 있었던 일" },
  { key: "work", label: "업무", hint: "오늘 업무에서 있었던 일" },
  { key: "self", label: "나", hint: "오늘 나를 위해 한 일, 컨디션" },
];

const SUGGESTED_TAGS = {
  family: ["아이", "배우자", "부모님", "외식", "나들이", "병원"],
  work: ["회의", "보고서", "민원", "출장", "교육", "야근"],
  self: ["운동", "독서", "휴식", "공부", "취미", "친구"],
};


const emptyCat = () => ({ text: "", good: "", improve: "", tags: [] });
const emptyCats = () => ({ family: emptyCat(), work: emptyCat(), self: emptyCat() });
const emptyForm = () => ({ mood: "🙂", cats: emptyCats(), reflection: {}, routines: {}, advice: "" });

export default function DailyReview() {
  const [view, setView] = useState("record");
  return (
    <div style={styles.app}>
      <div style={styles.topBar}>
        <div style={styles.brandRow}>
          <span style={styles.brandName}>파워로그</span>
          <span style={styles.brandSub}>가족과 일, 하나의 기록</span>
        </div>
        <div style={styles.viewToggle}>
          <button style={{ ...styles.viewBtn, ...(view === "record" ? styles.viewBtnOn : {}) }} onClick={() => setView("record")}>
            <PenLine size={13} style={{ marginRight: 4 }} />
            기록
          </button>
          <button style={{ ...styles.viewBtn, ...(view === "stats" ? styles.viewBtnOn : {}) }} onClick={() => setView("stats")}>
            <BarChart3 size={13} style={{ marginRight: 4 }} />
            통계
          </button>
        </div>
      </div>
      {view === "record" ? <RecordView /> : <Stats />}
    </div>
  );
}

function RecordView() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [history, setHistory] = useState([]);
  const [showPage, setShowPage] = useState(false);
  const [toast, setToast] = useState("");

  const loadDay = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-records?date=${d}`);
      const row = await res.json();
      if (row && row.categories) {
        const c = row.categories;
        const pick = (k) => ({
          text: (c[k] && c[k].text) || "",
          good: (c[k] && c[k].good) || "",
          improve: (c[k] && c[k].improve) || "",
          tags: (c[k] && c[k].tags) || [],
        });
        setForm({
          mood: row.mood || "🙂",
          cats: { family: pick("family"), work: pick("work"), self: pick("self") },
          reflection: row.reflection || {},
          advice: row.advice || "",
          routines: row.routines || {},
        });
      } else {
        setForm(emptyForm());
      }
    } catch (e) {
      setForm(emptyForm());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-records");
      const rows = await res.json();
      if (Array.isArray(rows)) setHistory(rows.slice(0, 14));
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadDay(date);
  }, [date, loadDay]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, savedFlash]);

  const setCat = (key, patch) =>
    setForm((f) => ({ ...f, cats: { ...f.cats, [key]: { ...f.cats[key], ...patch } } }));

  const toggleTag = (key, tag) => {
    const tags = form.cats[key].tags;
    setCat(key, { tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] });
  };


  const save = async () => {
    setSaving(true);
    try {
      // 빈 글머리표(•)만 남은 칸은 빈 칸으로 정리
      const clean = (t) => (t && t.replace(/[•\s]/g, "") ? t.replace(/\n?•\s*$/, "").trim() : "");
      const categories = {};
      Object.entries(form.cats).forEach(([k, c]) => {
        categories[k] = { ...c, text: clean(c.text), good: clean(c.good), improve: clean(c.improve) };
      });
      const res = await fetch("/api/daily-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mood: form.mood, categories, reflection: form.reflection, routines: form.routines, advice: (form.advice || "").trim() }),
      });
      if (!res.ok) throw new Error("save failed");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (e) {
      window.alert("저장에 실패했어요. 인터넷 연결을 확인해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // 기록을 조언 요청문으로 묶어 복사하고 Claude 열기 (구독 안에서 쓰므로 추가 비용 없음)
  const askClaude = () => {
    const text = buildPrompt(date, form, history);
    save(); // 쓰던 내용도 같이 저장
    copyText(text).then((ok) =>
      showToast(ok ? "복사됐어요! Claude에 붙여넣기 하세요" : "복사에 실패했어요. 다시 눌러주세요")
    );
    window.open("https://claude.ai/new", "_blank");
  };

  const isToday = date === todayISO();

  return (
    <>
      <div style={styles.header}>
        <div style={styles.dateNavRow}>
          <button style={styles.navBtn} onClick={() => setDate(addDays(date, -1))} aria-label="이전 날">
            <ChevronLeft size={18} color="#5B6470" />
          </button>
          <div style={styles.dateWrap}>
            <div style={styles.dateBig}>{fmtFull(date)}</div>
            {!isToday && (
              <button style={styles.todayBtn} onClick={() => setDate(todayISO())}>
                오늘로
              </button>
            )}
          </div>
          <button style={styles.navBtn} onClick={() => setDate(addDays(date, 1))} aria-label="다음 날">
            <ChevronRight size={18} color="#5B6470" />
          </button>
        </div>
        <div style={styles.moodRow}>
          {MOODS.map((m) => (
            <button key={m.emoji} onClick={() => setForm((f) => ({ ...f, mood: m.emoji }))} style={styles.moodCol}>
              <span style={{ ...styles.moodBtn, ...(form.mood === m.emoji ? styles.moodBtnActive : {}) }}>{m.emoji}</span>
              <span style={{ ...styles.moodLabel, ...(form.mood === m.emoji ? { color: "#4F46E5" } : {}) }}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.body}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <Loader2 size={20} color="#4F46E5" />
          </div>
        ) : (
          <>
            {AREAS.map((a) => (
              <AreaCard
                key={a.key}
                area={a}
                value={form.cats[a.key]}
                suggestions={SUGGESTED_TAGS[a.key]}
                onChange={(patch) => setCat(a.key, patch)}
                onToggleTag={(t) => toggleTag(a.key, t)}
              />
            ))}

            <button style={styles.saveBtn} onClick={save} disabled={saving}>
              {savedFlash ? (
                <>
                  <Check size={15} style={{ marginRight: 6 }} /> 저장됨
                </>
              ) : saving ? (
                "저장 중..."
              ) : (
                "오늘 기록 저장"
              )}
            </button>

            <div style={styles.section}>
              <div style={styles.cardTitle}>Claude 조언</div>
              <button style={styles.claudeBtn} onClick={askClaude}>
                <Sparkles size={15} style={{ marginRight: 6 }} />
                ① 기록 복사하고 Claude 열기
              </button>
              <div style={styles.adviceHint}>
                Claude의 답변을 길게 눌러 복사한 뒤, 아래 칸에 붙여넣고 저장하세요.
              </div>
              <AutoTextarea
                value={form.advice}
                onChange={(v) => setForm((f) => ({ ...f, advice: v }))}
                placeholder="② 여기에 Claude 조언 붙여넣기"
                minRows={3}
                bullet={false}
              />
              <button style={styles.adviceSaveBtn} onClick={save} disabled={saving}>
                {savedFlash ? "저장됨" : saving ? "저장 중..." : "③ 조언까지 저장"}
              </button>
            </div>

            <button style={styles.pageBtn} onClick={() => setShowPage(true)}>
              <FileText size={15} style={{ marginRight: 6 }} />
              한 장으로 보기
            </button>

            {history.length > 0 && (
              <div>
                <div style={styles.historyLabel}>최근 기록</div>
                {history.map((row) => {
                  const d = String(row.date).slice(0, 10);
                  return (
                    <button key={d} style={{ ...styles.historyRow, ...(d === date ? styles.historyRowActive : {}) }} onClick={() => setDate(d)}>
                      <span style={styles.historyMood}>{row.mood || "🙂"}</span>
                      <span style={styles.historyDate}>{fmtFull(d)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {showPage && <OnePage date={date} form={form} onClose={() => setShowPage(false)} />}
      {toast && <div style={styles.toast}>{toast}</div>}
    </>
  );
}

// 내용 길이에 맞춰 높이가 자동으로 늘어나고, 줄바꿈하면 앞에 "• "가 자동으로 붙는 입력칸
const BULLET = "• ";
function AutoTextarea({ value, onChange, placeholder, minRows = 1, style, bullet = true }) {
  const ref = useRef(null);
  const caretRef = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    if (caretRef.current != null) {
      el.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  }, [value]);

  // 한글 입력(조합) 중에도 안정적으로 동작하도록, 키 입력이 아니라 바뀐 글자를 보고 처리
  const handleChange = (e) => {
    if (!bullet) {
      onChange(e.target.value);
      return;
    }
    let v = e.target.value;
    let pos = e.target.selectionStart;
    const prev = value || "";
    // 처음 글자를 쓰기 시작하면 첫 줄에도 • 붙이기
    if (!prev && v && !v.startsWith("•")) {
      v = BULLET + v;
      pos += BULLET.length;
    }
    // 방금 줄바꿈을 했으면 새 줄 앞에 • 붙이기
    if (v.length > prev.length && v[pos - 1] === "\n" && v.slice(pos, pos + 1) !== "•") {
      const lineStart = v.lastIndexOf("\n", pos - 2) + 1;
      const prevLine = v.slice(lineStart, pos - 1);
      if (prevLine.trim() === "•") {
        // 빈 • 줄에서 한 번 더 엔터 → 글머리표 없이 끝내기
        v = v.slice(0, lineStart) + v.slice(pos);
        pos = lineStart;
      } else {
        v = v.slice(0, pos) + BULLET + v.slice(pos);
        pos += BULLET.length;
      }
    }
    // 전부 지워서 •만 남으면 빈 칸으로
    if (v.trim() === "•") {
      v = "";
      pos = 0;
    }
    caretRef.current = pos;
    onChange(v);
  };

  return (
    <textarea
      ref={ref}
      rows={minRows}
      style={{ ...styles.autoInput, ...style }}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
}

function AreaCard({ area, value, suggestions, onChange, onToggleTag }) {
  const [showTags, setShowTags] = useState(false);
  const [custom, setCustom] = useState("");
  const allTags = [...suggestions, ...value.tags.filter((t) => !suggestions.includes(t))];
  const addCustom = () => {
    const v = custom.trim().replace(/^#/, "");
    if (v && !value.tags.includes(v)) onToggleTag(v);
    setCustom("");
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHead}>
        <div style={styles.cardTitle}>{area.label}</div>
        <button style={styles.tagToggle} onClick={() => setShowTags((v) => !v)}>
          <Hash size={12} style={{ marginRight: 2 }} />
          {showTags ? "태그 닫기" : "태그"}
        </button>
      </div>

      <AutoTextarea value={value.text} onChange={(v) => onChange({ text: v })} placeholder={area.hint} minRows={2} />

      <div style={styles.lineRow}>
        <span style={{ ...styles.lineBadge, ...styles.goodBadge }}>잘한 점</span>
        <AutoTextarea value={value.good} onChange={(v) => onChange({ good: v })} placeholder="잘 해낸 것" style={styles.lineInput} />
      </div>
      <div style={styles.lineRow}>
        <span style={{ ...styles.lineBadge, ...styles.improveBadge }}>보완할 점</span>
        <AutoTextarea value={value.improve} onChange={(v) => onChange({ improve: v })} placeholder="다음엔 이렇게" style={styles.lineInput} />
      </div>

      {value.tags.length > 0 && !showTags && (
        <div style={styles.chipWrap}>
          {value.tags.map((t) => (
            <span key={t} style={{ ...styles.tagChip, ...styles.tagChipOn }}>#{t}</span>
          ))}
        </div>
      )}
      {showTags && (
        <div style={styles.tagPanel}>
          <div style={styles.chipWrap}>
            {allTags.map((t) => (
              <button key={t} onClick={() => onToggleTag(t)} style={{ ...styles.tagChip, ...(value.tags.includes(t) ? styles.tagChipOn : {}) }}>
                #{t}
              </button>
            ))}
          </div>
          <div style={styles.addRow}>
            <input
              style={styles.addInput}
              placeholder="태그 직접 추가"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
              }}
            />
            <button style={styles.addBtn} onClick={addCustom} aria-label="태그 추가">
              <Plus size={15} color="#fff" />
            </button>
          </div>
          <button style={styles.tagDoneBtn} onClick={() => setShowTags(false)}>
            <Check size={14} style={{ marginRight: 4 }} />
            태그 선택 완료
          </button>
        </div>
      )}
    </div>
  );
}


const moodLabel = (emoji) => (MOODS.find((m) => m.emoji === emoji) || {}).label || "";
const clip = (t, n) => {
  const one = String(t || "").replace(/•\s*/g, "").replace(/\s*\n\s*/g, " / ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
};

function buildPrompt(date, form, history) {
  const lines = [];
  lines.push(`[파워로그] ${fmtFull(date)} 하루 기록이에요. 아래 기록을 보고 조언해주세요.`);
  lines.push("");
  lines.push(`기분: ${form.mood} (${moodLabel(form.mood)})`);
  AREAS.forEach((a) => {
    const c = form.cats[a.key];
    if (!(c.text || c.good || c.improve || c.tags.length)) return;
    lines.push("");
    lines.push(`■ ${a.label}`);
    if (c.text) lines.push(`있었던 일:\n${c.text}`);
    if (c.good) lines.push(`잘한 점:\n${c.good}`);
    if (c.improve) lines.push(`보완할 점:\n${c.improve}`);
    if (c.tags.length) lines.push(`태그: ${c.tags.map((t) => "#" + t).join(" ")}`);
  });
  const recent = (history || [])
    .filter((r) => String(r.date).slice(0, 10) < date)
    .slice(0, 6);
  if (recent.length) {
    lines.push("");
    lines.push("(참고: 최근 흐름)");
    recent.forEach((r) => {
      const imp = ["family", "work", "self"]
        .map((k) => r.categories && r.categories[k] && r.categories[k].improve)
        .filter(Boolean)
        .map((t) => clip(t, 40));
      lines.push(`- ${fmtFull(r.date)} 기분 ${r.mood || "-"}${imp.length ? ` | 보완할 점: ${imp.join(", ")}` : ""}`);
    });
  }
  lines.push("");
  lines.push("아래 5가지 관점으로 각각 2~3문장씩, 따뜻하지만 구체적으로 답해주세요.");
  lines.push("마크다운 기호(**, #, 표)는 쓰지 말고, 각 항목은 아래 이모지 제목으로 시작해주세요.");
  lines.push("👏 오늘의 칭찬: 잘한 점을 구체적으로 짚어서 칭찬");
  lines.push("🧠 마음 전문가: 정신건강의학 전문가의 관점에서 감정·스트레스·회복을 살피고 도움이 될 말");
  lines.push("💼 업무의 달인: 업무 기록을 보고 일하는 방식·우선순위에 대한 실전 팁");
  lines.push("✍️ 최고의 기록자: 기록을 더 쓸모 있게 남기는 요령");
  lines.push("🎯 내일 딱 한 가지: 내일 바로 실천할 작은 행동 하나");
  lines.push("진단은 하지 말고, 기록에 많이 힘든 내용이 있으면 해결책보다 공감을 먼저 하고 믿을 만한 사람이나 전문가와 이야기해보길 권해주세요.");
  return lines.join("\n");
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

// 마크다운 기호 정리
const cleanAdvice = (t) =>
  String(t || "")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .trim();

function Lines({ text }) {
  return String(text || "")
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => (
      <div key={i} style={page.line}>
        {l}
      </div>
    ));
}

// 하루를 한 장으로: 화면에 보여주고 이미지로 저장
function OnePage({ date, form, onClose }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const areas = AREAS.filter((a) => {
    const c = form.cats[a.key];
    return c.text || c.good || c.improve || c.tags.length;
  });
  const advice = cleanAdvice(form.advice);
  const adviceHead = /^(👏|🧠|💼|✍️|✍|🎯)/;

  const saveImage = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const el = ref.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#FFFFFF",
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const file = new File([blob], `파워로그_${date}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `파워로그 ${fmtFull(date)}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (e) {
      if (e && e.name !== "AbortError") window.alert("이미지 저장에 실패했어요. 화면 캡처로 저장해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={page.overlay}>
      <div style={page.toolbar}>
        <button style={page.toolBtn} onClick={onClose}>
          <X size={16} style={{ marginRight: 4 }} />
          닫기
        </button>
        <button style={{ ...page.toolBtn, ...page.toolBtnMain }} onClick={saveImage} disabled={busy}>
          <Download size={15} style={{ marginRight: 5 }} />
          {busy ? "만드는 중..." : "이미지로 저장"}
        </button>
      </div>
      <div style={page.scroll}>
        <div ref={ref} style={page.sheet}>
          <div style={page.brand}>파워로그 · 가족과 일, 하나의 기록</div>
          <div style={page.titleRow}>
            <div style={page.date}>{fmtFull(date)}</div>
            <div style={page.mood}>
              {form.mood} <span style={page.moodText}>{moodLabel(form.mood)}</span>
            </div>
          </div>

          {areas.length === 0 && <div style={page.empty}>아직 작성한 내용이 없어요.</div>}

          {areas.map((a) => {
            const c = form.cats[a.key];
            return (
              <div key={a.key} style={page.block}>
                <div style={page.blockTitle}>{a.label}</div>
                {c.text && <Lines text={c.text} />}
                {c.good && (
                  <div style={page.sub}>
                    <span style={{ ...page.badge, ...page.goodBadge }}>잘한 점</span>
                    <div style={{ flex: 1 }}>
                      <Lines text={c.good} />
                    </div>
                  </div>
                )}
                {c.improve && (
                  <div style={page.sub}>
                    <span style={{ ...page.badge, ...page.improveBadge }}>보완할 점</span>
                    <div style={{ flex: 1 }}>
                      <Lines text={c.improve} />
                    </div>
                  </div>
                )}
                {c.tags.length > 0 && <div style={page.tags}>{c.tags.map((t) => "#" + t).join("  ")}</div>}
              </div>
            );
          })}

          {advice && (
            <div style={page.adviceBox}>
              <div style={page.adviceTitle}>Claude 조언</div>
              {advice
                .split("\n")
                .filter((l) => l.trim())
                .map((l, i) => (
                  <div key={i} style={adviceHead.test(l.trim()) ? page.adviceHead : page.adviceLine}>
                    {l.trim()}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const page = {
  overlay: { position: "fixed", inset: 0, background: "#EEF0F4", zIndex: 80, display: "flex", flexDirection: "column" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px", background: "#fff", borderBottom: "1px solid #E5E9EC" },
  toolBtn: { display: "flex", alignItems: "center", border: "none", background: "#F0F2F4", color: "#5B6470", fontSize: 13.5, fontWeight: 700, padding: "8px 12px", borderRadius: 10 },
  toolBtnMain: { background: "#4F46E5", color: "#fff" },
  scroll: { flex: 1, overflowY: "auto", padding: "16px 14px 40px", WebkitOverflowScrolling: "touch" },
  sheet: { background: "#FFFFFF", borderRadius: 16, padding: "22px 20px 24px", maxWidth: 460, margin: "0 auto", boxShadow: "0 2px 10px rgba(15,23,42,0.08)", color: "#1F2937" },
  brand: { fontSize: 11.5, fontWeight: 800, color: "#4F46E5", letterSpacing: 0.3 },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingBottom: 14, borderBottom: "2px solid #1F2937" },
  date: { fontSize: 20, fontWeight: 800 },
  mood: { fontSize: 22 },
  moodText: { fontSize: 13, fontWeight: 700, color: "#5B6470" },
  empty: { fontSize: 13, color: "#9AA3AF", padding: "20px 0" },
  block: { padding: "14px 0", borderBottom: "1px solid #EEF1F3" },
  blockTitle: { fontSize: 15, fontWeight: 800, marginBottom: 6 },
  line: { fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" },
  sub: { display: "flex", gap: 8, marginTop: 6, alignItems: "flex-start" },
  badge: { flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "3px 7px", borderRadius: 6, marginTop: 2 },
  goodBadge: { background: "#EEF0FF", color: "#4F46E5" },
  improveBadge: { background: "#FDF3DC", color: "#B06A00" },
  tags: { fontSize: 12, color: "#4F46E5", fontWeight: 600, marginTop: 8 },
  adviceBox: { marginTop: 16, background: "#F7F7FF", borderRadius: 12, padding: "14px 14px 10px" },
  adviceTitle: { fontSize: 13, fontWeight: 800, color: "#4F46E5", marginBottom: 6 },
  adviceHead: { fontSize: 13.5, fontWeight: 800, lineHeight: 1.6, marginTop: 8 },
  adviceLine: { fontSize: 13.5, lineHeight: 1.6 },
};

export const styles = {
  app: { minHeight: "100vh", background: "#F7F8FA", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", color: "#1F2937" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", background: "#FFFFFF" },
  brandRow: { display: "flex", flexDirection: "column" },
  brandName: { fontSize: 16, fontWeight: 800, color: "#4F46E5", letterSpacing: 0.3 },
  brandSub: { fontSize: 11, color: "#9AA3AF", fontWeight: 600, marginTop: 1 },
  viewToggle: { display: "flex", background: "#F0F2F4", borderRadius: 10, padding: 3, gap: 2 },
  viewBtn: { display: "flex", alignItems: "center", border: "none", background: "transparent", color: "#8A93A0", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 8 },
  viewBtnOn: { background: "#FFFFFF", color: "#4F46E5", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" },
  header: { padding: "6px 20px 14px", background: "#FFFFFF", borderBottom: "1px solid #EBEEF0" },
  dateNavRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  navBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dateWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  dateBig: { fontSize: 18, fontWeight: 700, color: "#1F2937" },
  todayBtn: { background: "#EEF0FF", border: "none", borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 700, color: "#4F46E5" },
  moodRow: { display: "flex", justifyContent: "center", gap: 8, marginTop: 14 },
  moodCol: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 0 },
  moodBtn: { fontSize: 22, background: "#F0F2F4", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" },
  moodBtnActive: { background: "#EEF0FF", boxShadow: "0 0 0 2px #4F46E5 inset" },
  moodLabel: { fontSize: 11, color: "#9AA3AF", fontWeight: 600 },
  body: { flex: 1, padding: "14px 16px 60px" },
  loadingWrap: { display: "flex", justifyContent: "center", padding: "60px 0" },
  section: { background: "#FFFFFF", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 10 },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: "#1F2937" },
  autoInput: { width: "100%", boxSizing: "border-box", border: "1px solid #EEF1F3", borderRadius: 10, padding: "8px 10px", outline: "none", fontSize: 16, color: "#1F2937", background: "#FAFBFC", resize: "none", fontFamily: "inherit", lineHeight: 1.45, overflow: "hidden" },
  lineRow: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 6 },
  lineBadge: { flexShrink: 0, width: 62, textAlign: "center", fontSize: 11.5, fontWeight: 800, padding: "10px 0", borderRadius: 8 },
  goodBadge: { background: "#EEF0FF", color: "#4F46E5" },
  improveBadge: { background: "#FDF3DC", color: "#B06A00" },
  lineInput: { flex: 1, width: "auto", minWidth: 0 },
  iconBtn: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0 },
  iconBtnText: { fontSize: 12, color: "#8A93A0", fontWeight: 600 },
  tagToggle: { display: "inline-flex", alignItems: "center", background: "#F0F2F4", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#5B6470" },
  tagDoneBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 0", borderRadius: 10 },
  tagPanel: { marginTop: 8, paddingTop: 6, borderTop: "1px dashed #E5E9EC" },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChip: { border: "1px solid #E5E9EC", background: "#fff", color: "#8A93A0", fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 20 },
  tagChipOn: { background: "#EEF0FF", border: "1px solid #C7CCFF", color: "#4F46E5" },
  chipEditing: { display: "inline-flex", alignItems: "center", gap: 4, border: "1px dashed #D7DCE1", background: "#fff", color: "#5B6470", fontSize: 13.5, fontWeight: 600, padding: "7px 8px 7px 12px", borderRadius: 20 },
  chipRemove: { background: "#FBEAE7", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  addRow: { display: "flex", gap: 6, marginTop: 8 },
  addInput: { flex: 1, minWidth: 0, border: "1px solid #E5E9EC", borderRadius: 10, padding: "7px 10px", fontSize: 16, outline: "none", fontFamily: "inherit" },
  addBtn: { background: "#4F46E5", border: "none", borderRadius: 10, width: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  claudeBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#1F2937", color: "#fff", fontSize: 14, fontWeight: 700, padding: "11px 0", borderRadius: 10, marginTop: 8 },
  adviceHint: { fontSize: 12, color: "#8A93A0", margin: "8px 0", lineHeight: 1.5 },
  adviceSaveBtn: { width: "100%", border: "1px solid #C7CCFF", background: "#EEF0FF", color: "#4F46E5", fontSize: 13.5, fontWeight: 700, padding: "10px 0", borderRadius: 10, marginTop: 8 },
  pageBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E5E9EC", background: "#fff", color: "#1F2937", fontSize: 14, fontWeight: 700, padding: "12px 0", borderRadius: 12, marginBottom: 22 },
  toast: { position: "fixed", left: "50%", bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", transform: "translateX(-50%)", background: "rgba(31,41,55,0.92)", color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 20, zIndex: 90, whiteSpace: "nowrap" },
  saveBtn: { width: "100%", border: "none", background: "#4F46E5", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "13px 0", borderRadius: 12, marginTop: 6, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  historyLabel: { fontSize: 12.5, color: "#8A93A0", fontWeight: 700, marginBottom: 8 },
  historyRow: { width: "100%", display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "none", borderRadius: 10, padding: "9px 12px", marginBottom: 6, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
  historyRowActive: { boxShadow: "0 0 0 1.5px #4F46E5 inset" },
  historyMood: { fontSize: 15 },
  historyDate: { fontSize: 13, color: "#5B6470", fontWeight: 600, flex: 1, textAlign: "left" },
};
