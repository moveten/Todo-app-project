import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2, Hash, Sparkles, FileText, X, Download, Plus, ChevronDown } from "lucide-react";
import html2canvas from "html2canvas";
import Stats from "./Stats.jsx";
import Notes from "./Notes.jsx";
import { C, F, shared } from "./theme";

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

// 항목 종류별 프리셋: 어떤 칸을 보여줄지, 점수가 필요한지, 기본 태그
export const TYPES = {
  family: {
    label: "가족", emoji: "👨‍👩‍👧", score: true,
    fields: [
      { k: "did", label: "한 일", ph: "가족과 함께 한 일" },
      { k: "feel", label: "느낀 점", ph: "어떤 마음이 들었나요" },
    ],
    tags: ["아이", "배우자", "부모님", "외식", "나들이", "병원"],
  },
  work: {
    label: "업무", emoji: "💼", score: true,
    fields: [
      { k: "did", label: "한 일", ph: "오늘 처리한 일" },
      { k: "improve", label: "보완할 점", ph: "다음엔 이렇게" },
    ],
    tags: ["회의", "보고서", "민원", "출장", "교육", "야근"],
  },
  daily: {
    label: "일상", emoji: "☀️", score: true,
    fields: [
      { k: "did", label: "한 일", ph: "오늘 나를 위해 한 일" },
      { k: "feel", label: "느낀 점", ph: "컨디션, 느낀 점" },
    ],
    tags: ["운동", "독서", "휴식", "산책", "취미", "공부"],
  },
  friend: {
    label: "친구", emoji: "🤝", score: false,
    fields: [
      { k: "who", label: "누구랑", ph: "만난 사람", single: true },
      { k: "where", label: "어디서", ph: "장소", single: true },
      { k: "what", label: "뭐 했는지", ph: "함께 한 일, 나눈 이야기" },
    ],
    tags: ["밥", "카페", "술", "운동", "통화", "모임"],
  },
};
export const TYPE_ORDER = ["family", "work", "daily", "friend"];
const DEFAULT_TYPES = ["family", "work", "daily"]; // 새 날짜를 열면 기본으로 나오는 카드
const TAGS_KEY = "powerlog:tags";

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

let idSeq = 0;
const newId = () => `e${Date.now().toString(36)}${(idSeq++).toString(36)}`;
const newEntry = (type) => ({ id: newId(), type, score: null, fields: {}, tags: [] });
const emptyForm = () => ({ mood: "🙂", entries: DEFAULT_TYPES.map(newEntry), reflection: {}, routines: {}, advice: "", plan: "", memo: "" });

// 예전 구조(가족/업무/나 고정 칸)를 새 구조(항목 목록)로 변환
function legacyToEntries(c) {
  if (!c) return [];
  const map = [
    ["family", "family", (x) => ({ did: x.text, feel: x.good, improve: x.improve })],
    ["work", "work", (x) => ({ did: x.text, improve: x.improve, good: x.good })],
    ["self", "daily", (x) => ({ did: x.text, feel: x.good, improve: x.improve })],
  ];
  return map
    .filter(([k]) => c[k] && (c[k].text || c[k].good || c[k].improve || c[k].score || (c[k].tags || []).length))
    .map(([k, type, f]) => {
      const fields = Object.fromEntries(Object.entries(f(c[k])).filter(([, v]) => v));
      return { id: newId(), type, score: c[k].score || null, fields, tags: c[k].tags || [] };
    });
}
const normalizeForm = (f) => {
  if (!f) return emptyForm();
  const entries = Array.isArray(f.entries) ? f.entries : legacyToEntries(f.cats);
  return { ...emptyForm(), ...f, entries };
};

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
            기록
          </button>
          <button style={{ ...styles.viewBtn, ...(view === "stats" ? styles.viewBtnOn : {}) }} onClick={() => setView("stats")}>
            통계
          </button>
          <button style={{ ...styles.viewBtn, ...(view === "notes" ? styles.viewBtnOn : {}) }} onClick={() => setView("notes")}>
            메모
          </button>
        </div>
      </div>
      {view === "record" ? <RecordView /> : view === "stats" ? <Stats /> : <Notes />}
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

const _unusedPickCat = (c, k) => ({
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
  const formRef = useRef(form);
  formRef.current = form;
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
      if (row) {
        const entries = Array.isArray(row.entries) && row.entries.length ? row.entries : legacyToEntries(row.categories);
        serverForm = {
          mood: row.mood || "🙂",
          entries,
          reflection: row.reflection || {},
          routines: row.routines || {},
          advice: row.advice || "",
          plan: row.plan || "",
          memo: row.memo || "",
        };
      }
      loadedRef.current = JSON.stringify(serverForm);
      const rawDraft = readDraft(d);
      const draft = rawDraft ? normalizeForm(rawDraft) : null;
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

  const updateEntry = (id, patch) => {
    if (patch.score) setMissing((m) => m.filter((k) => k !== id));
    setForm((f) => ({
      ...f,
      entries: f.entries.map((e) =>
        e.id === id ? { ...e, ...patch, fields: patch.fields ? { ...e.fields, ...patch.fields } : e.fields } : e
      ),
    }));
  };
  const toggleEntryTag = (id, tag) =>
    setForm((f) => ({
      ...f,
      entries: f.entries.map((e) =>
        e.id === id ? { ...e, tags: e.tags.includes(tag) ? e.tags.filter((t) => t !== tag) : [...e.tags, tag] } : e
      ),
    }));
  const addEntry = (type) => setForm((f) => ({ ...f, entries: [...f.entries, newEntry(type)] }));
  const removeEntry = (id) => {
    const e = form.entries.find((x) => x.id === id);
    const hasContent = e && (e.score || e.tags.length || Object.values(e.fields).some((v) => v && v.replace(/[•\s]/g, "")));
    if (hasContent && !window.confirm(`${TYPES[e.type] ? TYPES[e.type].label : "이"} 카드를 지울까요? 적은 내용도 함께 지워져요.`)) return;
    setForm((f) => ({ ...f, entries: f.entries.filter((x) => x.id !== id) }));
  };

  // 항목별 태그 목록 (자유롭게 추가·삭제, 서버에 저장)
  const [tagPresets, setTagPresets] = useState(() => Object.fromEntries(TYPE_ORDER.map((t) => [t, TYPES[t].tags])));
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/backup?key=${encodeURIComponent(TAGS_KEY)}`);
        const row = await res.json();
        if (row && row.data) {
          const saved = JSON.parse(row.data);
          if (saved && typeof saved === "object") setTagPresets((p) => ({ ...p, ...saved }));
        }
      } catch (e) {}
    })();
  }, []);
  const saveTagPresets = (type, list) => {
    setTagPresets((p) => {
      const next = { ...p, [type]: list };
      fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: TAGS_KEY, value: JSON.stringify(next) }),
      }).catch(() => {});
      return next;
    });
  };

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

  const checkScores = (f = form) => {
    const missEntries = f.entries.filter((e) => TYPES[e.type] && TYPES[e.type].score && !e.score);
    setMissing(missEntries.map((e) => e.id));
    if (missEntries.length) {
      const names = [...new Set(missEntries.map((e) => TYPES[e.type].label))].join(", ");
      window.alert(`${names}의 점수(1~5)를 골라야 저장할 수 있어요.`);
      return false;
    }
    return true;
  };

  const save = async (over) => {
    const form = over && over.entries ? over : formRef.current; // 방금 채운 내용으로 바로 저장할 수 있게
    if (!checkScores(form)) return false;
    setSaving(true);
    try {
      const clean = (t) => (t && t.replace(/[•\s]/g, "") ? t.replace(/\n?•\s*$/, "").trim() : "");
      const entries = form.entries.map((e) => ({
        ...e,
        fields: Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, clean(v)]).filter(([, v]) => v)),
      }));
      const res = await fetch("/api/daily-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mood: form.mood,
          entries,
          reflection: form.reflection,
          routines: Object.fromEntries(checklist.map((c) => [c, Boolean(form.routines[c])])),
          advice: (form.advice || "").trim(),
          plan: (form.plan || "").trim(),
          memo: (form.memo || "").trim(),
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

  // 📌 핀보드: 아무렇게나 적은 메모를 Claude가 정리 → 붙여넣으면 카드에 자동으로 채우고 저장
  const organizeWithClaude = () => {
    if (!(form.memo || "").trim()) {
      window.alert("핀보드에 먼저 아무거나 적어주세요.");
      return;
    }
    const text = buildOrganizePrompt(date, form, about, checklist, tagPresets);
    copyText(text).then((ok) => showToast(ok ? "복사됐어요! Claude에 붙여넣기 하세요" : "복사에 실패했어요. 다시 눌러주세요"));
    window.open("https://claude.ai/new", "_blank");
  };

  const applyOrganized = async (raw) => {
    const parsed = parseOrganized(raw);
    if (!parsed) {
      window.alert("정리된 데이터를 찾지 못했어요. Claude의 마지막 답변(맨 아래 { } 데이터 포함)을 통째로 복사해서 붙여넣어 주세요.");
      return false;
    }
    const { data, adviceText } = parsed;
    const validMood = MOODS.map((m) => m.emoji);
    const moodFromNum = { 5: "😊", 4: "🙂", 3: "😐", 2: "😞", 1: "😣" };
    const mood = validMood.includes(data.mood) ? data.mood : moodFromNum[Number(data.mood)] || form.mood;
    const entries = (Array.isArray(data.entries) ? data.entries : [])
      .filter((e) => e && TYPES[e.type])
      .map((e) => {
        const t = TYPES[e.type];
        const fields = {};
        t.fields.forEach((f) => {
          let v = e.fields && e.fields[f.k];
          if (Array.isArray(v)) v = v.map((x) => `• ${String(x).replace(/^•\s*/, "")}`).join("\n");
          if (typeof v === "string" && v.trim()) {
            v = v.trim();
            if (!f.single) v = v.split("\n").map((l) => (l.trim().startsWith("•") ? l.trim() : `• ${l.trim()}`)).filter((l) => l !== "•").join("\n");
            fields[f.k] = v;
          }
        });
        const score = [1, 2, 3, 4, 5].includes(Number(e.score)) ? Number(e.score) : null;
        const tags = Array.isArray(e.tags) ? [...new Set(e.tags.map((x) => String(x).replace(/^#/, "").trim()).filter(Boolean))] : [];
        return { id: newId(), type: e.type, score: t.score ? score : null, fields, tags };
      });
    if (!entries.length) {
      window.alert("정리된 카드가 비어 있어요. Claude에게 다시 정리해달라고 해주세요.");
      return false;
    }
    const done = Array.isArray(data.checklist) ? data.checklist : [];
    const routines = { ...form.routines };
    checklist.forEach((c) => {
      if (done.includes(c)) routines[c] = true;
    });
    const next = {
      ...form,
      mood,
      entries,
      routines,
      advice: adviceText || form.advice,
      plan: (data.plan && String(data.plan).trim()) || extractPlan(adviceText) || form.plan,
    };
    setForm(next);
    const ok = await save(next);
    showToast(ok ? "📌 정리한 내용을 채우고 저장했어요" : "채웠어요. 빠진 점수를 고른 뒤 저장해주세요");
    return true;
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
            <ChevronLeft size={18} color={C.ink} />
          </button>
          <div style={styles.dateWrap}>
            <label style={styles.dateBig}>
              {fmtFull(date)} <ChevronDown size={14} color={C.ink2} style={{ verticalAlign: "middle" }} />
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                style={styles.dateInput}
                aria-label="날짜 선택"
              />
            </label>
            {!isToday && (
              <button style={styles.todayBtn} onClick={() => setDate(todayISO())}>
                오늘로
              </button>
            )}
          </div>
          <button style={styles.navBtn} onClick={() => setDate(addDays(date, 1))} aria-label="다음 날">
            <ChevronRight size={18} color={C.ink} />
          </button>
        </div>
        <div style={styles.moodRow}>
          {MOODS.map((m) => (
            <button key={m.emoji} onClick={() => setForm((f) => ({ ...f, mood: m.emoji }))} style={styles.moodCol}>
              <span style={{ ...styles.moodBtn, ...(form.mood === m.emoji ? styles.moodBtnActive : {}) }}>{m.emoji}</span>
              <span style={{ ...styles.moodLabel, ...(form.mood === m.emoji ? { color: C.wine } : {}) }}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.body}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <Loader2 size={20} color={C.wine} />
          </div>
        ) : (
          <>
            <TimeAttack date={date} info={scoreInfo} />

            <PinBoard
              memo={form.memo}
              onMemo={(v) => setForm((f) => ({ ...f, memo: v }))}
              onOrganize={organizeWithClaude}
              onApply={applyOrganized}
            />

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

            {form.entries.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                missing={missing.includes(e.id)}
                presets={tagPresets[e.type] || []}
                onChange={(patch) => updateEntry(e.id, patch)}
                onToggleTag={(t) => toggleEntryTag(e.id, t)}
                onSavePresets={(list) => saveTagPresets(e.type, list)}
                onRemove={() => removeEntry(e.id)}
              />
            ))}

            <div style={styles.addTypeRow}>
              {TYPE_ORDER.map((t) => (
                <button key={t} style={styles.addTypeBtn} onClick={() => addEntry(t)}>
                  <Plus size={13} style={{ marginRight: 2 }} />
                  {TYPES[t].emoji} {TYPES[t].label}
                </button>
              ))}
            </div>

            <Checklist items={checklist} checked={form.routines} onToggle={toggleCheck} onSaveList={saveChecklist} />


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
  n >= 100 ? { background: C.wine, color: C.paper } : n >= 70 ? { background: C.wineSoft, color: C.wine } : n > 0 ? { background: C.ochreSoft, color: C.ochre } : { background: C.brickSoft, color: C.brick };

const fmtLeft = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

function ScoreDot({ score, pulse }) {
  const color = score >= 100 ? C.wine : score >= 70 ? C.wine : score > 0 ? C.ochre : C.brick;
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, opacity: pulse ? 0.9 : 0.6 }} />;
}

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
        <ScoreDot score={info.score} />
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
        <ScoreDot score={0} />
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
      <ScoreDot score={score} pulse />
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
                <X size={14} color={C.brick} />
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
                      <span style={{ ...styles.checkBox, ...(checked[it] ? styles.checkBoxOn : {}) }}>{checked[it] && <Check size={11} color={C.paper} />}</span>
                      <span style={{ ...styles.checkTileText, ...(checked[it] ? styles.checkTextOn : {}) }}>{it}</span>
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
            <Plus size={15} color={C.paper} />
          </button>
        </div>
      )}
    </div>
  );
}

// 📌 핀보드: 형식 없이 생각나는 대로 적는 곳
function PinBoard({ memo, onMemo, onOrganize, onApply }) {
  const [open, setOpen] = useState(!!memo);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ ...styles.section, ...styles.pinBox }}>
      <button style={styles.pinHead} onClick={() => setOpen((o) => !o)}>
        <span style={styles.cardTitle}>📌 핀보드</span>
        <span style={styles.pinSub}>아무렇게나 적으면 Claude가 정리해줘요</span>
        <ChevronDown size={16} style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <>
          <AutoTextarea
            value={memo}
            onChange={onMemo}
            minRows={4}
            bullet={false}
            placeholder={"예) 아침에 애들 늦잠 자서 정신없었음. 오전 회의 보고 잘함, 근데 예산표 또 미룸. 저녁에 민수랑 동네 국밥집. 스쿼트 함. 좀 불안했음..."}
          />
          <button style={styles.claudeBtn} onClick={onOrganize}>
            <Sparkles size={15} style={{ marginRight: 6 }} />① Claude로 정리 요청
          </button>
          <div style={styles.adviceHint}>
            Claude가 부족한 걸 물어보면 채팅에서 답해주세요. 마지막에 조언과 정리된 데이터를 주면, 그 답변을 통째로 복사해서 아래에 붙여넣으세요.
          </div>
          <AutoTextarea value={result} onChange={setResult} minRows={2} bullet={false} placeholder="② Claude의 마지막 답변 붙여넣기" />
          <button
            style={styles.adviceSaveBtn}
            disabled={busy || !result.trim()}
            onClick={async () => {
              setBusy(true);
              const ok = await onApply(result);
              setBusy(false);
              if (ok) setResult("");
            }}
          >
            {busy ? "채우는 중..." : "③ 앱에 채우고 저장"}
          </button>
        </>
      )}
    </div>
  );
}

// 항목 카드: 종류별 프리셋 칸 + 점수 + 태그(카드 안에서 바로 선택·추가·삭제)
function EntryCard({ entry, missing, presets, onChange, onToggleTag, onSavePresets, onRemove }) {
  const t = TYPES[entry.type] || { label: entry.type, emoji: "📝", score: false, fields: [{ k: "did", label: "내용" }] };
  const [tagOpen, setTagOpen] = useState(false);
  const [tagEdit, setTagEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const all = [...presets, ...entry.tags.filter((x) => !presets.includes(x))];
  const addTag = () => {
    const v = draft.trim().replace(/^#/, "");
    if (!v) return;
    if (!presets.includes(v)) onSavePresets([...presets, v]);
    if (!entry.tags.includes(v)) onToggleTag(v);
    setDraft("");
  };

  return (
    <div style={{ ...styles.section, ...(missing ? styles.sectionMissing : {}) }}>
      <div style={styles.sectionHead}>
        <div style={styles.cardTitle}>
          {t.emoji} {t.label}
        </div>
        <button style={styles.removeBtn} onClick={onRemove} aria-label={`${t.label} 카드 삭제`}>
          <X size={15} color={C.ink2} />
        </button>
      </div>

      {t.score && (
        <div style={styles.scoreLine}>
          <span style={{ ...styles.scoreLabel, ...(missing ? { color: C.brick } : {}) }}>{missing ? "점수 선택!" : "점수"}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ score: entry.score === n ? null : n })}
              style={{ ...styles.scoreBtn, ...(entry.score === n ? styles.scoreBtnOn : {}) }}
              aria-label={`${n}점`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {t.fields.map((f) => (
        <div key={f.k} style={styles.fieldBlock}>
          <div style={styles.fieldLabel}>{f.label}</div>
          <AutoTextarea
            value={entry.fields[f.k] || ""}
            onChange={(v) => onChange({ fields: { [f.k]: v } })}
            placeholder={f.ph}
            bullet={!f.single}
          />
        </div>
      ))}

      <div style={styles.tagBar}>
        {!tagOpen && entry.tags.map((x) => <span key={x} style={styles.tagMini}>#{x}</span>)}
        <button style={styles.tagToggle} onClick={() => { setTagOpen((o) => !o); setTagEdit(false); }}>
          <Hash size={12} style={{ marginRight: 2 }} />
          {tagOpen ? "닫기" : entry.tags.length ? "태그" : "태그 달기"}
        </button>
      </div>
      {tagOpen && (
        <div style={styles.tagPanel}>
          <div style={styles.chipWrap}>
            {all.map((x) =>
              tagEdit ? (
                <span key={x} style={styles.chipEditing}>
                  #{x}
                  <button
                    style={styles.chipRemove}
                    onClick={() => {
                      onSavePresets(presets.filter((p) => p !== x));
                      if (entry.tags.includes(x)) onToggleTag(x);
                    }}
                    aria-label={`${x} 태그 삭제`}
                  >
                    <X size={11} color={C.brick} />
                  </button>
                </span>
              ) : (
                <button key={x} onClick={() => onToggleTag(x)} style={{ ...styles.tagChip, ...(entry.tags.includes(x) ? styles.tagChipOn : {}) }}>
                  #{x}
                </button>
              )
            )}
          </div>
          <div style={styles.addRow}>
            <input
              style={styles.addInput}
              placeholder="새 태그"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
            />
            <button style={styles.addBtn} onClick={addTag} aria-label="태그 추가">
              <Plus size={15} color={C.paper} />
            </button>
          </div>
          <div style={styles.tagPanelFoot}>
            <button style={styles.linkBtn} onClick={() => setTagEdit((v) => !v)}>
              {tagEdit ? "삭제 끝내기" : "태그 목록에서 지우기"}
            </button>
            <button style={styles.tagDoneSmall} onClick={() => setTagOpen(false)}>
              <Check size={13} style={{ marginRight: 3 }} />
              완료
            </button>
          </div>
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
  form.entries.forEach((e) => {
    const t = TYPES[e.type];
    if (!t) return;
    const filled = t.fields.filter((f) => e.fields[f.k]);
    if (!filled.length && !e.score && !e.tags.length) return;
    lines.push("");
    lines.push(`■ ${t.label}${e.score ? ` (점수 ${e.score}/5)` : ""}`);
    filled.forEach((f) => lines.push(`${f.label}:${f.single ? " " : "\n"}${e.fields[f.k]}`));
    if (e.tags.length) lines.push(`태그: ${e.tags.map((x) => "#" + x).join(" ")}`);
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
      const es = Array.isArray(r.entries) && r.entries.length ? r.entries : legacyToEntries(r.categories);
      const imp = es.map((e) => e.fields && e.fields.improve).filter(Boolean).map((t) => clip(t, 40));
      const planInfo = r.plan ? ` | 다짐: ${clip(r.plan, 30)}${r.plan_done === true ? " (실행)" : r.plan_done === false ? " (못함)" : ""}` : "";
      lines.push(`- ${fmtFull(r.date)} 기분 ${r.mood || "-"}${imp.length ? ` | 보완할 점: ${imp.join(", ")}` : ""}${planInfo}`);
    });
  }
  adviceInstructions(lines, about);
  return lines.join("\n");
}

// 조언 형식 (조언받기·핀보드 정리에서 함께 사용)
function adviceInstructions(lines, about, intro) {
  if (about && about.trim()) {
    lines.push("");
    lines.push("(나에 대해: 조언할 때 꼭 반영해주세요)");
    lines.push(about.trim());
    lines.push("→ 내 성향을 이해하고, 위 원칙 중 오늘 기록과 맞닿는 것을 1~2개 골라 자연스럽게 연결해주세요. 매번 전부 나열하지는 말아주세요. 불안하거나 주눅든 부분이 보이면 다그치지 말고, 작게 시작할 수 있는 방향으로 말해주세요.");
  }
  lines.push("");
  lines.push(intro || "위 기록을 바탕으로 아래 형식 그대로 답해주세요. 마크다운 기호(**, #, 목록, 표)는 쓰지 말아주세요.");
  lines.push("");
  lines.push("💼 업무");
  lines.push("(한 문단, 6~8문장) 업무의 달인 관점에서 업무 기록을 상세히 분석해주세요. 잘한 점은 구체적으로 칭찬하고, 일하는 방식·우선순위·보완할 점의 원인과 개선법을 실전적으로 말해주세요.");
  lines.push("");
  lines.push("🧠 마음");
  lines.push("(한 문단, 6~8문장) 정신건강의학 전문가의 관점에서 오늘의 감정·불안·스트레스·에너지 상태를 상세히 분석해주세요. 가족·업무·일상 점수와 기분의 관계, 체크리스트(수면·심호흡 등), 최근 흐름의 패턴을 근거로 삼고, 잘 버틴 부분은 인정해주세요.");
  lines.push("");
  lines.push("🎯 내일 딱 한 가지: (두 분석을 종합한 결론, 내일 바로 실천할 작은 행동 한 문장)");
  lines.push("");
  lines.push("📜 오늘의 명언: \"명언\" — 말한 사람, 『출처(책·연설·편지 등 정확한 제목)』");
  lines.push("명언은 오늘 기록과 어울리는 것으로, 실제로 그 사람이 한 말이고 출처가 확인되는 것만 골라주세요. 흔히 잘못 알려진 명언이나 출처가 불분명한 말은 쓰지 말고, 확실하지 않으면 출처가 분명한 다른 명언을 골라주세요.");
  lines.push("");
  lines.push("진단은 하지 말고, 기록에 많이 힘든 내용이 있으면 해결책보다 공감을 먼저 하고 믿을 만한 사람이나 전문가와 이야기해보길 권해주세요.");
}

// 📌 핀보드 정리 요청문
function buildOrganizePrompt(date, form, about, checklist, tagPresets) {
  const lines = [];
  lines.push(`[파워로그] ${fmtFull(date)} 하루를 아무렇게나 적은 메모예요. 아래 형식에 맞게 정리하고 조언해주세요.`);
  lines.push("");
  lines.push("(메모)");
  lines.push(form.memo.trim());
  const filled = form.entries.filter((e) => TYPES[e.type] && (e.score || e.tags.length || Object.values(e.fields).some((v) => v && v.replace(/[•\s]/g, ""))));
  if (filled.length) {
    lines.push("");
    lines.push("(이미 앱에 적어둔 내용: 메모와 합쳐서 정리해주세요)");
    filled.forEach((e) => {
      const t = TYPES[e.type];
      lines.push(`■ ${t.label}${e.score ? ` (점수 ${e.score})` : ""}: ${t.fields.filter((f) => e.fields[f.k]).map((f) => `${f.label}=${clip(e.fields[f.k], 80)}`).join(" / ")}${e.tags.length ? ` 태그=${e.tags.join(",")}` : ""}`);
    });
  }
  lines.push("");
  lines.push("(정리 규칙)");
  lines.push("카드 종류와 칸:");
  TYPE_ORDER.forEach((k) => {
    const t = TYPES[k];
    lines.push(`- ${k} (${t.label}): ${t.score ? "score 1~5, " : ""}${t.fields.map((f) => `${f.k}=${f.label}`).join(", ")} / 추천 태그: ${(tagPresets[k] || []).join(", ")}`);
  });
  lines.push(`- 체크리스트 항목 (오늘 한 것만 고르기): ${checklist.join(", ")}`);
  lines.push("- 기분(mood)은 😊(최고) 🙂(좋음) 😐(보통) 😞(별로) 😣(힘듦) 중 하나");
  lines.push("- 메모에 없는 사실은 지어내지 말아주세요. 친구를 여러 번 만났으면 friend 카드를 여러 개 만들어주세요. 내용이 없는 카드는 빼주세요.");
  lines.push("- 여러 줄 칸은 한 줄에 하나씩 \"• \"로 시작해주세요.");
  lines.push("");
  lines.push("(진행 방법)");
  lines.push("1단계: 정리에 꼭 필요한 정보가 빠졌으면 (예: 점수를 짐작할 수 없음, 친구를 누구와 어디서 만났는지 없음, 기분을 알 수 없음) 먼저 짧은 질문만 번호로 최대 3개 해주세요. 점수는 짐작하지 말고 물어봐주세요. 빠진 게 없으면 바로 2단계로 가주세요.");
  lines.push("2단계: 내 답을 받으면 아래 조언을 쓰고, 맨 마지막에 정리된 데이터를 ```json 코드블록 하나로 주세요.");
  adviceInstructions(lines, about, "조언은 아래 형식 그대로 써주세요. 마크다운 기호(**, #, 목록, 표)는 쓰지 말아주세요.");
  lines.push("");
  lines.push("맨 마지막 데이터 형식 (이 형식 그대로, 코드블록 안에는 JSON만):");
  lines.push("```json");
  lines.push('{"mood":"🙂","entries":[{"type":"family","score":4,"fields":{"did":"• ...","feel":"• ..."},"tags":["아이"]},{"type":"friend","fields":{"who":"...","where":"...","what":"• ..."},"tags":[]}],"checklist":["스쿼트"],"plan":"내일 딱 한 가지 문장"}');
  lines.push("```");
  return lines.join("\n");
}

// 붙여넣은 답변에서 JSON 데이터와 조언 글을 분리
function parseOrganized(raw) {
  const text = String(raw || "");
  let jsonStr = null;
  let rest = text;
  const fence = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].pop();
  if (fence) {
    jsonStr = fence[1];
    rest = text.replace(fence[0], "");
  } else {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      jsonStr = text.slice(start, end + 1);
      rest = text.slice(0, start) + text.slice(end + 1);
    }
  }
  if (!jsonStr) return null;
  try {
    const data = JSON.parse(jsonStr.trim().replace(/,\s*([}\]])/g, "$1"));
    const adviceText = rest
      .replace(/맨 마지막 데이터.*$/m, "")
      .replace(/^\s*(정리된 데이터|데이터)\s*[:：]?\s*$/gm, "")
      .trim();
    return { data, adviceText };
  } catch (e) {
    return null;
  }
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
  const entries = form.entries.filter((e) => {
    const t = TYPES[e.type];
    return t && (e.score || e.tags.length || t.fields.some((f) => e.fields[f.k]));
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
          {entries.length === 0 && <div style={page.empty}>아직 작성한 내용이 없어요.</div>}
          {entries.map((e) => {
            const t = TYPES[e.type];
            return (
              <div key={e.id} style={page.block}>
                <div style={page.blockHead}>
                  <span style={page.blockTitle}>
                    {t.emoji} {t.label}
                  </span>
                  {e.score && <span style={page.score}>{"●".repeat(e.score)}{"○".repeat(5 - e.score)}</span>}
                </div>
                {t.fields
                  .filter((f) => e.fields[f.k])
                  .map((f) =>
                    f.single ? (
                      <div key={f.k} style={page.line}>
                        <b style={page.fieldName}>{f.label}</b> {e.fields[f.k]}
                      </div>
                    ) : (
                      <div key={f.k} style={page.sub}>
                        <span style={{ ...page.badge, ...(f.k === "improve" ? page.improveBadge : f.k === "feel" ? page.goodBadge : page.plainBadge) }}>{f.label}</span>
                        <div style={{ flex: 1 }}>
                          <Lines text={e.fields[f.k]} />
                        </div>
                      </div>
                    )
                  )}
                {e.tags.length > 0 && <div style={page.tags}>{e.tags.map((x) => "#" + x).join("  ")}</div>}
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
  overlay: { position: "fixed", inset: 0, background: C.paperAlt, zIndex: 80, display: "flex", flexDirection: "column" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top, 0px) + 10px) 16px 12px", background: C.paper, borderBottom: `1px solid ${C.line}` },
  toolBtn: { display: "flex", alignItems: "center", border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 13.5, fontWeight: 500, padding: "8px 14px", borderRadius: 8, fontFamily: F.sans },
  toolBtnMain: { background: C.wine, color: C.paper, border: `1px solid ${C.wine}` },
  scroll: { flex: 1, overflowY: "auto", padding: "20px 16px 40px", WebkitOverflowScrolling: "touch" },
  sheet: { background: C.paper, padding: "26px 24px 28px", maxWidth: 460, margin: "0 auto", color: C.ink, border: `1px solid ${C.line}` },
  brand: { fontSize: 11.5, fontWeight: 600, color: C.ink2, letterSpacing: 1 },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, paddingBottom: 16, borderBottom: `1px solid ${C.wine}` },
  date: { fontSize: 22, fontWeight: 700, fontFamily: F.serif },
  mood: { fontSize: 22 },
  moodText: { fontSize: 13, fontWeight: 500, color: C.ink2 },
  empty: { fontSize: 13, color: C.ink2, padding: "20px 0" },
  block: { padding: "16px 0", borderBottom: `1px solid ${C.line}` },
  blockHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  blockTitle: { fontSize: 15, fontWeight: 600, fontFamily: F.serif },
  score: { fontSize: 11, color: C.wine, letterSpacing: 2 },
  line: { fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" },
  sub: { display: "flex", gap: 8, marginTop: 8, alignItems: "flex-start" },
  badge: { flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 3, marginTop: 2 },
  goodBadge: { background: C.wineSoft, color: C.wine },
  improveBadge: { background: C.ochreSoft, color: C.ochre },
  plainBadge: { background: C.paperAlt, color: C.ink2 },
  fieldName: { fontSize: 12, color: C.ink2, marginRight: 4 },
  tags: { fontSize: 12, color: C.ink2, fontWeight: 500, marginTop: 8 },
  checkWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  checkItem: { fontSize: 12.5, color: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "3px 9px" },
  checkItemOn: { color: C.wine, background: C.wineSoft, border: `1px solid ${C.wineLine}`, fontWeight: 600 },
  adviceBox: { marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` },
  adviceTitle: { fontSize: 13, fontWeight: 600, color: C.wine, marginBottom: 8, fontFamily: F.serif },
  adviceHead: { fontSize: 13.5, fontWeight: 600, lineHeight: 1.7, marginTop: 10 },
  quote: { fontSize: 13.5, lineHeight: 1.7, marginTop: 14, padding: "2px 0 2px 14px", borderLeft: `2px solid ${C.wine}`, fontStyle: "italic", color: C.ink2 },
  adviceLine: { fontSize: 13.5, lineHeight: 1.7 },
  planBox: { marginTop: 16, border: `1px solid ${C.wine}`, padding: "14px 16px" },
  planTitle: { fontSize: 12, fontWeight: 600, color: C.wine },
  planText: { fontSize: 14, fontWeight: 500, marginTop: 5, lineHeight: 1.6 },
};

export const styles = {
  app: { minHeight: "100vh", background: C.paper, display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", color: C.ink, fontFamily: F.sans },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px" },
  brandRow: { display: "flex", flexDirection: "column" },
  brandName: { fontSize: 18, fontWeight: 700, color: C.ink, fontFamily: F.serif },
  brandSub: { fontSize: 11, color: C.ink2, fontWeight: 500, marginTop: 2 },
  viewToggle: { display: "flex", gap: 14 },
  viewBtn: { display: "flex", alignItems: "center", border: "none", borderBottom: "2px solid transparent", background: "transparent", color: C.ink2, fontSize: 13, fontWeight: 500, padding: "6px 2px", fontFamily: F.sans },
  viewBtnOn: { color: C.wine, borderBottomColor: C.wine },
  header: { padding: "0 20px 16px", borderBottom: `1px solid ${C.line}` },
  dateNavRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  navBtn: { background: "none", border: "none", color: C.ink2, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dateWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
  dateBig: { position: "relative", fontSize: 19, fontWeight: 700, color: C.ink, fontFamily: F.serif },
  todayBtn: { background: "none", border: `1px solid ${C.wineLine}`, borderRadius: 20, padding: "3px 11px", fontSize: 11.5, fontWeight: 500, color: C.wine, fontFamily: F.sans },
  moodRow: { display: "flex", justifyContent: "center", gap: 22, marginTop: 16 },
  moodCol: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: 0 },
  moodBtn: { fontSize: 22, opacity: 0.45, transition: "opacity .15s" },
  moodBtnActive: { opacity: 1 },
  moodLabel: { fontSize: 10.5, color: C.ink2, fontWeight: 500 },
  body: { flex: 1, padding: "0 20px 60px" },
  loadingWrap: { display: "flex", justifyContent: "center", padding: "60px 0" },
  taBox: { display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderBottom: `1px solid ${C.line}` },
  taLive: {},
  taUrgent: { color: C.brick },
  taDone: {},
  taZero: { color: C.ink2 },
  taTrophy: { fontSize: 17, width: 20, textAlign: "center", flexShrink: 0 },
  taTitle: { fontSize: 13.5, fontWeight: 500 },
  taSub: { fontSize: 11.5, color: C.ink2, marginTop: 1, fontVariantNumeric: "tabular-nums" },
  historyScore: { fontSize: 11, fontWeight: 500, color: C.ink2 },
  planCheck: { padding: "14px 0", borderBottom: `1px solid ${C.line}` },
  planCheckLabel: { fontSize: 12, fontWeight: 500, color: C.wine },
  planCheckText: { fontSize: 14.5, fontWeight: 500, marginTop: 4, lineHeight: 1.5, fontFamily: F.serif },
  planCheckBtns: { display: "flex", gap: 8, marginTop: 10 },
  planBtn: { ...shared.btnSecondary, flex: 1, fontSize: 13 },
  planBtnYes: { background: C.wine, color: C.paper, border: `1px solid ${C.wine}` },
  planBtnNo: { background: C.paperAlt, border: `1px solid ${C.paperAlt}`, color: C.ink2 },
  section: { ...shared.section },
  sectionMissing: { borderLeft: `2px solid ${C.brick}`, paddingLeft: 12, marginLeft: -14 },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 15.5, fontWeight: 600, color: C.ink, fontFamily: F.serif },
  dateInput: { position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", border: "none" },
  addTypeRow: { display: "flex", flexWrap: "wrap", gap: 8, padding: "16px 0", borderTop: `1px solid ${C.line}` },
  addTypeBtn: { ...shared.chip, display: "inline-flex", alignItems: "center" },
  removeBtn: { background: "none", border: "none", padding: 4, display: "flex", color: C.ink2 },
  scoreLine: { display: "flex", alignItems: "center", gap: 6, marginBottom: 10 },
  fieldBlock: { marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: C.ink2, marginBottom: 5 },
  tagBar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 },
  tagToggle: { ...shared.btnGhost, marginLeft: "auto" },
  tagPanel: { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` },
  tagPanelFoot: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  linkBtn: { border: "none", background: "none", color: C.ink2, fontSize: 12, fontWeight: 500, textDecoration: "underline", padding: 0, fontFamily: F.sans },
  tagDoneSmall: { display: "inline-flex", alignItems: "center", border: "none", background: C.wine, color: C.paper, fontSize: 12.5, fontWeight: 500, padding: "7px 13px", borderRadius: 8, fontFamily: F.sans },
  scoreRow: { display: "flex", alignItems: "center", gap: 5 },
  scoreLabel: { fontSize: 11, color: C.ink2, fontWeight: 500, marginRight: 2 },
  scoreBtn: { width: 24, height: 24, borderRadius: "50%", border: `1px solid ${C.line}`, background: "transparent", color: C.ink2, fontSize: 11.5, fontWeight: 500, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans },
  scoreBtnOn: { background: C.wine, border: `1px solid ${C.wine}`, color: C.paper },
  autoInput: { ...shared.textarea, padding: "8px 0", border: "none", borderBottom: `1px solid ${C.line}`, borderRadius: 0, background: "transparent", overflow: "hidden" },
  lineRow: { display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10 },
  lineBadge: { flexShrink: 0, width: 58, fontSize: 11.5, fontWeight: 500, paddingTop: 8 },
  goodBadge: { color: C.wine },
  improveBadge: { color: C.ochre },
  lineInput: { flex: 1, width: "auto", minWidth: 0 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagMini: { fontSize: 11.5, color: C.ink2, fontWeight: 500 },
  checkCount: { fontSize: 12.5, color: C.ink2, fontWeight: 500, marginLeft: 4 },
  editBtn: { ...shared.btnGhost, textDecoration: "underline" },
  checkRow: { width: "100%", display: "flex", alignItems: "center", gap: 10, border: "none", background: "none", padding: "8px 0", textAlign: "left" },
  checkBox: { width: 17, height: 17, borderRadius: 4, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkBoxOn: { background: C.wine, border: `1.5px solid ${C.wine}` },
  checkGroup: { marginTop: 4 },
  checkGroupLabel: { fontSize: 11, fontWeight: 500, color: C.ink2, marginBottom: 2, marginTop: 8 },
  checkGrid: { display: "flex", flexDirection: "column" },
  checkTile: { display: "flex", alignItems: "center", gap: 9, border: "none", background: "none", padding: "7px 0", textAlign: "left", minWidth: 0 },
  checkTileOn: {},
  checkTileText: { fontSize: 13.5, color: C.ink, fontWeight: 400, lineHeight: 1.3, wordBreak: "keep-all" },
  checkText: { fontSize: 14.5, color: C.ink },
  checkTextOn: { color: C.ink2, textDecoration: "line-through" },
  checkDel: { background: "none", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  tagMainBtn: { width: "100%", display: "flex", alignItems: "center", border: "none", background: "none", padding: "2px 0", fontSize: 14.5, fontWeight: 500, color: C.ink, fontFamily: F.serif },
  tagGroup: { paddingTop: 12, marginTop: 8, borderTop: `1px solid ${C.line}` },
  tagGroupLabel: { fontSize: 11.5, fontWeight: 500, color: C.ink2 },
  tagChip: { ...shared.chip },
  tagChipOn: { ...shared.chipOn },
  tagAdd: { display: "inline-flex", alignItems: "center", border: `1px dashed ${C.line}`, background: "none", color: C.ink2, fontSize: 12.5, fontWeight: 500, padding: "6px 11px", borderRadius: 20, fontFamily: F.sans },
  tagDoneBtn: { ...shared.btnPrimary, marginTop: 12 },
  saveBtn: { ...shared.btnPrimary, marginTop: 18, marginBottom: 14 },
  pinBox: {},
  pinHead: { width: "100%", display: "flex", alignItems: "baseline", gap: 8, border: "none", background: "none", padding: 0, textAlign: "left" },
  pinSub: { fontSize: 11.5, color: C.ink2, fontWeight: 500 },
  claudeBtn: { ...shared.btnSecondary, marginTop: 10 },
  adviceHint: { fontSize: 12, color: C.ink2, margin: "10px 0", lineHeight: 1.55 },
  aboutToggle: { width: "100%", display: "flex", alignItems: "center", border: "none", background: "none", padding: "4px 0 10px", fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4, fontFamily: F.sans },
  aboutToggleSub: { fontSize: 11.5, fontWeight: 500, color: C.ink2, marginLeft: 4 },
  planLabel: { fontSize: 12.5, fontWeight: 500, color: C.ink, margin: "12px 0 5px" },
  adviceSaveBtn: { ...shared.btnPrimary, marginTop: 10 },
  pageBtn: { ...shared.btnSecondary, marginTop: 18, marginBottom: 30 },
  toast: { ...shared.toast },
  historyLabel: { fontSize: 12, color: C.ink2, fontWeight: 500, margin: "18px 0 10px" },
  historyRow: { width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "9px 0", borderBottom: `1px solid ${C.line}`, textAlign: "left" },
  historyRowActive: { color: C.wine },
  historyMood: { fontSize: 15 },
  historyDate: { fontSize: 13, color: "inherit", fontWeight: 400, flex: 1, textAlign: "left" },
  historyBadge: { fontSize: 11, color: C.ink2, fontWeight: 500 },
  addRow: { display: "flex", gap: 8, marginTop: 10 },
  addInput: { ...shared.input, flex: 1, minWidth: 0, borderRadius: 8 },
  addBtn: { background: C.wine, border: "none", borderRadius: 8, width: 38, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipEditing: { display: "inline-flex", alignItems: "center", gap: 5, border: `1px dashed ${C.line}`, background: "none", color: C.ink2, fontSize: 13, fontWeight: 500, padding: "6px 6px 6px 12px", borderRadius: 20, fontFamily: F.sans },
  chipRemove: { background: "none", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
};
