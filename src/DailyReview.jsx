import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2, Hash, PenLine, BarChart3, Sparkles, FileText, X, Download, Plus, ChevronDown } from "lucide-react";
import html2canvas from "html2canvas";
import Stats from "./Stats.jsx";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 하루 기준 시간: 새벽 4시 전까지는 전날로 봄 (밤늦게 쓰다가 자정을 넘겨도 그날 기록으로 유지)
const DAY_START_HOUR = 4;
const todayISO = () => {
  const d = new Date();
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return toISO(d);
};
const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
};
// ⏱ 기록 타임어택: 그날 처음 저장한 시각으로 점수 (한 번 받은 점수는 유지)
export function scoreFor(date, now = new Date()) {
  const logical = todayISO();
  if (date > logical) return null; // 미래
  if (date < logical) return 0; // 기한 지남
  const h = now.getHours();
  if (h < DAY_START_HOUR) return 30; // 자정 넘김
  if (h < 21) return 100;
  if (h === 21) return 90;
  if (h === 22) return 80;
  return 70; // 23시대
}
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
  { key: "self", label: "나", hint: "오늘 나에 대해 한 줄 (컨디션, 느낀 점 등)", simple: true },
];

const SUGGESTED_TAGS = {
  family: ["아이", "배우자", "부모님", "외식", "나들이", "병원"],
  work: ["회의", "보고서", "민원", "출장", "교육", "야근"],
  self: ["운동", "독서", "휴식", "공부", "취미", "친구"],
};

const ABOUT_KEY = "powerlog:about";
const CHECK_KEY = "powerlog:checklist";
// 체크리스트 묶음. 마음 항목은 불안·기분과의 관계를 통계로 보기 좋은 것들
const CHECK_GROUPS = [
  { key: "body", label: "운동", items: ["스쿼트", "푸시업", "암컬"] },
  { key: "grow", label: "성장", items: ["책읽기"] },
];
const DEFAULT_CHECKLIST = CHECK_GROUPS.flatMap((g) => g.items);
const CHECK_VERSION = 3;
const groupOf = (name) => (CHECK_GROUPS.find((g) => g.items.includes(name)) || { key: "etc", label: "내가 추가한 것" });
const DEFAULT_ABOUT = `성향: 걱정이 많고 불안이 심한 편이에요. 쉽게 주눅들고, 귀찮아하는 경향이 있어요.

살면서 도움이 됐던 원칙:
• 무시당할 각오 (침착맨): 무시당하거나 거절당할 수 있다는 걸 미리 각오하면 덜 움츠러든다
• 빨리 처리하되 부정적 피드백을 두려워 말라
• 남을 존중하기: 사람의 뇌는 남을 존중하는 것과 나를 존중하는 것을 잘 구분하지 못한다고 한다. 그래서 남을 미워할 때보다 존중하려고 할 때 기분이 좋아진다
• 부모에게는 딱 10년: 아이들이 10살이 넘으면 부모와 잘 얘기하려 하지 않으니, 아이가 먼저 다가오는 10살까지의 시간을 소중히 여기자`;

const emptyCat = () => ({ text: "", good: "", improve: "", tags: [], score: null });
const emptyCats = () => ({ family: emptyCat(), work: emptyCat(), self: emptyCat() });
const emptyForm = () => ({ mood: "🙂", cats: emptyCats(), reflection: {}, routines: {}, advice: "", plan: "" });

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

// 저장 전 임시 보관 (앱이 새로 열리거나 날짜가 넘어가도 쓰던 글이 사라지지 않게)
const draftKey = (d) => `powerlog:draft:${d}`;
const readDraft = (d) => {
  try {
    const v = window.localStorage.getItem(draftKey(d));
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
};
const writeDraft = (d, f) => {
  try {
    window.localStorage.setItem(draftKey(d), JSON.stringify(f));
  } catch (e) {}
};
const clearDraft = (d) => {
  try {
    window.localStorage.removeItem(draftKey(d));
  } catch (e) {}
};

const pickCat = (c, k) => ({
  text: (c && c[k] && c[k].text) || "",
  good: (c && c[k] && c[k].good) || "",
  improve: (c && c[k] && c[k].improve) || "",
  tags: (c && c[k] && c[k].tags) || [],
  score: (c && c[k] && c[k].score) || null,
});

function RecordView() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState(emptyForm());
  const [prevPlan, setPrevPlan] = useState(null); // 전날의 "내일 딱 한 가지"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [history, setHistory] = useState([]);
  const [showPage, setShowPage] = useState(false);
  const [toast, setToast] = useState("");
  const loadedRef = useRef(""); // 서버에서 불러온(=저장된) 상태
  const [scoreInfo, setScoreInfo] = useState(null); // { exists, score, at }

  const loadDay = useCallback(async (d) => {
    setLoading(true);
    try {
      const [res, prevRes] = await Promise.all([
        fetch(`/api/daily-records?date=${d}`),
        fetch(`/api/daily-records?date=${addDays(d, -1)}`),
      ]);
      const row = await res.json();
      const prev = await prevRes.json();
      let serverForm = emptyForm();
      setScoreInfo(row ? { exists: true, score: row.write_score, at: row.first_saved_at } : { exists: false, score: null, at: null });
      setPrevPlan(prev && prev.plan ? { date: prev.date, plan: prev.plan, done: prev.plan_done } : null);
      if (row && row.categories) {
        const c = row.categories;
        serverForm = {
          mood: row.mood || "🙂",
          cats: { family: pickCat(c, "family"), work: pickCat(c, "work"), self: pickCat(c, "self") },
          reflection: row.reflection || {},
          routines: row.routines || {},
          advice: row.advice || "",
          plan: row.plan || "",
        };
      }
      loadedRef.current = JSON.stringify(serverForm);
      const draft = readDraft(d);
      if (draft && JSON.stringify(draft) !== loadedRef.current) {
        setForm(draft);
        setToast("저장 안 된 내용을 불러왔어요");
        setTimeout(() => setToast(""), 3000);
      } else {
        clearDraft(d);
        setForm(serverForm);
      }
    } catch (e) {
      setForm(emptyForm());
      setPrevPlan(null);
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
    setMissing([]);
  }, [date, loadDay]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, savedFlash]);

  useEffect(() => {
    if (loading) return;
    if (JSON.stringify(form) !== loadedRef.current) writeDraft(date, form);
  }, [form, date, loading]);

  const setCat = (key, patch) => {
    if (patch.score) setMissing((m) => m.filter((k) => k !== key));
    setForm((f) => ({ ...f, cats: { ...f.cats, [key]: { ...f.cats[key], ...patch } } }));
  };

  const toggleTag = (key, tag) =>
    setForm((f) => {
      const tags = f.cats[key].tags;
      const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
      return { ...f, cats: { ...f.cats, [key]: { ...f.cats[key], tags: next } } };
    });

  const [missing, setMissing] = useState([]); // 만족도를 안 고른 영역
  const [about, setAbout] = useState(DEFAULT_ABOUT); // 조언에 항상 반영할 "나에 대해"
  const [aboutOpen, setAboutOpen] = useState(false);
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/backup?key=${encodeURIComponent(CHECK_KEY)}`);
        const row = await res.json();
        if (row && row.data) {
          const saved = JSON.parse(row.data);
          if (saved && saved.version >= CHECK_VERSION && Array.isArray(saved.items)) {
            setChecklist(saved.items);
          } else {
            // 예전 목록은 새 기본 목록(스쿼트·푸시업·암컬·책읽기)으로 교체
            setChecklist(DEFAULT_CHECKLIST);
            fetch("/api/backup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: CHECK_KEY, value: JSON.stringify({ version: CHECK_VERSION, items: DEFAULT_CHECKLIST }) }),
            }).catch(() => {});
          }
        }
      } catch (e) {}
    })();
  }, []);

  const saveChecklist = (list) => {
    setChecklist(list);
    fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: CHECK_KEY, value: JSON.stringify({ version: CHECK_VERSION, items: list }) }),
    }).catch(() => {});
  };

  const toggleCheck = (name) => setForm((f) => ({ ...f, routines: { ...f.routines, [name]: !f.routines[name] } }));
  const [aboutSaved, setAboutSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/backup?key=${encodeURIComponent(ABOUT_KEY)}`);
        const row = await res.json();
        if (row && typeof row.data === "string") setAbout(row.data);
      } catch (e) {}
    })();
  }, []);

  const saveAbout = async () => {
    try {
      await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: ABOUT_KEY, value: about }),
      });
      setAboutSaved(true);
      setTimeout(() => setAboutSaved(false), 1500);
    } catch (e) {
      window.alert("저장에 실패했어요. 인터넷 연결을 확인해주세요.");
    }
  };

  const checkScores = () => {
    const miss = AREAS.filter((a) => !form.cats[a.key].score).map((a) => a.key);
    setMissing(miss);
    if (miss.length) {
      const names = AREAS.filter((a) => miss.includes(a.key)).map((a) => a.label).join(", ");
      window.alert(`${names}의 만족도(1~5)를 골라야 저장할 수 있어요.`);
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!checkScores()) return false;
    setSaving(true);
    try {
      const clean = (t) => (t && t.replace(/[•\s]/g, "") ? t.replace(/\n?•\s*$/, "").trim() : "");
      const categories = {};
      Object.entries(form.cats).forEach(([k, c]) => {
        categories[k] = { ...c, text: clean(c.text), good: clean(c.good), improve: clean(c.improve) };
      });
      const res = await fetch("/api/daily-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mood: form.mood,
          categories,
          reflection: form.reflection,
          routines: Object.fromEntries(checklist.map((c) => [c, Boolean(form.routines[c])])),
          advice: (form.advice || "").trim(),
          plan: (form.plan || "").trim(),
          write_score: scoreFor(date),
          first_saved_at: hhmm(new Date()),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      try {
        const saved = await res.json();
        if (saved) {
          const first = !scoreInfo || scoreInfo.score == null;
          setScoreInfo({ exists: true, score: saved.write_score, at: saved.first_saved_at });
          if (first && saved.write_score != null) {
            setToast(`⏱ 오늘 기록 점수 ${saved.write_score}점!`);
            setTimeout(() => setToast(""), 3000);
          }
        }
      } catch (e) {}
      loadedRef.current = JSON.stringify(form);
      clearDraft(date);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
      return true;
    } catch (e) {
      window.alert("저장에 실패했어요. 인터넷 연결을 확인해주세요.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const checkPrevPlan = async (done) => {
    if (!prevPlan) return;
    const next = prevPlan.done === done ? null : done; // 같은 버튼 다시 누르면 취소
    setPrevPlan({ ...prevPlan, done: next });
    try {
      await fetch("/api/daily-records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: prevPlan.date, plan_done: next }),
      });
    } catch (e) {
      window.alert("저장에 실패했어요. 인터넷 연결을 확인해주세요.");
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const askClaude = () => {
    if (!checkScores()) return;
    const text = buildPrompt(date, form, history, about, checklist);
    save();
    copyText(text).then((ok) => showToast(ok ? "복사됐어요! Claude에 붙여넣기 하세요" : "복사에 실패했어요. 다시 눌러주세요"));
    window.open("https://claude.ai/new", "_blank");
  };

  // 조언을 붙여넣으면 🎯 항목을 "내일 딱 한 가지" 칸에 자동으로 채움
  const onAdvice = (v) =>
    setForm((f) => {
      const next = { ...f, advice: v };
      if (!f.plan) {
        const p = extractPlan(v);
        if (p) next.plan = p;
      }
      return next;
    });

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
            <TimeAttack date={date} info={scoreInfo} />

            {prevPlan && (
              <div style={styles.planCheck}>
                <div style={styles.planCheckLabel}>🎯 어제의 다짐, 해냈나요?</div>
                <div style={styles.planCheckText}>{prevPlan.plan}</div>
                <div style={styles.planCheckBtns}>
                  <button style={{ ...styles.planBtn, ...(prevPlan.done === true ? styles.planBtnYes : {}) }} onClick={() => checkPrevPlan(true)}>
                    ✅ 했어요
                  </button>
                  <button style={{ ...styles.planBtn, ...(prevPlan.done === false ? styles.planBtnNo : {}) }} onClick={() => checkPrevPlan(false)}>
                    ❌ 못했어요
                  </button>
                </div>
              </div>
            )}

            {AREAS.map((a) => (
              <AreaCard key={a.key} area={a} value={form.cats[a.key]} missing={missing.includes(a.key)} onChange={(patch) => setCat(a.key, patch)} />
            ))}

            <Checklist items={checklist} checked={form.routines} onToggle={toggleCheck} onSaveList={saveChecklist} />

            <TagPicker cats={form.cats} onToggle={toggleTag} />

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
                <Sparkles size={15} style={{ marginRight: 6 }} />① 기록 복사하고 Claude 열기
              </button>
              <div style={styles.adviceHint}>Claude의 답변을 길게 눌러 복사한 뒤, 아래 칸에 붙여넣고 저장하세요.</div>
              <button style={styles.aboutToggle} onClick={() => setAboutOpen((o) => !o)}>
                🙋 나에 대해 <span style={styles.aboutToggleSub}>· 조언할 때 항상 반영돼요</span>
                <ChevronDown size={15} style={{ marginLeft: "auto", transform: aboutOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {aboutOpen && (
                <div style={{ marginBottom: 10 }}>
                  <AutoTextarea value={about} onChange={setAbout} minRows={6} bullet={false} placeholder="내 성향, 도움이 됐던 조언이나 원칙" />
                  <button style={styles.adviceSaveBtn} onClick={saveAbout}>
                    {aboutSaved ? "저장됨" : "나에 대해 저장"}
                  </button>
                </div>
              )}
              <AutoTextarea value={form.advice} onChange={onAdvice} placeholder="② 여기에 Claude 조언 붙여넣기" minRows={3} bullet={false} />
              <div style={styles.planLabel}>🎯 내일 딱 한 가지</div>
              <AutoTextarea
                value={form.plan}
                onChange={(v) => setForm((f) => ({ ...f, plan: v }))}
                placeholder="조언을 붙여넣으면 자동으로 채워져요 (직접 써도 돼요)"
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
                      {row.plan_done === true && <span style={styles.historyBadge}>다짐 ✅</span>}
                      {row.write_score != null && <span style={{ ...styles.historyScore, ...scoreColor(row.write_score) }}>{row.write_score}점</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {showPage && <OnePage date={date} form={form} checklist={checklist} onClose={() => setShowPage(false)} />}
      {toast && <div style={styles.toast}>{toast}</div>}
    </>
  );
}

// ---------------------------------------------------------------------------
const scoreColor = (n) =>
  n >= 100 ? { background: "#4F46E5", color: "#fff" } : n >= 70 ? { background: "#EEF0FF", color: "#4F46E5" } : n > 0 ? { background: "#FDF3DC", color: "#B06A00" } : { background: "#FBEAE7", color: "#DC5B45" };

const fmtLeft = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

function TimeAttack({ date, info }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!info) return null;

  // 이미 점수를 받은 날
  if (info.score != null) {
    return (
      <div style={{ ...styles.taBox, ...styles.taDone }}>
        <span style={styles.taTrophy}>{info.score >= 100 ? "🏆" : info.score >= 70 ? "🥈" : info.score > 0 ? "😅" : "💤"}</span>
        <div style={{ flex: 1 }}>
          <div style={styles.taTitle}>기록 점수 {info.score}점</div>
          {info.at && <div style={styles.taSub}>{info.at}에 처음 저장</div>}
        </div>
      </div>
    );
  }

  const logical = todayISO();
  if (date > logical) return null;
  if (date < logical) {
    if (info.exists) return null; // 점수 기능 전의 예전 기록
    return (
      <div style={{ ...styles.taBox, ...styles.taZero }}>
        <span style={styles.taTrophy}>💤</span>
        <div style={{ flex: 1 }}>
          <div style={styles.taTitle}>이 날은 0점이에요</div>
          <div style={styles.taSub}>기한이 지나서 지금 써도 0점이에요. 그래도 기록은 남겨두면 좋아요.</div>
        </div>
      </div>
    );
  }

  // 오늘: 카운트다운
  const score = scoreFor(date, now);
  const h = now.getHours();
  const next = new Date(now);
  let label;
  if (h < DAY_START_HOUR) {
    next.setHours(DAY_START_HOUR, 0, 0, 0);
    label = "0점 되기까지";
  } else {
    const boundary = h < 21 ? 21 : h + 1; // 다음 감점 시각
    next.setHours(boundary, 0, 0, 0);
    label = boundary >= 24 ? "자정 마감까지" : `${boundary}시 감점까지`;
  }
  const left = next - now;
  const urgent = h >= 23 || h < DAY_START_HOUR;
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return (
    <div style={{ ...styles.taBox, ...(urgent ? styles.taUrgent : styles.taLive) }}>
      <span style={styles.taTrophy}>⏱</span>
      <div style={{ flex: 1 }}>
        <div style={styles.taTitle}>
          지금 저장하면 <b>{score}점</b>
        </div>
        <div style={styles.taSub}>
          {label} {fmtLeft(left)}
          {h >= DAY_START_HOUR && h < 21 && ` · 자정 마감 ${fmtLeft(midnight - now)}`}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 입력칸: 높이 자동 조절 + 줄바꿈 시 "• " 자동 추가
// 한글은 글자를 "조합"하는 동안 값을 건드리면 받침이 뒤로 밀리므로(준제 → 주ㄴ제),
// 조합 중에는 아무것도 바꾸지 않고, 조합이 끝난 뒤에만 글머리표를 처리함
const BULLET = "• ";

function applyBullets(prev, v, pos) {
  if (v.length > prev.length && v[pos - 1] === "\n" && v.slice(pos, pos + 1) !== "•") {
    const lineStart = v.lastIndexOf("\n", pos - 2) + 1;
    const prevLine = v.slice(lineStart, pos - 1);
    if (prevLine.trim() === "•") {
      v = v.slice(0, lineStart) + v.slice(pos);
      pos = lineStart;
    } else {
      v = v.slice(0, pos) + BULLET + v.slice(pos);
      pos += BULLET.length;
    }
  }
  return [v, pos];
}

function AutoTextarea({ value, onChange, placeholder, minRows = 1, style, bullet = true }) {
  const ref = useRef(null);
  const caretRef = useRef(null);
  const composingRef = useRef(false);
  const beforeRef = useRef(value || ""); // 조합 시작 전 값

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    if (caretRef.current != null && !composingRef.current) {
      el.setSelectionRange(caretRef.current, caretRef.current);
    }
    caretRef.current = null;
  }, [value]);

  const process = (prev, raw, pos) => {
    if (!bullet) return onChange(raw);
    // 전부 지웠으면 입력 중인 칸에 "• "를 다시 넣어둠 (다시 쓸 때도 글머리표가 붙도록)
    if (raw === "" || raw === "•") {
      caretRef.current = BULLET.length;
      return onChange(BULLET);
    }
    const [v, p] = applyBullets(prev, raw, pos);
    if (v !== raw) caretRef.current = p; // 우리가 글자를 바꿨을 때만 커서 위치 조정
    onChange(v);
  };

  return (
    <textarea
      ref={ref}
      rows={minRows}
      style={{ ...styles.autoInput, ...style }}
      placeholder={placeholder}
      value={value}
      onFocus={() => {
        // 칸을 누르면 첫 줄에 "• "를 미리 넣어둠 (글자 조합을 방해하지 않도록 입력 전에)
        if (bullet && !value) {
          caretRef.current = BULLET.length;
          onChange(BULLET);
        }
      }}
      onBlur={() => {
        // 아무것도 안 쓰고 나가면 빈 칸으로 되돌림
        if (bullet && value && !value.replace(/[•\s]/g, "")) onChange("");
      }}
      onCompositionStart={() => {
        composingRef.current = true;
        beforeRef.current = value || "";
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        process(beforeRef.current, e.target.value, e.target.selectionStart);
      }}
      onChange={(e) => {
        const composing = composingRef.current || (e.nativeEvent && e.nativeEvent.isComposing);
        if (composing) {
          onChange(e.target.value); // 조합 중: 그대로 반영만
          return;
        }
        process(value || "", e.target.value, e.target.selectionStart);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
function AreaCard({ area, value, onChange, missing }) {
  return (
    <div style={{ ...styles.section, ...(missing ? styles.sectionMissing : {}) }}>
      <div style={styles.sectionHead}>
        <div style={styles.cardTitle}>{area.label}</div>
        <div style={styles.scoreRow} aria-label={`${area.label} 만족도`}>
          <span style={{ ...styles.scoreLabel, ...(missing ? { color: "#DC5B45" } : {}) }}>{missing ? "만족도 선택!" : "만족도"}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ score: value.score === n ? null : n })}
              style={{ ...styles.scoreBtn, ...(value.score === n ? styles.scoreBtnOn : {}) }}
              aria-label={`${n}점`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <AutoTextarea value={value.text} onChange={(v) => onChange({ text: v })} placeholder={area.hint} minRows={area.simple ? 1 : 2} />
      {!area.simple && (
        <>
          <div style={styles.lineRow}>
            <span style={{ ...styles.lineBadge, ...styles.goodBadge }}>잘한 점</span>
            <AutoTextarea value={value.good} onChange={(v) => onChange({ good: v })} placeholder="잘 해낸 것" style={styles.lineInput} />
          </div>
          <div style={styles.lineRow}>
            <span style={{ ...styles.lineBadge, ...styles.improveBadge }}>보완할 점</span>
            <AutoTextarea value={value.improve} onChange={(v) => onChange({ improve: v })} placeholder="다음엔 이렇게" style={styles.lineInput} />
          </div>
        </>
      )}
      {value.tags.length > 0 && (
        <div style={styles.chipWrap}>
          {value.tags.map((t) => (
            <span key={t} style={styles.tagMini}>#{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// 체크리스트: 나에게 도움이 되는 작은 행동들. 탭 한 번으로 체크
function Checklist({ items, checked, onToggle, onSaveList }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const done = items.filter((i) => checked[i]).length;
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onSaveList([...items, v]);
    setDraft("");
  };
  return (
    <div style={styles.section}>
      <div style={styles.sectionHead}>
        <div style={styles.cardTitle}>
          오늘의 체크리스트 <span style={styles.checkCount}>{done}/{items.length}</span>
        </div>
        <button style={styles.editBtn} onClick={() => setEdit((e) => !e)}>
          {edit ? "완료" : "편집"}
        </button>
      </div>
      {edit
        ? items.map((it) => (
            <div key={it} style={styles.checkRow}>
              <span style={{ flex: 1, fontSize: 14.5 }}>{it}</span>
              <button style={styles.checkDel} onClick={() => onSaveList(items.filter((x) => x !== it))} aria-label={`${it} 삭제`}>
                <X size={14} color="#DC5B45" />
              </button>
            </div>
          ))
        : [...CHECK_GROUPS, { key: "etc", label: "내가 추가한 것" }].map((g) => {
            const list = items.filter((it) => groupOf(it).key === g.key);
            if (!list.length) return null;
            return (
              <div key={g.key} style={styles.checkGroup}>
                <div style={styles.checkGroupLabel}>{g.label}</div>
                <div style={styles.checkGrid}>
                  {list.map((it) => (
                    <button key={it} style={{ ...styles.checkTile, ...(checked[it] ? styles.checkTileOn : {}) }} onClick={() => onToggle(it)}>
                      <span style={{ ...styles.checkBox, ...(checked[it] ? styles.checkBoxOn : {}) }}>{checked[it] && <Check size={12} color="#fff" />}</span>
                      <span style={styles.checkTileText}>{it}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
      {edit && (
        <div style={styles.addRow}>
          <input style={styles.addInput} placeholder="새 항목 (예: 플랭크)" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button style={styles.addBtn} onClick={add} aria-label="항목 추가">
            <Plus size={15} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}

// 태그: 버튼 하나. 누르면 가족/업무/나 태그가 한 번에 펼쳐지고, 탭하면 바로 선택
function TagPicker({ cats, onToggle }) {
  const [open, setOpen] = useState(false);
  const count = AREAS.reduce((n, a) => n + cats[a.key].tags.length, 0);

  const addCustom = (key, label) => {
    const v = (window.prompt(`${label} 태그 추가`) || "").trim().replace(/^#/, "");
    if (v && !cats[key].tags.includes(v)) onToggle(key, v);
  };

  return (
    <div style={styles.section}>
      <button style={styles.tagMainBtn} onClick={() => setOpen((o) => !o)}>
        <Hash size={15} style={{ marginRight: 6 }} />
        태그 {count > 0 ? `${count}개 선택됨` : "달기"}
        <ChevronDown size={16} style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {AREAS.map((a) => {
            const selected = cats[a.key].tags;
            const all = [...SUGGESTED_TAGS[a.key], ...selected.filter((t) => !SUGGESTED_TAGS[a.key].includes(t))];
            return (
              <div key={a.key} style={styles.tagGroup}>
                <div style={styles.tagGroupLabel}>{a.label}</div>
                <div style={styles.chipWrap}>
                  {all.map((t) => (
                    <button key={t} onClick={() => onToggle(a.key, t)} style={{ ...styles.tagChip, ...(selected.includes(t) ? styles.tagChipOn : {}) }}>
                      #{t}
                    </button>
                  ))}
                  <button style={styles.tagAdd} onClick={() => addCustom(a.key, a.label)}>
                    <Plus size={12} style={{ marginRight: 2 }} />
                    직접
                  </button>
                </div>
              </div>
            );
          })}
          <button style={styles.tagDoneBtn} onClick={() => setOpen(false)}>
            <Check size={14} style={{ marginRight: 4 }} />
            완료
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
const moodLabel = (emoji) => (MOODS.find((m) => m.emoji === emoji) || {}).label || "";
const clip = (t, n) => {
  const one = String(t || "").replace(/•\s*/g, "").replace(/\s*\n\s*/g, " / ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
};

function extractPlan(advice) {
  const lines = String(advice || "").replace(/\*\*/g, "").split("\n").map((l) => l.trim());
  const i = lines.findIndex((l) => l.includes("🎯"));
  if (i < 0) return "";
  let t = lines[i].replace(/^.*?🎯\s*/, "").replace(/^내일\s*딱\s*한\s*가지\s*[:：]?\s*/, "").trim();
  if (!t) t = (lines.slice(i + 1).find((l) => l) || "").trim();
  return t;
}

function buildPrompt(date, form, history, about, checklist = []) {
  const lines = [];
  lines.push(`[파워로그] ${fmtFull(date)} 하루 기록이에요. 아래 기록을 보고 조언해주세요.`);
  lines.push("");
  lines.push(`기분: ${form.mood} (${moodLabel(form.mood)})`);
  AREAS.forEach((a) => {
    const c = form.cats[a.key];
    if (!(c.text || c.good || c.improve || c.tags.length || c.score)) return;
    lines.push("");
    lines.push(`■ ${a.label}${c.score ? ` (만족도 ${c.score}/5)` : ""}`);
    if (c.text) lines.push(`있었던 일:\n${c.text}`);
    if (c.good) lines.push(`잘한 점:\n${c.good}`);
    if (c.improve) lines.push(`보완할 점:\n${c.improve}`);
    if (c.tags.length) lines.push(`태그: ${c.tags.map((t) => "#" + t).join(" ")}`);
  });
  if (checklist.length) {
    lines.push("");
    lines.push(`체크리스트: ${checklist.map((c) => `${form.routines[c] ? "✅" : "⬜"} ${c}`).join(", ")}`);
  }
  const recent = (history || []).filter((r) => String(r.date).slice(0, 10) < date).slice(0, 6);
  if (recent.length) {
    lines.push("");
    lines.push("(참고: 최근 흐름)");
    recent.forEach((r) => {
      const imp = ["family", "work", "self"]
        .map((k) => r.categories && r.categories[k] && r.categories[k].improve)
        .filter(Boolean)
        .map((t) => clip(t, 40));
      const planInfo = r.plan ? ` | 다짐: ${clip(r.plan, 30)}${r.plan_done === true ? " (실행)" : r.plan_done === false ? " (못함)" : ""}` : "";
      lines.push(`- ${fmtFull(r.date)} 기분 ${r.mood || "-"}${imp.length ? ` | 보완할 점: ${imp.join(", ")}` : ""}${planInfo}`);
    });
  }
  if (about && about.trim()) {
    lines.push("");
    lines.push("(나에 대해: 조언할 때 꼭 반영해주세요)");
    lines.push(about.trim());
    lines.push("→ 내 성향을 이해하고, 위 원칙 중 오늘 기록과 맞닿는 것을 1~2개 골라 자연스럽게 연결해주세요. 매번 전부 나열하지는 말아주세요. 불안하거나 주눅든 부분이 보이면 다그치지 말고, 작게 시작할 수 있는 방향으로 말해주세요.");
  }
  lines.push("");
  lines.push("위 기록을 바탕으로 아래 형식 그대로 답해주세요. 마크다운 기호(**, #, 목록, 표)는 쓰지 말아주세요.");
  lines.push("");
  lines.push("💼 업무");
  lines.push("(한 문단, 6~8문장) 업무의 달인 관점에서 업무 기록을 상세히 분석해주세요. 잘한 점은 구체적으로 칭찬하고, 일하는 방식·우선순위·보완할 점의 원인과 개선법을 실전적으로 말해주세요.");
  lines.push("");
  lines.push("🧠 마음");
  lines.push("(한 문단, 6~8문장) 정신건강의학 전문가의 관점에서 오늘의 감정·불안·스트레스·에너지 상태를 상세히 분석해주세요. 가족·업무·나 만족도와 기분의 관계, 체크리스트(수면·심호흡 등), 최근 흐름의 패턴을 근거로 삼고, 잘 버틴 부분은 인정해주세요.");
  lines.push("");
  lines.push("🎯 내일 딱 한 가지: (두 분석을 종합한 결론, 내일 바로 실천할 작은 행동 한 문장)");
  lines.push("");
  lines.push("📜 오늘의 명언: \"명언\" — 말한 사람, 『출처(책·연설·편지 등 정확한 제목)』");
  lines.push("명언은 오늘 기록과 어울리는 것으로, 실제로 그 사람이 한 말이고 출처가 확인되는 것만 골라주세요. 흔히 잘못 알려진 명언이나 출처가 불분명한 말은 쓰지 말고, 확실하지 않으면 출처가 분명한 다른 명언을 골라주세요.");
  lines.push("");
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

function OnePage({ date, form, checklist = [], onClose }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const areas = AREAS.filter((a) => {
    const c = form.cats[a.key];
    return c.text || c.good || c.improve || c.tags.length || c.score;
  });
  const advice = cleanAdvice(form.advice);
  const adviceHead = /^(👏|🧠|💼|✍️|✍|🎯)/;
  const isQuote = (l) => l.trim().startsWith("📜");

  const saveImage = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const el = ref.current;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#FFFFFF", windowWidth: el.scrollWidth, windowHeight: el.scrollHeight });
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
                <div style={page.blockHead}>
                  <span style={page.blockTitle}>{a.label}</span>
                  {c.score && <span style={page.score}>{"●".repeat(c.score)}{"○".repeat(5 - c.score)}</span>}
                </div>
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
          {checklist.length > 0 && (
            <div style={page.block}>
              <div style={page.blockHead}>
                <span style={page.blockTitle}>체크리스트</span>
                <span style={page.score}>
                  {checklist.filter((c) => form.routines[c]).length}/{checklist.length}
                </span>
              </div>
              <div style={page.checkWrap}>
                {checklist.map((c) => (
                  <span key={c} style={{ ...page.checkItem, ...(form.routines[c] ? page.checkItemOn : {}) }}>
                    {form.routines[c] ? "✓ " : ""}
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {advice && (
            <div style={page.adviceBox}>
              <div style={page.adviceTitle}>Claude 조언</div>
              {advice
                .split("\n")
                .filter((l) => l.trim() && !(form.plan && l.includes("🎯")))
                .map((l, i) => (
                  <div key={i} style={isQuote(l) ? page.quote : adviceHead.test(l.trim()) ? page.adviceHead : page.adviceLine}>
                    {l.trim()}
                  </div>
                ))}
            </div>
          )}
          {form.plan && (
            <div style={page.planBox}>
              <span style={page.planTitle}>🎯 내일 딱 한 가지</span>
              <div style={page.planText}>{form.plan}</div>
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
  blockHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  blockTitle: { fontSize: 15, fontWeight: 800 },
  score: { fontSize: 11, color: "#4F46E5", letterSpacing: 2 },
  line: { fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" },
  sub: { display: "flex", gap: 8, marginTop: 6, alignItems: "flex-start" },
  badge: { flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "3px 7px", borderRadius: 6, marginTop: 2 },
  goodBadge: { background: "#EEF0FF", color: "#4F46E5" },
  improveBadge: { background: "#FDF3DC", color: "#B06A00" },
  tags: { fontSize: 12, color: "#4F46E5", fontWeight: 600, marginTop: 8 },
  checkWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  checkItem: { fontSize: 12.5, color: "#9AA3AF", border: "1px solid #EEF1F3", borderRadius: 14, padding: "3px 9px" },
  checkItemOn: { color: "#4F46E5", background: "#EEF0FF", border: "1px solid #C7CCFF", fontWeight: 700 },
  adviceBox: { marginTop: 16, background: "#F7F7FF", borderRadius: 12, padding: "14px 14px 10px" },
  adviceTitle: { fontSize: 13, fontWeight: 800, color: "#4F46E5", marginBottom: 6 },
  adviceHead: { fontSize: 13.5, fontWeight: 800, lineHeight: 1.6, marginTop: 8 },
  quote: { fontSize: 13.5, lineHeight: 1.6, marginTop: 12, padding: "10px 12px", background: "#fff", borderLeft: "3px solid #4F46E5", borderRadius: 6, fontStyle: "italic" },
  adviceLine: { fontSize: 13.5, lineHeight: 1.6 },
  planBox: { marginTop: 12, border: "1.5px solid #1F2937", borderRadius: 12, padding: "12px 14px" },
  planTitle: { fontSize: 12.5, fontWeight: 800 },
  planText: { fontSize: 14, fontWeight: 700, marginTop: 4, lineHeight: 1.5 },
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
  taBox: { display: "flex", alignItems: "center", gap: 10, borderRadius: 14, padding: "11px 14px", marginBottom: 10 },
  taLive: { background: "#EEF0FF", color: "#1F2937" },
  taUrgent: { background: "#DC5B45", color: "#fff" },
  taDone: { background: "#FFFFFF", color: "#1F2937", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" },
  taZero: { background: "#F3F4F6", color: "#5B6470" },
  taTrophy: { fontSize: 22 },
  taTitle: { fontSize: 14.5, fontWeight: 700 },
  taSub: { fontSize: 12, opacity: 0.8, marginTop: 2, fontVariantNumeric: "tabular-nums" },
  historyScore: { fontSize: 11.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10 },
  planCheck: { background: "#1F2937", color: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 10 },
  planCheckLabel: { fontSize: 12, fontWeight: 700, color: "#C7CCFF" },
  planCheckText: { fontSize: 14.5, fontWeight: 700, marginTop: 4, lineHeight: 1.45 },
  planCheckBtns: { display: "flex", gap: 8, marginTop: 10 },
  planBtn: { flex: 1, border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", fontSize: 13.5, fontWeight: 700, padding: "9px 0", borderRadius: 10 },
  planBtnYes: { background: "#4F46E5", border: "1px solid #4F46E5" },
  planBtnNo: { background: "#6B7280", border: "1px solid #6B7280" },
  section: { background: "#FFFFFF", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 10 },
  sectionMissing: { boxShadow: "0 0 0 1.5px #F2B8AE inset, 0 1px 3px rgba(15,23,42,0.06)" },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: "#1F2937" },
  scoreRow: { display: "flex", alignItems: "center", gap: 4 },
  scoreLabel: { fontSize: 11, color: "#9AA3AF", fontWeight: 700, marginRight: 2 },
  scoreBtn: { width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E9EC", background: "#fff", color: "#9AA3AF", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  scoreBtnOn: { background: "#4F46E5", border: "1px solid #4F46E5", color: "#fff" },
  autoInput: { width: "100%", boxSizing: "border-box", border: "1px solid #EEF1F3", borderRadius: 10, padding: "8px 10px", outline: "none", fontSize: 16, color: "#1F2937", background: "#FAFBFC", resize: "none", fontFamily: "inherit", lineHeight: 1.45, overflow: "hidden" },
  lineRow: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 6 },
  lineBadge: { flexShrink: 0, width: 62, textAlign: "center", fontSize: 11.5, fontWeight: 800, padding: "10px 0", borderRadius: 8 },
  goodBadge: { background: "#EEF0FF", color: "#4F46E5" },
  improveBadge: { background: "#FDF3DC", color: "#B06A00" },
  lineInput: { flex: 1, width: "auto", minWidth: 0 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagMini: { fontSize: 12, color: "#4F46E5", fontWeight: 600 },
  checkCount: { fontSize: 12.5, color: "#4F46E5", fontWeight: 800, marginLeft: 4 },
  editBtn: { border: "none", background: "#F0F2F4", color: "#5B6470", fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 14 },
  checkRow: { width: "100%", display: "flex", alignItems: "center", gap: 10, border: "none", background: "none", padding: "9px 2px", borderTop: "1px solid #F3F4F6", textAlign: "left" },
  checkBox: { width: 18, height: 18, borderRadius: 6, border: "2px solid #D7DCE1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkBoxOn: { background: "#4F46E5", border: "2px solid #4F46E5" },
  checkGroup: { marginTop: 8 },
  checkGroupLabel: { fontSize: 11.5, fontWeight: 800, color: "#9AA3AF", marginBottom: 5 },
  checkGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  checkTile: { display: "flex", alignItems: "center", gap: 7, border: "1px solid #EEF1F3", background: "#FAFBFC", borderRadius: 10, padding: "9px 8px", textAlign: "left", minWidth: 0 },
  checkTileOn: { border: "1px solid #C7CCFF", background: "#EEF0FF" },
  checkTileText: { fontSize: 13, color: "#1F2937", fontWeight: 600, lineHeight: 1.3, wordBreak: "keep-all" },
  checkText: { fontSize: 14.5, color: "#1F2937" },
  checkTextOn: { color: "#9AA3AF", textDecoration: "line-through" },
  checkDel: { background: "#FBEAE7", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  tagMainBtn: { width: "100%", display: "flex", alignItems: "center", border: "none", background: "none", padding: "4px 0", fontSize: 14.5, fontWeight: 800, color: "#1F2937" },
  tagGroup: { paddingTop: 10, marginTop: 6, borderTop: "1px solid #F1F3F5" },
  tagGroupLabel: { fontSize: 12, fontWeight: 800, color: "#5B6470" },
  tagChip: { border: "1px solid #E5E9EC", background: "#fff", color: "#8A93A0", fontSize: 13, fontWeight: 600, padding: "6px 11px", borderRadius: 20 },
  tagChipOn: { background: "#EEF0FF", border: "1px solid #C7CCFF", color: "#4F46E5" },
  tagAdd: { display: "inline-flex", alignItems: "center", border: "1px dashed #D7DCE1", background: "#fff", color: "#8A93A0", fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 20 },
  tagDoneBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13.5, fontWeight: 700, padding: "10px 0", borderRadius: 10 },
  saveBtn: { width: "100%", border: "none", background: "#4F46E5", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "13px 0", borderRadius: 12, marginTop: 6, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  claudeBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#1F2937", color: "#fff", fontSize: 14, fontWeight: 700, padding: "11px 0", borderRadius: 10, marginTop: 8 },
  adviceHint: { fontSize: 12, color: "#8A93A0", margin: "8px 0", lineHeight: 1.5 },
  aboutToggle: { width: "100%", display: "flex", alignItems: "center", border: "1px solid #EEF1F3", background: "#FAFBFC", borderRadius: 10, padding: "9px 10px", fontSize: 13, fontWeight: 800, color: "#1F2937", marginBottom: 8 },
  aboutToggleSub: { fontSize: 11.5, fontWeight: 600, color: "#9AA3AF", marginLeft: 4 },
  planLabel: { fontSize: 12.5, fontWeight: 800, color: "#1F2937", margin: "10px 0 4px" },
  adviceSaveBtn: { width: "100%", border: "1px solid #C7CCFF", background: "#EEF0FF", color: "#4F46E5", fontSize: 13.5, fontWeight: 700, padding: "10px 0", borderRadius: 10, marginTop: 8 },
  pageBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E5E9EC", background: "#fff", color: "#1F2937", fontSize: 14, fontWeight: 700, padding: "12px 0", borderRadius: 12, marginBottom: 22 },
  toast: { position: "fixed", left: "50%", bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", transform: "translateX(-50%)", background: "rgba(31,41,55,0.92)", color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 20, zIndex: 90, whiteSpace: "nowrap" },
  historyLabel: { fontSize: 12.5, color: "#8A93A0", fontWeight: 700, marginBottom: 8 },
  historyRow: { width: "100%", display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "none", borderRadius: 10, padding: "9px 12px", marginBottom: 6, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
  historyRowActive: { boxShadow: "0 0 0 1.5px #4F46E5 inset" },
  historyMood: { fontSize: 15 },
  historyDate: { fontSize: 13, color: "#5B6470", fontWeight: 600, flex: 1, textAlign: "left" },
  historyBadge: { fontSize: 11.5, color: "#4F46E5", fontWeight: 700, background: "#EEF0FF", padding: "2px 8px", borderRadius: 10 },
};
