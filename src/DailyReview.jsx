import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";

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

const MOODS = ["😊", "🙂", "😐", "😞", "😣"];

const emptyForm = { mood: "🙂", work: "", family: "", self: "", good: "", improve: "" };

export default function DailyReview() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [history, setHistory] = useState([]);

  const loadDay = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-records?date=${d}`);
      const row = await res.json();
      if (row && row.categories) {
        setForm({
          mood: row.mood || "🙂",
          work: (row.categories.work && row.categories.work.text) || "",
          family: (row.categories.family && row.categories.family.text) || "",
          self: (row.categories.self && row.categories.self.text) || "",
          good: (row.reflection && row.reflection.good) || "",
          improve: (row.reflection && row.reflection.improve) || "",
        });
      } else {
        setForm(emptyForm);
      }
    } catch (e) {
      setForm(emptyForm);
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

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/daily-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mood: form.mood,
          categories: {
            work: { text: form.work },
            family: { text: form.family },
            self: { text: form.self },
          },
          reflection: { good: form.good, improve: form.improve },
        }),
      });
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
              key={m}
              onClick={() => setForm((f) => ({ ...f, mood: m }))}
              style={{
                ...styles.moodBtn,
                ...(form.mood === m ? styles.moodBtnActive : {}),
              }}
            >
              {m}
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
            <Section
              label="업무"
              placeholder="오늘 업무에서 있었던 일을 적어보세요"
              value={form.work}
              onChange={(v) => setForm((f) => ({ ...f, work: v }))}
            />
            <Section
              label="가족"
              placeholder="오늘 가족과 있었던 일을 적어보세요"
              value={form.family}
              onChange={(v) => setForm((f) => ({ ...f, family: v }))}
            />
            <Section
              label="나"
              placeholder="오늘 나를 위해 한 일이나 컨디션을 적어보세요"
              value={form.self}
              onChange={(v) => setForm((f) => ({ ...f, self: v }))}
            />
            <Section
              label="잘한 점"
              placeholder="오늘 스스로 잘했다고 느낀 점"
              value={form.good}
              onChange={(v) => setForm((f) => ({ ...f, good: v }))}
              rows={2}
            />
            <Section
              label="보완할 점"
              placeholder="다음엔 이렇게 해보면 좋겠다 싶은 점"
              value={form.improve}
              onChange={(v) => setForm((f) => ({ ...f, improve: v }))}
              rows={2}
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
              <div style={styles.historyWrap}>
                <div style={styles.historyLabel}>최근 기록</div>
                {history.map((row) => (
                  <button
                    key={row.date}
                    style={{
                      ...styles.historyRow,
                      ...(row.date === date ? styles.historyRowActive : {}),
                    }}
                    onClick={() => setDate(row.date)}
                  >
                    <span style={styles.historyMood}>{row.mood || "🙂"}</span>
                    <span style={styles.historyDate}>{fmtFull(row.date)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ label, placeholder, value, onChange, rows = 3 }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionLabel}>{label}</div>
      <textarea
        style={styles.textarea}
        rows={rows}
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
  moodRow: { display: "flex", justifyContent: "center", gap: 10, marginTop: 16 },
  moodBtn: { fontSize: 22, background: "#F0F2F4", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" },
  moodBtnActive: { background: "#EAF6F4", boxShadow: "0 0 0 2px #0D9488 inset" },
  body: { flex: 1, padding: "18px 16px 60px" },
  loadingWrap: { display: "flex", justifyContent: "center", padding: "60px 0" },
  section: { background: "#FFFFFF", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 10 },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: "#5B6470", marginBottom: 6 },
  textarea: { width: "100%", border: "none", outline: "none", fontSize: 14.5, color: "#1F2937", background: "transparent", resize: "none", fontFamily: "inherit", lineHeight: 1.5 },
  saveBtn: { width: "100%", border: "none", background: "#0D9488", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "13px 0", borderRadius: 12, marginTop: 6, marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "center" },
  historyWrap: { marginTop: 4 },
  historyLabel: { fontSize: 12.5, color: "#8A93A0", fontWeight: 700, marginBottom: 8 },
  historyRow: { width: "100%", display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "none", borderRadius: 10, padding: "9px 12px", marginBottom: 6, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
  historyRowActive: { boxShadow: "0 0 0 1.5px #0D9488 inset" },
  historyMood: { fontSize: 15 },
  historyDate: { fontSize: 13, color: "#5B6470", fontWeight: 600 },
};
