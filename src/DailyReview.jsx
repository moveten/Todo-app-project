import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2, Plus, X, Settings2 } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const fmtFull = (iso) => {
  const d = new Date(iso + "T00:00:00");
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

const SUGGESTED_TAGS = {
  work: ["회의", "보고서", "민원", "출장", "교육", "야근"],
  family: ["아이", "배우자", "부모님", "외식", "나들이", "병원"],
  self: ["운동", "독서", "휴식", "공부", "취미", "친구"],
};

const DEFAULT_ROUTINES = ["운동", "독서", "일찍 자기", "물 충분히"];
const ROUTINES_KEY = "daily-review:routines";

const emptyCat = () => ({ text: "", good: "", improve: "", tags: [] });
const emptyCats = () => ({ work: emptyCat(), family: emptyCat(), self: emptyCat() });
const emptyForm = () => ({ mood: "🙂", cats: emptyCats(), good: "", improve: "", routines: {} });

export default function DailyReview() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState(emptyForm());
  const [routineList, setRoutineList] = useState(DEFAULT_ROUTINES);
  const [editRoutines, setEditRoutines] = useState(false);
  const [newRoutine, setNewRoutine] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [history, setHistory] = useState([]);

  // 루틴 목록(나만의 체크 항목) 서버에서 불러오기
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/backup?key=${encodeURIComponent(ROUTINES_KEY)}`);
        const row = await res.json();
        if (row && row.data) {
          const list = JSON.parse(row.data);
          if (Array.isArray(list) && list.length) setRoutineList(list);
        }
      } catch (e) {
        // 기본값 유지
      }
    })();
  }, []);

  const saveRoutineList = (list) => {
    setRoutineList(list);
    fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: ROUTINES_KEY, value: JSON.stringify(list) }),
    }).catch(() => {});
  };

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
          cats: { work: pick("work"), family: pick("family"), self: pick("self") },
          good: (row.reflection && row.reflection.good) || "",
          improve: (row.reflection && row.reflection.improve) || "",
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
    } catch (e) {
      // 무시
    }
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

  const toggleRoutine = (name) =>
    setForm((f) => ({ ...f, routines: { ...f.routines, [name]: !f.routines[name] } }));

  const save = async () => {
    setSaving(true);
    try {
      // 현재 루틴 목록에 있는 항목만 저장 (체크 안 한 것도 false로 기록 → 달성률 계산 가능)
      const routines = {};
      routineList.forEach((r) => (routines[r] = Boolean(form.routines[r])));
      const res = await fetch("/api/daily-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mood: form.mood,
          categories: form.cats,
          reflection: { good: form.good, improve: form.improve },
          routines,
        }),
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

  const isToday = date === todayISO();

  return (
    <div style={styles.app}>
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
            <button
              key={m.emoji}
              onClick={() => setForm((f) => ({ ...f, mood: m.emoji }))}
              style={styles.moodCol}
            >
              <span style={{ ...styles.moodBtn, ...(form.mood === m.emoji ? styles.moodBtnActive : {}) }}>
                {m.emoji}
              </span>
              <span style={{ ...styles.moodLabel, ...(form.mood === m.emoji ? { color: "#0D9488" } : {}) }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.body}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <Loader2 size={20} color="#0D9488" />
          </div>
        ) : (
          <>
            <CategorySection
              label="가족"
              placeholder="오늘 가족과 있었던 일"
              value={form.cats.family}
              suggestions={SUGGESTED_TAGS.family}
              onText={(v) => setCat("family", { text: v })}
              onToggleTag={(t) => toggleTag("family", t)}
            />
            <CategorySection
              label="업무"
              placeholder="오늘 업무에서 있었던 일"
              reflect
              onGood={(v) => setCat("work", { good: v })}
              onImprove={(v) => setCat("work", { improve: v })}
              value={form.cats.work}
              suggestions={SUGGESTED_TAGS.work}
              onText={(v) => setCat("work", { text: v })}
              onToggleTag={(t) => toggleTag("work", t)}
            />
            <CategorySection
              label="나"
              placeholder="오늘 나를 위해 한 일, 컨디션"
              value={form.cats.self}
              suggestions={SUGGESTED_TAGS.self}
              onText={(v) => setCat("self", { text: v })}
              onToggleTag={(t) => toggleTag("self", t)}
            />

            {/* 루틴 체크 */}
            <div style={styles.section}>
              <div style={styles.sectionHead}>
                <div style={styles.sectionLabel}>오늘의 루틴</div>
                <button style={styles.iconBtn} onClick={() => setEditRoutines((v) => !v)}>
                  <Settings2 size={14} color="#8A93A0" />
                  <span style={styles.iconBtnText}>{editRoutines ? "완료" : "편집"}</span>
                </button>
              </div>
              <div style={styles.chipWrap}>
                {routineList.map((r) =>
                  editRoutines ? (
                    <span key={r} style={styles.chipEditing}>
                      {r}
                      <button
                        style={styles.chipRemove}
                        onClick={() => saveRoutineList(routineList.filter((x) => x !== r))}
                        aria-label={`${r} 삭제`}
                      >
                        <X size={12} color="#DC5B45" />
                      </button>
                    </span>
                  ) : (
                    <button
                      key={r}
                      onClick={() => toggleRoutine(r)}
                      style={{ ...styles.routineChip, ...(form.routines[r] ? styles.routineChipOn : {}) }}
                    >
                      {form.routines[r] && <Check size={13} style={{ marginRight: 4 }} />}
                      {r}
                    </button>
                  )
                )}
              </div>
              {editRoutines && (
                <div style={styles.addRow}>
                  <input
                    style={styles.addInput}
                    placeholder="새 루틴 (예: 스트레칭)"
                    value={newRoutine}
                    onChange={(e) => setNewRoutine(e.target.value)}
                  />
                  <button
                    style={styles.addBtn}
                    onClick={() => {
                      const v = newRoutine.trim();
                      if (v && !routineList.includes(v)) saveRoutineList([...routineList, v]);
                      setNewRoutine("");
                    }}
                  >
                    <Plus size={15} color="#fff" />
                  </button>
                </div>
              )}
            </div>

            <TextSection
              label="오늘 하루 잘한 점"
              placeholder="업무 외에 스스로 잘했다고 느낀 점"
              value={form.good}
              onChange={(v) => setForm((f) => ({ ...f, good: v }))}
            />
            <TextSection
              label="오늘 하루 보완할 점"
              placeholder="다음엔 이렇게 해보면 좋겠다 싶은 점"
              value={form.improve}
              onChange={(v) => setForm((f) => ({ ...f, improve: v }))}
            />

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

            {history.length > 0 && (
              <div>
                <div style={styles.historyLabel}>최근 기록</div>
                {history.map((row) => {
                  const r = row.routines || {};
                  const total = Object.keys(r).length;
                  const done = Object.values(r).filter(Boolean).length;
                  return (
                    <button
                      key={row.date}
                      style={{ ...styles.historyRow, ...(row.date === date ? styles.historyRowActive : {}) }}
                      onClick={() => setDate(row.date)}
                    >
                      <span style={styles.historyMood}>{row.mood || "🙂"}</span>
                      <span style={styles.historyDate}>{fmtFull(row.date)}</span>
                      {total > 0 && (
                        <span style={styles.historyRoutine}>
                          루틴 {done}/{total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CategorySection({ label, placeholder, value, suggestions, onText, onToggleTag, reflect, onGood, onImprove }) {
  const [custom, setCustom] = useState("");
  // 추천 태그 + 내가 직접 추가한 태그를 함께 보여줌
  const allTags = [...suggestions, ...value.tags.filter((t) => !suggestions.includes(t))];
  const addCustom = () => {
    const v = custom.trim().replace(/^#/, "");
    if (v && !value.tags.includes(v)) onToggleTag(v);
    setCustom("");
  };
  return (
    <div style={styles.section}>
      <div style={styles.sectionLabel}>{label}</div>
      <textarea
        style={styles.textarea}
        rows={3}
        placeholder={placeholder}
        value={value.text}
        onChange={(e) => onText(e.target.value)}
      />
      {reflect && (
        <>
          <div style={styles.subLabelGood}>👍 잘한 일</div>
          <textarea
            style={styles.subTextarea}
            rows={2}
            placeholder="업무에서 잘 해낸 것"
            value={value.good}
            onChange={(e) => onGood(e.target.value)}
          />
          <div style={styles.subLabelImprove}>🔧 보완할 일</div>
          <textarea
            style={styles.subTextarea}
            rows={2}
            placeholder="다음엔 이렇게 해보면 좋겠다 싶은 것"
            value={value.improve}
            onChange={(e) => onImprove(e.target.value)}
          />
        </>
      )}
      <div style={styles.chipWrap}>
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => onToggleTag(t)}
            style={{ ...styles.tagChip, ...(value.tags.includes(t) ? styles.tagChipOn : {}) }}
          >
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
    </div>
  );
}

function TextSection({ label, placeholder, value, onChange }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionLabel}>{label}</div>
      <textarea
        style={styles.textarea}
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", background: "#F7F8FA", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", color: "#1F2937" },
  header: { padding: "20px 20px 14px", background: "#FFFFFF", borderBottom: "1px solid #EBEEF0" },
  dateNavRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  navBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dateWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  dateBig: { fontSize: 18, fontWeight: 700, color: "#1F2937" },
  todayBtn: { background: "#EAF6F4", border: "none", borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 700, color: "#0D9488" },
  moodRow: { display: "flex", justifyContent: "center", gap: 8, marginTop: 16 },
  moodCol: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 0 },
  moodBtn: { fontSize: 22, background: "#F0F2F4", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" },
  moodBtnActive: { background: "#EAF6F4", boxShadow: "0 0 0 2px #0D9488 inset" },
  moodLabel: { fontSize: 11, color: "#9AA3AF", fontWeight: 600 },
  body: { flex: 1, padding: "18px 16px 60px" },
  loadingWrap: { display: "flex", justifyContent: "center", padding: "60px 0" },
  section: { background: "#FFFFFF", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 10 },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: "#5B6470", marginBottom: 6 },
  iconBtn: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0 },
  iconBtnText: { fontSize: 12, color: "#8A93A0", fontWeight: 600 },
  textarea: { width: "100%", boxSizing: "border-box", border: "none", outline: "none", fontSize: 16, color: "#1F2937", background: "transparent", resize: "none", fontFamily: "inherit", lineHeight: 1.5 },
  subLabelGood: { fontSize: 12, fontWeight: 700, color: "#0D9488", marginTop: 8, marginBottom: 4 },
  subLabelImprove: { fontSize: 12, fontWeight: 700, color: "#C27C0E", marginTop: 8, marginBottom: 4 },
  subTextarea: { width: "100%", boxSizing: "border-box", border: "1px solid #EEF1F3", borderRadius: 10, padding: "8px 10px", outline: "none", fontSize: 16, color: "#1F2937", background: "#FAFBFC", resize: "none", fontFamily: "inherit", lineHeight: 1.5 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagChip: { border: "1px solid #E5E9EC", background: "#fff", color: "#8A93A0", fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 20 },
  tagChipOn: { background: "#EAF6F4", borderColor: "#BFE5DF", color: "#0D9488" },
  routineChip: { display: "inline-flex", alignItems: "center", border: "1px solid #E5E9EC", background: "#fff", color: "#5B6470", fontSize: 13.5, fontWeight: 600, padding: "8px 14px", borderRadius: 20 },
  routineChipOn: { background: "#0D9488", borderColor: "#0D9488", color: "#fff" },
  chipEditing: { display: "inline-flex", alignItems: "center", gap: 4, border: "1px dashed #D7DCE1", background: "#fff", color: "#5B6470", fontSize: 13.5, fontWeight: 600, padding: "7px 8px 7px 12px", borderRadius: 20 },
  chipRemove: { background: "#FBEAE7", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  addRow: { display: "flex", gap: 6, marginTop: 8 },
  addInput: { flex: 1, minWidth: 0, border: "1px solid #E5E9EC", borderRadius: 10, padding: "7px 10px", fontSize: 16, outline: "none", fontFamily: "inherit" },
  addBtn: { background: "#0D9488", border: "none", borderRadius: 10, width: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  saveBtn: { width: "100%", border: "none", background: "#0D9488", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "13px 0", borderRadius: 12, marginTop: 6, marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "center" },
  historyLabel: { fontSize: 12.5, color: "#8A93A0", fontWeight: 700, marginBottom: 8 },
  historyRow: { width: "100%", display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "none", borderRadius: 10, padding: "9px 12px", marginBottom: 6, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
  historyRowActive: { boxShadow: "0 0 0 1.5px #0D9488 inset" },
  historyMood: { fontSize: 15 },
  historyDate: { fontSize: 13, color: "#5B6470", fontWeight: 600, flex: 1, textAlign: "left" },
  historyRoutine: { fontSize: 11.5, color: "#0D9488", fontWeight: 700, background: "#EAF6F4", padding: "2px 8px", borderRadius: 10 },
};
