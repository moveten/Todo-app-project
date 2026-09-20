import React, { useState, useEffect, useRef } from "react";

// 브라우저 localStorage 기반 저장소 (Claude 아티팩트의 window.storage를 대체)
const storage = {
  async get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? null : { key, value: v };
    } catch (e) {
      throw e;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
};
import { Plus, X, Check, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, LayoutList, Trash2, AlertTriangle, Pencil, ListChecks } from "lucide-react";

// ---------- 유틸 ----------
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const diffDays = (a, b) => {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((da - db) / 86400000);
};
const fmtMD = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}.${d.getDate()}`;
};
const fmtFull = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};
const uid = () => Math.random().toString(36).slice(2, 10);

const dDayLabel = (target, today) => {
  const diff = diffDays(target, today);
  if (diff === 0) return "D-DAY";
  if (diff > 0) return `D-${diff}`;
  return `D+${-diff}`;
};

// ---------- 대한민국 공휴일 (2026~2027, 대체공휴일 포함) ----------
const KR_HOLIDAYS = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "삼일절 대체공휴일",
  "2026-05-01": "노동절",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "부처님오신날 대체공휴일",
  "2026-06-06": "현충일",
  "2026-07-17": "제헌절",
  "2026-08-15": "광복절",
  "2026-08-17": "광복절 대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "개천절 대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "기독탄신일",
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "설날 대체공휴일",
  "2027-03-01": "삼일절",
  "2027-05-01": "노동절",
  "2027-05-03": "노동절 대체공휴일",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-07-17": "제헌절",
  "2027-07-19": "제헌절 대체공휴일",
  "2027-08-15": "광복절",
  "2027-08-16": "광복절 대체공휴일",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절",
  "2027-10-04": "개천절 대체공휴일",
  "2027-10-09": "한글날",
  "2027-10-11": "한글날 대체공휴일",
  "2027-12-25": "기독탄신일",
  "2027-12-27": "기독탄신일 대체공휴일",
};

function getDateWarning(iso) {
  const holiday = KR_HOLIDAYS[iso];
  if (holiday) return { label: holiday, kind: "holiday" };
  const day = new Date(iso + "T00:00:00").getDay();
  if (day === 0) return { label: "일요일", kind: "weekend" };
  if (day === 6) return { label: "토요일", kind: "weekend" };
  return null;
}

// ---------- 이전 버전 데이터 마이그레이션 ----------
function normalizeItem(raw) {
  if (raw.reminders) return raw;
  return {
    id: raw.id,
    title: raw.title,
    date: raw.eventDate,
    done: false,
    reminders: (raw.steps || []).map((s) => ({ id: s.id, daysBefore: s.daysBefore, label: s.label, done: !!s.done })),
  };
}

const STORAGE_KEY = "moved-app:events";

// ---------- 오늘 기준 할 일 목록 계산 ----------
function buildTodos(items, today) {
  const todos = [];
  items.forEach((it) => {
    if (!it.done && it.date <= today) {
      todos.push({
        itemId: it.id,
        reminderId: null,
        kind: "main",
        itemTitle: it.title,
        label: it.title,
        itemDate: it.date,
        occurDate: it.date,
        checklist: it.checklist || [],
      });
    }
    (it.reminders || []).forEach((r) => {
      if (r.done) return;
      const occur = addDays(it.date, -r.daysBefore);
      if (occur <= today && it.date >= today) {
        todos.push({
          itemId: it.id,
          reminderId: r.id,
          kind: "reminder",
          itemTitle: it.title,
          label: r.label,
          daysBefore: r.daysBefore,
          itemDate: it.date,
          occurDate: occur,
          checklist: r.checklist || [],
        });
      }
    });
  });
  todos.sort((a, b) => {
    if (a.occurDate !== b.occurDate) return a.occurDate < b.occurDate ? -1 : 1;
    return a.itemDate < b.itemDate ? -1 : 1;
  });
  return todos;
}

export default function App() {
  const [items, setItems] = useState(null);
  const [view, setView] = useState("list"); // list | calendar
  const [modal, setModal] = useState(null); // null | {mode:'new'} | {mode:'edit', item}
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        setItems(res ? JSON.parse(res.value).map(normalizeItem) : []);
      } catch (e) {
        setItems([]);
      }
    })();
  }, []);

  const persist = async (next) => {
    setItems(next);
    const trySave = () => storage.set(STORAGE_KEY, JSON.stringify(next));
    try {
      let res = await trySave();
      if (!res) res = await trySave();
      setSaveError(!res);
    } catch (e) {
      try {
        const res = await trySave();
        setSaveError(!res);
      } catch (e2) {
        setSaveError(true);
      }
    }
  };

  if (items === null) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingStamp}>준비 중</div>
      </div>
    );
  }

  const today = todayISO();
  const todos = buildTodos(items, today);

  const saveItem = (item) => {
    const exists = items.some((it) => it.id === item.id);
    persist(exists ? items.map((it) => (it.id === item.id ? item : it)) : [...items, item]);
    setModal(null);
  };
  const deleteItem = (id) => {
    persist(items.filter((it) => it.id !== id));
    setModal(null);
  };
  const toggleMainDone = (itemId, done) => {
    persist(items.map((it) => (it.id === itemId ? { ...it, done } : it)));
  };
  const toggleReminderDone = (itemId, reminderId, done) => {
    persist(
      items.map((it) =>
        it.id === itemId ? { ...it, reminders: it.reminders.map((r) => (r.id === reminderId ? { ...r, done } : r)) } : it
      )
    );
  };

  return (
    <div style={styles.app}>
      <style>{`
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea { font-family: inherit; }
        ::placeholder { color: #A8AFB8; }
        .scrollbox::-webkit-scrollbar { width: 6px; }
        .scrollbox::-webkit-scrollbar-thumb { background: #DDE2E7; border-radius: 3px; }
      `}</style>

      <div style={styles.header}>
        <div style={styles.dateBig}>{fmtFull(today)}</div>
        <div style={styles.subLabel}>{view === "list" ? `할 일 ${todos.length}건` : "달력"}</div>
        <div style={styles.tabRow}>
          <button onClick={() => setView("list")} style={{ ...styles.tabBtn, ...(view === "list" ? styles.tabBtnActive : {}) }}>
            <LayoutList size={15} style={{ marginRight: 6 }} />
            리스트
          </button>
          <button onClick={() => setView("calendar")} style={{ ...styles.tabBtn, ...(view === "calendar" ? styles.tabBtnActive : {}) }}>
            <CalendarDays size={15} style={{ marginRight: 6 }} />
            달력
          </button>
        </div>
      </div>

      <div style={styles.body} className="scrollbox">
        {view === "list" && (
          <ListView
            todos={todos}
            today={today}
            onToggleMain={toggleMainDone}
            onToggleReminder={toggleReminderDone}
            onOpen={(t) => setModal({ mode: "edit", item: items.find((it) => it.id === t.itemId) })}
          />
        )}
        {view === "calendar" && (
          <CalendarView
            items={items}
            today={today}
            onEdit={(item) => setModal({ mode: "edit", item })}
          />
        )}
      </div>

      {saveError && (
        <div style={styles.saveErrorBar}>
          <AlertTriangle size={14} style={{ marginRight: 6 }} /> 저장에 실패했어요. 변경사항이 기기에만 남아있을 수 있어요.
        </div>
      )}

      <button onClick={() => setModal({ mode: "new" })} style={styles.fab} aria-label="일정 추가">
        <Plus size={24} color="#fff" />
      </button>

      {modal && (
        <EventModal
          mode={modal.mode}
          initialItem={modal.item}
          today={today}
          onClose={() => setModal(null)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
    </div>
  );
}

// ---------- 리스트 뷰 ----------
function ListView({ todos, today, onToggleMain, onToggleReminder, onOpen }) {
  if (todos.length === 0) {
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.emptyStamp}>완료</div>
        <div style={styles.emptyText}>지금 처리할 일이 없어요.</div>
      </div>
    );
  }
  return (
    <div>
      {todos.map((t) => {
        const dday = dDayLabel(t.itemDate, today);
        const isUrgent = dday === "D-DAY" || (dday.startsWith("D-") && Number(dday.slice(2)) <= 3) || dday.startsWith("D+");
        const overdue = diffDays(today, t.occurDate);
        const warning = getDateWarning(t.occurDate);
        return (
          <div key={t.itemId + (t.reminderId || "main")} style={styles.card}>
            <button
              onClick={() =>
                t.kind === "main" ? onToggleMain(t.itemId, true) : onToggleReminder(t.itemId, t.reminderId, true)
              }
              style={styles.checkCircle}
              aria-label="완료 처리"
            >
              <Check size={13} color="transparent" />
            </button>
            <div style={styles.cardBody} onClick={() => onOpen(t)}>
              <div style={styles.cardTopRow}>
                {t.kind === "reminder" && <span style={styles.itemTitleTag}>{t.itemTitle}</span>}
                <span style={{ ...styles.ddayBadge, background: isUrgent ? "#DC5B45" : "#0D9488" }}>{dday}</span>
                {overdue > 0 && <span style={styles.overdueTag}>{overdue}일 지연</span>}
              </div>
              <div style={styles.stepLabel}>{t.label}</div>
              <div style={styles.metaRow}>
                <span>{t.kind === "reminder" ? `${t.daysBefore}일 전 준비` : "본 일정 당일"}</span>
                <span style={styles.dot}>·</span>
                <span>{fmtMD(t.occurDate)}</span>
                {warning && (
                  <>
                    <span style={styles.dot}>·</span>
                    <span style={styles.warningTag}>
                      <AlertTriangle size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                      {warning.label}
                    </span>
                  </>
                )}
                {t.checklist.length > 0 && (
                  <>
                    <span style={styles.dot}>·</span>
                    <span style={styles.checklistMeta}>
                      <ListChecks size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                      {t.checklist.filter((c) => c.checked).length}/{t.checklist.length}
                    </span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight size={16} color="#A8AFB8" onClick={() => onOpen(t)} style={{ cursor: "pointer", flexShrink: 0 }} />
          </div>
        );
      })}
    </div>
  );
}

// ---------- 달력 뷰 (간단) ----------
function CalendarView({ items, today, onEdit }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(today + "T00:00:00");
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  const itemsByDate = {};
  items.forEach((it) => {
    if (!itemsByDate[it.date]) itemsByDate[it.date] = [];
    itemsByDate[it.date].push(it);
  });
  const reminderDates = new Set();
  items.forEach((it) => {
    (it.reminders || []).forEach((r) => {
      reminderDates.add(addDays(it.date, -r.daysBefore));
    });
  });

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = `${cursor.year}. ${pad(cursor.month + 1)}`;
  const isoOf = (d) => `${cursor.year}-${pad(cursor.month + 1)}-${pad(d)}`;

  const goMonth = (delta) => {
    let m = cursor.month + delta;
    let y = cursor.year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCursor({ year: y, month: m });
  };
  const goToday = () => {
    const d = new Date(today + "T00:00:00");
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
  };

  const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const selectedWarning = getDateWarning(selected);
  const selectedItems = itemsByDate[selected] || [];

  return (
    <div>
      <div style={styles.calNavRow}>
        <div style={styles.calNavLeft}>
          <div style={styles.calMonthLabel}>{monthLabel}</div>
          <button onClick={goToday} style={styles.calTodayBtn}>오늘</button>
        </div>
        <div style={styles.calNavArrows}>
          <button onClick={() => goMonth(-1)} style={styles.calNavBtn}><ChevronsLeft size={15} color="#5B6470" /></button>
          <button onClick={() => goMonth(1)} style={styles.calNavBtn}><ChevronsRight size={15} color="#5B6470" /></button>
        </div>
      </div>

      <div style={styles.calCardWrap}>
        <div style={styles.calWeekRow}>
          {weekLabels.map((w, i) => (
            <div key={w} style={{ ...styles.calWeekLabel, color: i === 0 ? "#DC5B45" : i === 6 ? "#3B82C4" : "#9AA3AF" }}>{w}</div>
          ))}
        </div>
        <div style={styles.calGrid}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} style={styles.calCell} />;
            const iso = isoOf(d);
            const dayItems = itemsByDate[iso] || [];
            const hasReminder = reminderDates.has(iso);
            const warning = getDateWarning(iso);
            const isToday = iso === today;
            const isSelected = iso === selected;
            const weekday = i % 7;
            return (
              <button
                key={i}
                onClick={() => setSelected(iso)}
                style={{
                  ...styles.calCell,
                  ...styles.calDayBtn,
                  background: isSelected ? "#1F2937" : warning ? "#FBEAE7" : "transparent",
                }}
              >
                <span
                  style={{
                    ...styles.calDateNum,
                    background: isToday ? "#DC5B45" : "transparent",
                    color: isSelected ? "#fff" : warning ? "#DC5B45" : weekday === 0 ? "#DC5B45" : weekday === 6 ? "#3B82C4" : "#1F2937",
                  }}
                >
                  {d}
                </span>
                <span style={styles.calDotRow}>
                  {dayItems.length > 0 && <span style={{ ...styles.calDot, width: 6, height: 6, background: isSelected ? "#fff" : "#DC5B45" }} />}
                  {hasReminder && <span style={{ ...styles.calDot, width: 4, height: 4, background: isSelected ? "#C9C2B0" : "#B8AF9C" }} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.calDayPanel}>
        <div style={styles.calDayPanelTitleRow}>
          <div style={styles.calDayPanelTitle}>{fmtFull(selected)}</div>
          {selectedWarning && (
            <span style={styles.warningTag}>
              <AlertTriangle size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
              {selectedWarning.label}
            </span>
          )}
        </div>
        {selectedItems.length === 0 && <div style={styles.calEmptyText}>이 날짜에는 등록된 일정이 없어요.</div>}
        {selectedItems.map((it) => (
          <div key={it.id} style={styles.calEventBanner}>
            <span style={{ ...styles.ddayBadge, background: "#0D9488" }}>{dDayLabel(it.date, today)}</span>
            <span style={styles.calEventBannerText}>{it.title}</span>
            <button onClick={() => onEdit(it)} style={styles.calEventEditBtn} aria-label="일정 수정">
              <Pencil size={13} color="#8A93A0" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 체크리스트 편집기 (공용) ----------
function ChecklistEditor({ items, onChange }) {
  const [newText, setNewText] = useState("");

  const add = () => {
    if (!newText.trim()) return;
    onChange([...(items || []), { id: uid(), text: newText.trim(), checked: false }]);
    setNewText("");
  };
  const toggle = (id) => onChange(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  return (
    <div>
      {(items || []).map((i) => (
        <div key={i.id} style={styles.checklistEditorRow}>
          <button
            onClick={() => toggle(i.id)}
            style={{ ...styles.checkCircleSmall, background: i.checked ? "#0D9488" : "#fff", borderColor: i.checked ? "#0D9488" : "#D7DCE1" }}
          >
            {i.checked && <Check size={11} color="#fff" />}
          </button>
          <span style={{ ...styles.checklistEditorText, textDecoration: i.checked ? "line-through" : "none", color: i.checked ? "#9AA3AF" : "#1F2937" }}>
            {i.text}
          </span>
          <button onClick={() => remove(i.id)} style={styles.stepRemoveBtn}>
            <X size={12} color="#A8AFB8" />
          </button>
        </div>
      ))}
      <div style={styles.checklistAddRow}>
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="체크리스트 항목 추가"
          style={styles.checklistAddInput}
        />
        <button onClick={add} style={styles.checklistAddBtn}>
          <Plus size={14} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ---------- 일정 추가/수정 모달 ----------
function EventModal({ mode, initialItem, today, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initialItem?.title || "");
  const [date, setDate] = useState(initialItem?.date || today);
  const [checklist, setChecklist] = useState(initialItem?.checklist || []);
  const [checklistOpen, setChecklistOpen] = useState(!!(initialItem?.checklist && initialItem.checklist.length));
  const [reminders, setReminders] = useState(() =>
    (initialItem?.reminders || []).map((r) => ({ id: r.id, daysBefore: r.daysBefore, label: r.label, done: r.done || false }))
  );
  const firstInput = useRef(null);

  useEffect(() => {
    firstInput.current && firstInput.current.focus();
  }, []);

  const updateReminder = (id, field, val) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };
  const addReminder = () => setReminders([...reminders, { id: uid(), daysBefore: 1, label: "", done: false }]);
  const removeReminder = (id) => setReminders(reminders.filter((r) => r.id !== id));

  const canSave = title.trim() && date;

  const save = () => {
    if (!canSave) return;
    onSave({
      id: initialItem?.id || uid(),
      title: title.trim(),
      date,
      done: initialItem?.done || false,
      checklist,
      reminders: reminders
        .filter((r) => r.label.trim())
        .map((r) => ({ id: r.id, daysBefore: Number(r.daysBefore) || 0, label: r.label.trim(), done: r.done || false, checklist: [] })),
    });
  };

  const warning = getDateWarning(date);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHandle} />
        <div style={styles.modalHeaderRow}>
          <div style={styles.modalTitle}>{mode === "edit" ? "일정 수정" : "새 일정 추가"}</div>
          <button onClick={onClose} style={styles.iconBtn}>
            <X size={18} color="#5B6470" />
          </button>
        </div>

        <div style={styles.modalScroll} className="scrollbox">
          <label style={styles.formLabel}>일정명</label>
          <input
            ref={firstInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정명을 입력하세요"
            style={styles.formInput}
          />

          <label style={styles.formLabel}>날짜</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.formInput} />
          {warning && (
            <div style={styles.dateWarningRow}>
              <AlertTriangle size={13} style={{ marginRight: 5 }} />
              이 날짜는 {warning.label}이에요.
            </div>
          )}

          {checklistOpen ? (
            <div style={styles.checklistSectionWrap}>
              <div style={styles.checklistSectionHeaderRow}>
                <span style={styles.checklistSectionLabel}>
                  <ListChecks size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  체크리스트
                </span>
                <button
                  onClick={() => {
                    setChecklist([]);
                    setChecklistOpen(false);
                  }}
                  style={styles.stepNoteCloseBtn}
                >
                  <X size={13} color="#A8AFB8" />
                </button>
              </div>
              <ChecklistEditor items={checklist} onChange={setChecklist} />
            </div>
          ) : (
            <button onClick={() => setChecklistOpen(true)} style={styles.registerChecklistBtn}>
              <Check size={14} style={{ marginRight: 6 }} />
              체크리스트 추가
            </button>
          )}

          {reminders.map((r) => (
            <div key={r.id} style={styles.stepEditRow}>
              <input
                type="number"
                min="0"
                value={r.daysBefore}
                onChange={(e) => updateReminder(r.id, "daysBefore", e.target.value)}
                style={styles.dayInput}
              />
              <span style={styles.dayInputLabel}>일 전</span>
              <input
                value={r.label}
                onChange={(e) => updateReminder(r.id, "label", e.target.value)}
                placeholder="할 일"
                style={styles.stepLabelInput}
              />
              <button onClick={() => removeReminder(r.id)} style={styles.stepRemoveBtn}>
                <X size={14} color="#A8AFB8" />
              </button>
            </div>
          ))}
          <button onClick={addReminder} style={styles.registerChecklistBtn}>
            <Plus size={14} style={{ marginRight: 6 }} />
            관련 디데이 추가
          </button>

          {mode === "edit" && (
            <button
              style={styles.deleteTextBtn}
              onClick={() => {
                if (window.confirm("이 일정을 삭제할까요?")) onDelete(initialItem.id);
              }}
            >
              <Trash2 size={13} style={{ marginRight: 5 }} />
              일정 삭제
            </button>
          )}
        </div>

        <div style={styles.modalFooterFixed}>
          <button style={{ ...styles.doneBtn, opacity: canSave ? 1 : 0.4 }} onClick={save} disabled={!canSave}>
            {mode === "edit" ? "수정 완료" : "일정 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 스타일 ----------
const styles = {
  app: { minHeight: "100vh", background: "#F7F8FA", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", color: "#1F2937" },
  loadingWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FA" },
  loadingStamp: { border: "2px solid #0D9488", color: "#0D9488", padding: "10px 22px", borderRadius: 8, fontWeight: 700, letterSpacing: 1 },
  header: { padding: "20px 20px 14px", background: "#FFFFFF", borderBottom: "1px solid #EBEEF0" },
  dateBig: { fontSize: 21, fontWeight: 700, color: "#1F2937" },
  subLabel: { fontSize: 12.5, color: "#8A93A0", marginTop: 3, marginBottom: 16 },
  tabRow: { display: "flex", background: "#F0F2F4", borderRadius: 10, padding: 3, gap: 2, marginBottom: 0 },
  tabBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 0", borderRadius: 8, border: "none", background: "transparent", color: "#8A93A0", fontSize: 13.5, fontWeight: 600 },
  tabBtnActive: { background: "#FFFFFF", color: "#0D9488", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" },
  body: { flex: 1, padding: "18px 16px 100px", overflowY: "auto", background: "#F7F8FA" },
  emptyWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px" },
  emptyStamp: { border: "2px solid #0D9488", color: "#0D9488", padding: "8px 18px", borderRadius: 8, fontWeight: 700, letterSpacing: 1, marginBottom: 14 },
  emptyText: { fontSize: 13.5, color: "#8A93A0", textAlign: "center" },
  card: { display: "flex", alignItems: "flex-start", background: "#FFFFFF", borderRadius: 14, padding: "14px 14px", marginBottom: 10, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", gap: 10 },
  checkCircle: { width: 24, height: 24, borderRadius: "50%", border: "2px solid #D7DCE1", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  cardBody: { flex: 1, cursor: "pointer" },
  cardTopRow: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  itemTitleTag: { fontSize: 12, color: "#8A93A0", fontWeight: 600 },
  ddayBadge: { fontSize: 11, fontWeight: 700, color: "#fff", padding: "3px 9px", borderRadius: 20 },
  overdueTag: { fontSize: 11, color: "#DC5B45", fontWeight: 700, marginLeft: "auto" },
  stepLabel: { fontSize: 15, fontWeight: 600, color: "#1F2937", marginTop: 6, lineHeight: 1.35 },
  metaRow: { fontSize: 12, color: "#9AA3AF", marginTop: 6, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 },
  dot: { color: "#DCE1E6" },
  warningTag: { color: "#DC5B45", fontWeight: 700, display: "inline-flex", alignItems: "center" },
  saveErrorBar: { display: "flex", alignItems: "center", justifyContent: "center", background: "#FBEAE7", color: "#DC5B45", fontSize: 12, padding: "8px 12px", position: "sticky", bottom: 0 },
  fab: { position: "fixed", right: 20, bottom: 28, width: 56, height: 56, borderRadius: "50%", background: "#0D9488", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(13,148,136,0.35)", zIndex: 30 },
  calNavRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 12px" },
  calNavLeft: { display: "flex", alignItems: "center", gap: 10 },
  calMonthLabel: { fontSize: 16, fontWeight: 700, color: "#1F2937", letterSpacing: 0.2 },
  calTodayBtn: { background: "#EEF6F5", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: "#0D9488" },
  calNavArrows: { display: "flex", gap: 6 },
  calNavBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" },
  calCardWrap: { background: "#FFFFFF", borderRadius: 14, padding: "10px 6px 4px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" },
  calWeekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 2px", marginBottom: 2 },
  calWeekLabel: { textAlign: "center", fontSize: 10.5, fontWeight: 700, padding: "4px 0" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)" },
  calCell: { aspectRatio: "1", border: "none", borderTop: "1px solid #F1F3F5", display: "flex" },
  calDayBtn: { flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 10, width: "100%", gap: 3 },
  calDateNum: { fontSize: 13, fontWeight: 600, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  calDotRow: { display: "flex", gap: 2, height: 6, alignItems: "center" },
  calDot: { borderRadius: "50%", display: "inline-block" },
  calDayPanel: { marginTop: 20, borderTop: "1px solid #EBEEF0", paddingTop: 16 },
  calDayPanelTitleRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  calDayPanelTitle: { fontSize: 13.5, fontWeight: 700, color: "#1F2937" },
  calEmptyText: { fontSize: 12.5, color: "#9AA3AF", padding: "10px 2px" },
  calEventBanner: { display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 8, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" },
  calEventBannerText: { fontSize: 13, fontWeight: 600, color: "#1F2937", flex: 1 },
  calEventEditBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,32,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  modalSheet: { width: "100%", maxWidth: 480, background: "#FFFFFF", borderRadius: "20px 20px 0 0", padding: "10px 20px 24px", maxHeight: "90%", display: "flex", flexDirection: "column", minHeight: 0 },
  modalHandle: { width: 38, height: 4, background: "#E5E9EC", borderRadius: 2, margin: "0 auto 14px" },
  modalHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1F2937" },
  iconBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalScroll: { overflowY: "auto", marginTop: 14, paddingBottom: 6, flex: "1 1 auto", minHeight: 0, WebkitOverflowScrolling: "touch" },
  formLabel: { display: "block", fontSize: 12, fontWeight: 700, color: "#8A93A0", marginTop: 18, marginBottom: 6 },
  formInput: { width: "100%", border: "1px solid #E5E9EC", borderRadius: 10, padding: "11px 12px", fontSize: 14, background: "#F7F8FA", color: "#1F2937" },
  dateWarningRow: { display: "flex", alignItems: "center", fontSize: 12, color: "#DC5B45", fontWeight: 600, marginTop: 7 },
  stepEditRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  checklistMeta: { color: "#0D9488", fontWeight: 700, display: "inline-flex", alignItems: "center" },
  registerChecklistBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F2F4", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "#5B6470", width: "100%", marginTop: 18 },
  checklistSectionWrap: { background: "#F7F8FA", borderRadius: 10, padding: "10px 10px", marginTop: 10 },
  checklistSectionHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  checklistSectionLabel: { fontSize: 11.5, fontWeight: 700, color: "#0D9488", display: "flex", alignItems: "center" },
  stepNoteCloseBtn: { background: "none", border: "none", padding: 2 },
  checkCircleSmall: { width: 20, height: 20, borderRadius: "50%", border: "2px solid #D7DCE1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checklistEditorRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0" },
  checklistEditorText: { flex: 1, fontSize: 13 },
  checklistAddRow: { display: "flex", gap: 6, marginTop: 4 },
  checklistAddInput: { flex: 1, border: "1px solid #E5E9EC", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, background: "#fff" },
  checklistAddBtn: { width: 32, height: 32, borderRadius: 8, background: "#0D9488", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dayInput: { width: 50, border: "1px solid #E5E9EC", borderRadius: 10, padding: "10px 8px", fontSize: 13.5, textAlign: "center", background: "#F7F8FA" },
  dayInputLabel: { fontSize: 12.5, color: "#8A93A0", flexShrink: 0 },
  stepLabelInput: { flex: 1, border: "1px solid #E5E9EC", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, background: "#F7F8FA" },
  stepRemoveBtn: { background: "none", border: "none", flexShrink: 0 },
  deleteTextBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#DC5B45", fontSize: 13, fontWeight: 600, padding: "16px 0 4px", width: "100%" },
  modalFooterFixed: { flexShrink: 0, paddingTop: 12, borderTop: "1px solid #EBEEF0", marginTop: 4 },
  doneBtn: { background: "#0D9488", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
};
