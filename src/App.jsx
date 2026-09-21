import React, { useState, useEffect, useLayoutEffect, useRef } from "react";

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
import { Plus, X, Check, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, LayoutList, Trash2, AlertTriangle, Pencil, ListChecks, Pin, RotateCcw, CheckSquare, Search, FileText, Download, Upload, ShieldCheck } from "lucide-react";

// ---------- 유틸 ----------
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
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
const fmtFullWithYear = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
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
function normalizeReminder(r) {
  return {
    id: r.id,
    days: r.days ?? r.daysBefore ?? 0,
    direction: r.direction || "before",
    label: r.label,
    done: !!r.done,
    doneDate: r.doneDate || null,
    checklist: r.checklist || [],
  };
}

function normalizeItem(raw) {
  if (raw.reminders) return { pinned: false, time: "00:00", note: "", recurring: false, lastDoneDate: null, doneDate: null, ...raw, reminders: raw.reminders.map(normalizeReminder) };
  return {
    id: raw.id,
    title: raw.title,
    date: raw.eventDate,
    done: false,
    pinned: false,
    time: "00:00",
    note: "",
    recurring: false,
    lastDoneDate: null,
    doneDate: null,
    reminders: (raw.steps || []).map((s) => normalizeReminder(s)),
  };
}

const STORAGE_KEY = "moved-app:events";
const STORAGE_BACKUP_KEY = "moved-app:events:backup";
const PRESET_KEY = "moved-app:presets";
const PRESET_BACKUP_KEY = "moved-app:presets:backup";
const LAST_BACKUP_KEY = "moved-app:last-backup-at";
const ORDER_KEY = "moved-app:manual-order";
const BACKUP_REMINDER_DAYS = 7;

// ---------- 오늘 기준 할 일 목록 계산 ----------
function buildTodos(items, today) {
  const todos = [];
  items.forEach((it) => {
    if (it.recurring) {
      todos.push({
        itemId: it.id,
        reminderId: null,
        kind: "daily",
        itemTitle: it.title,
        label: it.title,
        itemDate: it.date,
        occurDate: today,
        pinned: !!it.pinned,
        time: it.time || "00:00",
        hasSub: false,
        checklist: it.checklist || [],
        note: it.note || "",
        done: it.lastDoneDate === today,
      });
      return;
    }
    const mainDoneToday = it.done && it.doneDate === today;
    if ((!it.done && it.date <= today) || mainDoneToday) {
      todos.push({
        itemId: it.id,
        reminderId: null,
        kind: "main",
        itemTitle: it.title,
        label: it.title,
        itemDate: it.date,
        occurDate: it.date,
        pinned: !!it.pinned,
        time: it.time || "00:00",
        hasSub: (it.reminders || []).length > 0,
        checklist: it.checklist || [],
        note: it.note || "",
        done: mainDoneToday,
      });
    }
    (it.reminders || []).forEach((r) => {
      const reminderDoneToday = r.done && r.doneDate === today;
      if (r.done && !reminderDoneToday) return;
      const direction = r.direction || "before";
      const days = r.days ?? 0;
      const occur = direction === "after" ? addDays(it.date, days) : addDays(it.date, -days);
      if (occur <= today || reminderDoneToday) {
        todos.push({
          itemId: it.id,
          reminderId: r.id,
          kind: "reminder",
          itemTitle: it.title,
          label: r.label,
          days,
          direction,
          itemDate: it.date,
          occurDate: occur,
          pinned: !!it.pinned,
          time: it.time || "00:00",
          checklist: r.checklist || [],
          done: reminderDoneToday,
        });
      }
    });
  });
  todos.sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.occurDate !== b.occurDate) return a.occurDate < b.occurDate ? -1 : 1;
    if (a.itemDate !== b.itemDate) return a.itemDate < b.itemDate ? -1 : 1;
    return (a.time || "00:00").localeCompare(b.time || "00:00");
  });
  return todos;
}

export default function App() {
  const [items, setItems] = useState(null);
  const [presets, setPresets] = useState(null);
  const [view, setView] = useState("list"); // list | calendar
  const [calendarDate, setCalendarDate] = useState(null);
  const [modal, setModal] = useState(null); // null | {mode:'new'} | {mode:'edit', item}
  const [saveError, setSaveError] = useState(false);
  const [loadWarning, setLoadWarning] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [manualOrder, setManualOrderState] = useState([]);
  const itemsRef = useRef(null);

  // ---- 안전한 불러오기: 메인 데이터가 손상/유실됐으면 백업 키에서 자동 복구 ----
  const loadWithBackup = async (mainKey, backupKey) => {
    let raw = null;
    let parsed = null;
    try {
      const res = await storage.get(mainKey);
      raw = res ? res.value : null;
    } catch (e) {
      raw = null;
    }
    if (raw !== null) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = null; // 메인 데이터가 있지만 손상됨 -> 아래에서 백업으로 복구 시도
      }
    }
    if (parsed === null) {
      // 메인 키가 없거나 손상됨 -> 백업 키에서 복구 시도
      try {
        const backupRes = await storage.get(backupKey);
        if (backupRes) {
          try {
            parsed = JSON.parse(backupRes.value);
            if (raw !== null) setLoadWarning(true); // 메인은 손상됐지만 백업으로 복구했음을 알림
          } catch (e) {
            parsed = null;
          }
        }
      } catch (e) {
        // 백업도 못 읽음
      }
    }
    return parsed; // 진짜 처음 사용이거나 완전히 복구 불가능하면 null
  };

  useEffect(() => {
    (async () => {
      const itemsParsed = await loadWithBackup(STORAGE_KEY, STORAGE_BACKUP_KEY);
      const loadedItems = itemsParsed ? itemsParsed.map(normalizeItem) : [];
      setItems(loadedItems);
      itemsRef.current = loadedItems;
      // 정상적으로 불러온 데이터는 즉시 백업 키에도 복사해둔다 (다음 로딩 실패에 대비)
      if (itemsParsed) {
        try {
          await storage.set(STORAGE_BACKUP_KEY, JSON.stringify(loadedItems));
        } catch (e) {
          // 백업 저장 실패는 무시 (핵심 저장이 아님)
        }
      }

      const presetsParsed = await loadWithBackup(PRESET_KEY, PRESET_BACKUP_KEY);
      setPresets(presetsParsed || []);

      try {
        const res3 = await storage.get(LAST_BACKUP_KEY);
        setLastBackupAt(res3 ? res3.value : null);
      } catch (e) {
        setLastBackupAt(null);
      }

      try {
        const res4 = await storage.get(ORDER_KEY);
        setManualOrderState(res4 ? JSON.parse(res4.value) : []);
      } catch (e) {
        setManualOrderState([]);
      }
    })();
  }, []);

  const setManualOrder = (orderKeys) => {
    setManualOrderState(orderKeys);
    storage.set(ORDER_KEY, JSON.stringify(orderKeys)).catch(() => {});
  };

  const persist = async (next) => {
    setItems(next);
    itemsRef.current = next;
    const trySave = () => storage.set(STORAGE_KEY, JSON.stringify(next));
    let ok = false;
    try {
      let res = await trySave();
      if (!res) res = await trySave();
      ok = !!res;
    } catch (e) {
      try {
        const res = await trySave();
        ok = !!res;
      } catch (e2) {
        ok = false;
      }
    }
    setSaveError(!ok);
    if (ok) {
      // 메인 저장이 성공했을 때만 백업도 최신 상태로 갱신
      try {
        await storage.set(STORAGE_BACKUP_KEY, JSON.stringify(next));
      } catch (e) {
        // 백업 저장 실패는 무시
      }
    }
  };

  const persistPresets = async (next) => {
    setPresets(next);
    try {
      const res = await storage.set(PRESET_KEY, JSON.stringify(next));
      if (res) await storage.set(PRESET_BACKUP_KEY, JSON.stringify(next));
    } catch (e) {
      // 프리셋 저장 실패는 조용히 무시 (핵심 데이터가 아님)
    }
  };

  const exportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      items: itemsRef.current || [],
      presets: presets || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = todayISO().replace(/-/g, "");
    a.href = url;
    a.download = `일정관리-백업-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const now = new Date().toISOString();
    setLastBackupAt(now);
    storage.set(LAST_BACKUP_KEY, now).catch(() => {});
  };

  const importBackup = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const importedItems = Array.isArray(data.items) ? data.items.map(normalizeItem) : null;
        const importedPresets = Array.isArray(data.presets) ? data.presets : null;
        if (!importedItems) {
          window.alert("올바른 백업 파일이 아니에요.");
          return;
        }
        const ok = window.confirm(
          `이 백업 파일(${importedItems.length}개 일정)로 지금 데이터를 덮어쓸까요? 현재 데이터는 사라져요.`
        );
        if (!ok) return;
        persist(importedItems);
        if (importedPresets) persistPresets(importedPresets);
        window.alert("백업 파일을 불러왔어요.");
      } catch (err) {
        window.alert("백업 파일을 읽는 데 실패했어요.");
      }
    };
    reader.readAsText(file);
  };

  if (items === null || presets === null) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingStamp}>준비 중</div>
      </div>
    );
  }

  const today = todayISO();
  const todos = buildTodos(items, today);
  const backupOverdue =
    items.length > 0 &&
    (!lastBackupAt || diffDays(today, lastBackupAt.slice(0, 10)) >= BACKUP_REMINDER_DAYS);

  const saveItem = (item) => {
    const cur = itemsRef.current || [];
    const exists = cur.some((it) => it.id === item.id);
    persist(exists ? cur.map((it) => (it.id === item.id ? item : it)) : [...cur, item]);
    setModal(null);
  };
  const deleteItem = (id) => {
    persist((itemsRef.current || []).filter((it) => it.id !== id));
    setModal(null);
  };
  const toggleMainDone = (itemId, done) => {
    persist((itemsRef.current || []).map((it) => (it.id === itemId ? { ...it, done, doneDate: done ? today : null } : it)));
  };
  const toggleReminderDone = (itemId, reminderId, done) => {
    persist(
      (itemsRef.current || []).map((it) =>
        it.id === itemId
          ? { ...it, reminders: it.reminders.map((r) => (r.id === reminderId ? { ...r, done, doneDate: done ? today : null } : r)) }
          : it
      )
    );
  };
  const togglePinned = (itemId) => {
    persist((itemsRef.current || []).map((it) => (it.id === itemId ? { ...it, pinned: !it.pinned } : it)));
  };
  const restoreItem = (itemId) => {
    persist((itemsRef.current || []).map((it) => (it.id === itemId ? { ...it, done: false, doneDate: null } : it)));
  };
  const toggleDailyDone = (itemId, done) => {
    persist((itemsRef.current || []).map((it) => (it.id === itemId ? { ...it, lastDoneDate: done ? today : null } : it)));
  };
  const savePreset = (preset) => persistPresets([...presets, preset]);
  const deletePreset = (id) => persistPresets(presets.filter((p) => p.id !== id));

  return (
    <div style={styles.app}>
      <style>{`
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
        html, body { margin: 0; overflow-x: hidden; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea { font-family: inherit; max-width: 100%; }
        ::placeholder { color: #A8AFB8; }
        .scrollbox::-webkit-scrollbar { width: 6px; }
        .scrollbox::-webkit-scrollbar-thumb { background: #DDE2E7; border-radius: 3px; }
      `}</style>

      {!modal && (
        <div style={styles.header}>
          <div style={styles.headerTopRow}>
            <div>
              <div style={styles.dateBig}>{fmtFullWithYear(today)}</div>
              <div style={styles.subLabel}>{view === "list" ? `할 일 ${todos.length}건` : "달력"}</div>
            </div>
            <button onClick={() => setModal({ mode: "backup" })} style={styles.headerBackupBtn} aria-label="백업">
              <ShieldCheck size={18} color="#5B6470" />
              {backupOverdue && <span style={styles.headerBackupDot} />}
            </button>
          </div>
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
      )}

      <div style={styles.body} className="scrollbox">
        {modal && modal.mode === "backup" ? (
          <BackupScreen
            lastBackupAt={lastBackupAt}
            itemCount={items.length}
            onClose={() => setModal(null)}
            onExport={exportBackup}
            onImport={importBackup}
          />
        ) : modal && modal.mode === "view" ? (
          <ViewModal
            item={modal.item}
            today={today}
            onClose={() => setModal(null)}
            onEdit={(item) => setModal({ mode: "edit", item })}
            onSave={saveItem}
          />
        ) : modal ? (
          <EventModal
            mode={modal.mode}
            initialItem={modal.item}
            today={today}
            defaultDate={modal.defaultDate}
            presets={presets}
            items={items}
            onClose={() => setModal(null)}
            onSave={saveItem}
            onDelete={deleteItem}
            onSavePreset={savePreset}
            onDeletePreset={deletePreset}
          />
        ) : view === "list" ? (
          <ListView
            todos={todos}
            today={today}
            onToggleMain={toggleMainDone}
            onToggleReminder={toggleReminderDone}
            onToggleDaily={toggleDailyDone}
            onView={(t) => setModal({ mode: "view", item: items.find((it) => it.id === t.itemId) })}
            onEdit={(t) => setModal({ mode: "edit", item: items.find((it) => it.id === t.itemId) })}
            onDelete={deleteItem}
            onPin={togglePinned}
            manualOrder={manualOrder}
            onReorder={setManualOrder}
          />
        ) : (
          <CalendarView
            items={items}
            today={today}
            onView={(item) => setModal({ mode: "view", item })}
            onEdit={(item) => setModal({ mode: "edit", item })}
            onRestore={restoreItem}
            onSelectDate={setCalendarDate}
          />
        )}
      </div>

      {saveError && (
        <div style={styles.saveErrorBar}>
          <AlertTriangle size={14} style={{ marginRight: 6 }} /> 저장에 실패했어요. 변경사항이 기기에만 남아있을 수 있어요.
        </div>
      )}
      {loadWarning && (
        <div style={styles.loadWarningBar}>
          <AlertTriangle size={14} style={{ marginRight: 6 }} />
          저장된 데이터를 불러오는 데 문제가 있어 백업본으로 복구했어요. 최근 변경사항이 빠졌을 수 있어요.
          <button onClick={() => setLoadWarning(false)} style={styles.loadWarningCloseBtn}>
            <X size={13} color="#96691C" />
          </button>
        </div>
      )}

      {!modal && (
        <button
          onClick={() => setModal({ mode: "new", defaultDate: view === "calendar" ? calendarDate || today : today })}
          style={styles.fab}
          aria-label="일정 추가"
        >
          <Plus size={24} color="#fff" />
        </button>
      )}
    </div>
  );
}

// ---------- 리스트 뷰 ----------
function ListView({ todos, today, onToggleMain, onToggleReminder, onToggleDaily, onView, onEdit, onDelete, onPin, manualOrder, onReorder }) {
  const keyOf = (t) => `${t.itemId}:${t.reminderId || "main"}`;
  const notDone = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  const notDoneKeys = notDone.map(keyOf);
  const notDoneKeysJoined = notDoneKeys.join(",");
  const todoMap = {};
  notDone.forEach((t) => (todoMap[keyOf(t)] = t));
  const pinnedSignature = notDone.map((t) => (t.pinned ? "1" : "0")).join("");

  const [order, setOrder] = useState(() => {
    const validManual = (manualOrder || []).filter((k) => notDoneKeys.includes(k));
    const added = notDoneKeys.filter((k) => !validManual.includes(k));
    const merged = [...validManual, ...added];
    const pinnedKeys = merged.filter((k) => todoMap[k] && todoMap[k].pinned);
    const restKeys = merged.filter((k) => !(todoMap[k] && todoMap[k].pinned));
    return [...pinnedKeys, ...restKeys];
  });
  useEffect(() => {
    setOrder((prev) => {
      const stillValid = prev.filter((k) => notDoneKeys.includes(k));
      const added = notDoneKeys.filter((k) => !stillValid.includes(k));
      const merged = [...stillValid, ...added];
      // 고정된 항목은 항상 맨 위로 올라오게 함
      const pinnedKeys = merged.filter((k) => todoMap[k] && todoMap[k].pinned);
      const restKeys = merged.filter((k) => !(todoMap[k] && todoMap[k].pinned));
      return [...pinnedKeys, ...restKeys];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notDoneKeysJoined, pinnedSignature]);

  const rowRefs = useRef({});
  const orderRef = useRef(order);
  orderRef.current = order;
  const dragInfo = useRef({ key: null, timer: null, dragging: false, startX: 0, startY: 0 });
  const [draggingKey, setDraggingKey] = useState(null);
  const [dragY, setDragY] = useState(0);

  const onWindowTouchMove = (e) => {
    const touch = e.touches[0];
    const key = dragInfo.current.key;
    if (!key) return;
    const dy0 = touch.clientY - dragInfo.current.startY;
    const dx0 = touch.clientX - dragInfo.current.startX;
    if (!dragInfo.current.dragging) {
      // 어느 방향이든(특히 좌우 스와이프) 조금이라도 움직이면 순서변경 시도를 취소해서
      // 스와이프(수정/삭제/고정)와 절대 겹치지 않도록 함
      if (Math.abs(dy0) > 8 || Math.abs(dx0) > 8) cleanupDrag();
      return;
    }
    setDragY(touch.clientY - dragInfo.current.startY);
    const curOrder = orderRef.current;
    const idx = curOrder.indexOf(key);
    for (let i = 0; i < curOrder.length; i++) {
      if (i === idx) continue;
      const el = rowRefs.current[curOrder[i]];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if ((i < idx && touch.clientY < mid) || (i > idx && touch.clientY > mid)) {
        const newOrder = [...curOrder];
        const [item] = newOrder.splice(idx, 1);
        newOrder.splice(i, 0, item);
        setOrder(newOrder);
        break;
      }
    }
  };
  const onWindowTouchEnd = () => {
    if (dragInfo.current.dragging) {
      onReorder(orderRef.current);
    }
    cleanupDrag();
  };
  const cleanupDrag = () => {
    clearTimeout(dragInfo.current.timer);
    window.removeEventListener("touchmove", onWindowTouchMove);
    window.removeEventListener("touchend", onWindowTouchEnd);
    window.removeEventListener("touchcancel", onWindowTouchEnd);
    dragInfo.current.dragging = false;
    dragInfo.current.key = null;
    setDraggingKey(null);
    setDragY(0);
  };
  const startLongPress = (key, clientX, clientY) => {
    dragInfo.current.key = key;
    dragInfo.current.startX = clientX;
    dragInfo.current.startY = clientY;
    dragInfo.current.dragging = false;
    window.addEventListener("touchmove", onWindowTouchMove, { passive: true });
    window.addEventListener("touchend", onWindowTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onWindowTouchEnd, { passive: true });
    dragInfo.current.timer = setTimeout(() => {
      dragInfo.current.dragging = true;
      setDraggingKey(key);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 450);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("touchmove", onWindowTouchMove);
      window.removeEventListener("touchend", onWindowTouchEnd);
      window.removeEventListener("touchcancel", onWindowTouchEnd);
      clearTimeout(dragInfo.current.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderCard = (t) => {
    const isDaily = t.kind === "daily";
    const dday = isDaily ? null : dDayLabel(t.itemDate, today);
    const isPastOrToday = !isDaily && (dday === "D-DAY" || dday.startsWith("D+"));
    return (
      <SwipeRow
        pinned={t.pinned}
        onEdit={() => onEdit(t)}
        onDelete={() => {
          if (window.confirm("이 일정을 삭제할까요?")) onDelete(t.itemId);
        }}
        onPin={() => onPin(t.itemId)}
      >
        <div style={styles.card}>
          <button
            onClick={() => {
              if (isDaily) {
                onToggleDaily(t.itemId, !t.done);
                return;
              }
              if (t.done) {
                t.kind === "main" ? onToggleMain(t.itemId, false) : onToggleReminder(t.itemId, t.reminderId, false);
                return;
              }
              t.kind === "main" ? onToggleMain(t.itemId, true) : onToggleReminder(t.itemId, t.reminderId, true);
            }}
            style={{ ...styles.checkCircle, background: t.done ? "#0D9488" : "transparent", borderColor: t.done ? "#0D9488" : "#D7DCE1" }}
            aria-label="완료 처리"
          >
            <Check size={13} color={t.done ? "#fff" : "transparent"} />
          </button>
          <div style={styles.cardBody} onClick={() => onView(t)}>
            <div style={styles.cardLine1}>
              <span style={styles.cardTitleWrap}>
                {t.pinned && <Pin size={12} color="#8A93A0" style={{ marginRight: 4, verticalAlign: -1 }} />}
                <span style={{ ...styles.stepLabel, textDecoration: t.done ? "line-through" : "none", color: t.done ? "#9AA3AF" : "#1F2937" }}>{t.label}</span>
                {t.kind === "reminder" && <span style={styles.relatedParens}> (메인: {t.itemTitle})</span>}
              </span>
              {isDaily ? (
                t.done ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDaily(t.itemId, false);
                    }}
                    style={styles.restoreBtn}
                  >
                    <RotateCcw size={12} style={{ marginRight: 4 }} />
                    복귀
                  </button>
                ) : (
                  <span style={{ ...styles.ddayText, color: "#7C3AED" }}>매일</span>
                )
              ) : t.done ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    t.kind === "main" ? onToggleMain(t.itemId, false) : onToggleReminder(t.itemId, t.reminderId, false);
                  }}
                  style={styles.restoreBtn}
                >
                  <RotateCcw size={12} style={{ marginRight: 4 }} />
                  복귀
                </button>
              ) : (
                <span style={{ ...styles.ddayText, color: isPastOrToday ? "#DC5B45" : "#16A34A" }}>{dday}</span>
              )}
            </div>
            <div style={styles.metaRow}>
              {isDaily ? (
                <span>매일 반복 · 지울 때까지 계속 표시돼요</span>
              ) : (
                <span>{fmtMD(t.occurDate)}{t.time && t.time !== "00:00" ? ` ${t.time}` : ""}</span>
              )}
              {t.kind === "reminder" && (
                <>
                  <span style={styles.dot}>·</span>
                  <span style={{ color: t.direction === "after" ? "#B45309" : "#8A93A0" }}>
                    {t.direction === "after" ? `후속 조치 D+${t.days}` : `사전 준비 D-${t.days}`}
                  </span>
                </>
              )}
              {t.checklist.length > 0 && (
                <span style={styles.checklistMeta}>
                  <CheckSquare size={12} />
                </span>
              )}
              {t.note && t.note.trim() && (
                <span style={styles.noteMeta}>
                  <FileText size={12} />
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={16} color="#A8AFB8" onClick={() => onView(t)} style={{ cursor: "pointer", flexShrink: 0 }} />
        </div>
      </SwipeRow>
    );
  };

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
      {order.map((key) => {
        const t = todoMap[key];
        if (!t) return null;
        const isDragging = draggingKey === key;
        return (
          <div
            key={key}
            ref={(el) => (rowRefs.current[key] = el)}
            onTouchStart={(e) => startLongPress(key, e.touches[0].clientX, e.touches[0].clientY)}
            style={{
              transform: isDragging ? `translateY(${dragY}px) scale(1.02)` : "none",
              position: isDragging ? "relative" : "static",
              zIndex: isDragging ? 5 : "auto",
              boxShadow: isDragging ? "0 8px 20px rgba(15,23,42,0.18)" : "none",
              borderRadius: 14,
              transition: isDragging ? "none" : "transform 0.15s",
            }}
          >
            {renderCard(t)}
          </div>
        );
      })}
      {done.map((t) => (
        <div key={keyOf(t)}>{renderCard(t)}</div>
      ))}
    </div>
  );
}

// ---------- 스와이프 (왼쪽: 수정/삭제, 오른쪽: 고정) ----------
function SwipeRow({ children, pinned, onEdit, onDelete, onPin }) {
  const [x, setX] = useState(0);
  const dragRef = useRef({ startX: 0, dragging: false, moved: false });
  const LEFT_OPEN = -144; // 수정 + 삭제
  const RIGHT_OPEN = 72; // 고정

  const onTouchStart = (e) => {
    dragRef.current.startX = e.touches[0].clientX;
    dragRef.current.dragging = true;
    dragRef.current.moved = false;
    dragRef.current.base = x;
  };
  const onTouchMove = (e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.touches[0].clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) dragRef.current.moved = true;
    let next = dragRef.current.base + dx;
    if (next < LEFT_OPEN) next = LEFT_OPEN + (next - LEFT_OPEN) * 0.2;
    if (next > RIGHT_OPEN) next = RIGHT_OPEN + (next - RIGHT_OPEN) * 0.2;
    setX(next);
  };
  const onTouchEnd = () => {
    dragRef.current.dragging = false;
    if (x <= LEFT_OPEN / 2) setX(LEFT_OPEN);
    else if (x >= RIGHT_OPEN / 2) setX(RIGHT_OPEN);
    else setX(0);
  };
  const close = () => setX(0);

  return (
    <div style={styles.swipeWrap}>
      <div style={styles.swipeRightActions}>
        <button
          onClick={() => {
            onEdit();
            close();
          }}
          style={{ ...styles.swipeActionBtn, background: "#0D9488" }}
        >
          <Pencil size={16} />
          수정
        </button>
        <button
          onClick={() => {
            onDelete();
            close();
          }}
          style={{ ...styles.swipeActionBtn, background: "#DC5B45" }}
        >
          <Trash2 size={16} />
          삭제
        </button>
      </div>
      <div style={styles.swipeLeftActions}>
        <button
          onClick={() => {
            onPin();
            close();
          }}
          style={styles.swipePinBtn}
        >
          <Pin size={18} color={pinned ? "#0D9488" : "#5B6470"} />
        </button>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={(e) => {
          if (dragRef.current.moved) {
            e.stopPropagation();
            dragRef.current.moved = false;
          }
        }}
        style={{
          ...styles.swipeContent,
          transform: `translateX(${x}px)`,
          transition: dragRef.current.dragging ? "none" : "transform 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------- 달력 뷰 (간단) ----------
function CalendarView({ items, today, onView, onEdit, onRestore, onSelectDate }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(today + "T00:00:00");
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelectedRaw] = useState(today);
  const [query, setQuery] = useState("");
  const setSelected = (iso) => {
    setSelectedRaw(iso);
    onSelectDate && onSelectDate(iso);
  };

  useEffect(() => {
    onSelectDate && onSelectDate(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemsByDate = {};
  items.forEach((it) => {
    if (!itemsByDate[it.date]) itemsByDate[it.date] = [];
    itemsByDate[it.date].push(it);
  });
  const reminderDates = new Set();
  items.forEach((it) => {
    (it.reminders || []).forEach((r) => {
      reminderDates.add(r.direction === "after" ? addDays(it.date, r.days ?? 0) : addDays(it.date, -(r.days ?? 0)));
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

  const searchResults = query.trim()
    ? items
        .filter((it) => it.title.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    : [];

  const selectSearchResult = (it) => {
    setQuery("");
    onView(it);
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

      <div style={styles.calSearchWrap}>
        <div style={styles.calSearchRow}>
          <Search size={15} color="#9AA3AF" style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="일정명 검색 (지난 일정 포함 전체)"
            style={styles.calSearchInput}
          />
          {query && (
            <button onClick={() => setQuery("")} style={styles.calSearchClearBtn}>
              <X size={13} color="#8A93A0" />
            </button>
          )}
        </div>
        {query.trim() && (
          <div style={styles.calSearchDropdown}>
            {searchResults.length === 0 && <div style={styles.calEmptyText}>"{query}"와 일치하는 일정이 없어요.</div>}
            {searchResults.map((it) => (
              <div key={it.id} style={styles.calSearchResultRow} onClick={() => selectSearchResult(it)}>
                <span style={{ fontSize: 12.5, color: "#9AA3AF", flexShrink: 0 }}>{fmtMD(it.date)}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, textDecoration: it.done ? "line-through" : "none", color: it.done ? "#9AA3AF" : "#1F2937" }}>
                  {it.title}
                </span>
                <ChevronRight size={15} color="#A8AFB8" />
              </div>
            ))}
          </div>
        )}
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
        {selectedItems.map((it) => {
          const itDday = dDayLabel(it.date, today);
          const itPastOrToday = itDday === "D-DAY" || itDday.startsWith("D+");
          return (
          <div key={it.id} style={styles.calEventBanner} onClick={() => onView(it)}>
            <span style={{ ...styles.ddayText, fontSize: 13, color: it.done ? "#9AA3AF" : itPastOrToday ? "#DC5B45" : "#16A34A" }}>{itDday}</span>
            <span style={{ ...styles.calEventBannerText, textDecoration: it.done ? "line-through" : "none", color: it.done ? "#9AA3AF" : "#1F2937" }}>
              {it.title}
            </span>
            {it.done ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("다시 할 일 목록에 넣을까요?")) onRestore(it.id);
                }}
                style={styles.calEventEditBtn}
                aria-label="할 일로 복구"
              >
                <RotateCcw size={13} color="#0D9488" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(it);
                }}
                style={styles.calEventEditBtn}
                aria-label="일정 수정"
              >
                <Pencil size={13} color="#8A93A0" />
              </button>
            )}
          </div>
          );
        })}
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

// ---------- 일정 상세 보기 (읽기 전용 + 체크리스트 체크는 가능) ----------
// ---------- 백업 관리 화면 ----------
function BackupScreen({ lastBackupAt, itemCount, onClose, onExport, onImport }) {
  const fileInputRef = useRef(null);
  const lastBackupText = lastBackupAt
    ? fmtFull(lastBackupAt.slice(0, 10)) + ` ${lastBackupAt.slice(11, 16)}`
    : "아직 백업한 적 없어요";

  return (
    <div style={styles.page}>
      <div style={styles.pageHeaderRow}>
        <button onClick={onClose} style={styles.iconBtnLarge}>
          <X size={20} color="#5B6470" />
        </button>
        <div style={styles.modalTitle}>백업 관리</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={styles.viewSection}>
        <div style={styles.viewSectionLabel}>마지막 백업</div>
        <div style={styles.viewNoteText}>{lastBackupText}</div>
      </div>

      <div style={styles.viewSection}>
        <div style={styles.viewSectionLabel}>백업 파일 만들기</div>
        <div style={{ fontSize: 12.5, color: "#8A93A0", marginBottom: 10, lineHeight: 1.5 }}>
          현재 일정 {itemCount}개를 파일로 저장해요. 만들어진 파일은 아이폰의 "파일" 앱이나 아이클라우드에 보관해두면, 브라우저 저장공간에 문제가 생겨도 이 파일로 복구할 수 있어요.
        </div>
        <button onClick={onExport} style={styles.registerPresetBtn}>
          <Download size={14} style={{ marginRight: 6 }} />
          지금 백업 파일 만들기
        </button>
      </div>

      <div style={styles.viewSection}>
        <div style={styles.viewSectionLabel}>백업 파일 불러오기</div>
        <div style={{ fontSize: 12.5, color: "#8A93A0", marginBottom: 10, lineHeight: 1.5 }}>
          이전에 만들어둔 백업 파일을 선택하면 지금 데이터를 그 내용으로 되돌려요. (현재 데이터는 사라져요)
        </div>
        <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={styles.registerChecklistBtn}>
          <Upload size={14} style={{ marginRight: 6 }} />
          백업 파일 선택해서 불러오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            if (file) onImport(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}


function ViewModal({ item, today, onClose, onEdit, onSave }) {
  const dday = dDayLabel(item.date, today);
  const isPastOrToday = dday === "D-DAY" || dday.startsWith("D+");
  const touchRef = useRef({ startY: 0, startX: 0 });

  const onTouchStart = (e) => {
    touchRef.current.startY = e.touches[0].clientY;
    touchRef.current.startX = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    const dx = Math.abs(e.changedTouches[0].clientX - touchRef.current.startX);
    if (dy > 90 && dx < 60) onClose();
  };

  const toggleChecklistItem = (id) => {
    onSave({
      ...item,
      checklist: (item.checklist || []).map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)),
    });
  };

  return (
    <div style={styles.page} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div style={styles.pageHandle} />
      <div style={styles.pageHeaderRow}>
        <button onClick={onClose} style={styles.iconBtnLarge}>
          <X size={20} color="#5B6470" />
        </button>
        <div style={styles.modalTitle}>일정 보기</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={styles.viewDdayRow}>
        {item.recurring ? (
          <span style={{ ...styles.ddayText, fontSize: 16, color: "#7C3AED" }}>매일</span>
        ) : (
          <span style={{ ...styles.ddayText, fontSize: 16, color: isPastOrToday ? "#DC5B45" : "#16A34A" }}>{dday}</span>
        )}
        {item.pinned && <Pin size={14} color="#8A93A0" />}
      </div>
      <div style={styles.viewTitleText}>{item.title}</div>
      <div style={styles.viewDateText}>
        {item.recurring
          ? "매일 반복 · 지울 때까지 계속 표시돼요"
          : `${fmtFull(item.date)}${item.time && item.time !== "00:00" ? ` ${item.time}` : ""}`}
      </div>

      {item.note && item.note.trim() && (
        <div style={styles.viewSection}>
          <div style={styles.viewSectionLabel}>메모</div>
          <div style={styles.viewNoteText}>{item.note}</div>
        </div>
      )}

      {item.checklist && item.checklist.length > 0 && (
        <div style={styles.viewSection}>
          <div style={styles.viewSectionLabel}>체크리스트</div>
          {item.checklist.map((c) => (
            <div key={c.id} style={styles.checklistEditorRow} onClick={() => toggleChecklistItem(c.id)}>
              <button
                style={{ ...styles.checkCircleSmall, background: c.checked ? "#0D9488" : "#fff", borderColor: c.checked ? "#0D9488" : "#D7DCE1" }}
              >
                {c.checked && <Check size={11} color="#fff" />}
              </button>
              <span style={{ ...styles.checklistEditorText, textDecoration: c.checked ? "line-through" : "none", color: c.checked ? "#9AA3AF" : "#1F2937" }}>
                {c.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {item.reminders && item.reminders.length > 0 && (
        <div style={styles.viewSection}>
          <div style={styles.viewSectionLabel}>딸림 일정</div>
          {item.reminders.map((r) => (
            <div key={r.id} style={styles.viewReminderRow}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: r.direction === "after" ? "#B45309" : "#5B6470", flexShrink: 0 }}>
                {r.direction === "after" ? `D+${r.days}` : `D-${r.days}`}
              </span>
              <span style={{ flex: 1, fontSize: 14, textDecoration: r.done ? "line-through" : "none", color: r.done ? "#9AA3AF" : "#1F2937" }}>
                {r.label}
              </span>
              {r.done && <Check size={14} color="#0D9488" />}
            </div>
          ))}
        </div>
      )}

      <div style={styles.pageFooterSticky}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.viewCloseBtn} onClick={onClose}>
            닫기
          </button>
          <button style={{ ...styles.doneBtn, flex: 1 }} onClick={() => onEdit(item)}>
            <Pencil size={15} style={{ marginRight: 6 }} />
            수정하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 일정 추가/수정 모달 ----------
function EventModal({ mode, initialItem, today, defaultDate, presets, items, onClose, onSave, onDelete, onSavePreset, onDeletePreset }) {
  const [title, setTitle] = useState(initialItem?.title || "");
  const [debouncedTitle, setDebouncedTitle] = useState(title);
  const [titleSuggestOpen, setTitleSuggestOpen] = useState(false);
  const [note, setNote] = useState(initialItem?.note || "");
  const [recurring, setRecurring] = useState(initialItem?.recurring || false);
  const [date, setDate] = useState(initialItem?.date || defaultDate || today);
  const [time, setTime] = useState(initialItem?.time || nowHHMM());
  const [checklist, setChecklist] = useState(initialItem?.checklist || []);
  const [checklistOpen, setChecklistOpen] = useState(!!(initialItem?.checklist && initialItem.checklist.length));
  const [reminders, setReminders] = useState(() =>
    (initialItem?.reminders || []).map((r) => ({
      id: r.id,
      days: r.days ?? 1,
      direction: r.direction || "before",
      label: r.label,
      done: r.done || false,
    }))
  );
  const [managePresets, setManagePresets] = useState(false);
  const [appliedPresetId, setAppliedPresetId] = useState(null);
  const firstInput = useRef(null);

  useLayoutEffect(() => {
    firstInput.current && firstInput.current.focus();
  }, []);

  const updateReminder = (id, field, val) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };
  const addReminder = () => setReminders([...reminders, { id: uid(), days: 1, direction: "before", label: "", done: false }]);
  const removeReminder = (id) => setReminders(reminders.filter((r) => r.id !== id));

  // 일정명 자동완성: 타이핑 멈추고 0.15초 후에만 검색 (데이터 많아도 버벅이지 않도록)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(title), 150);
    return () => clearTimeout(t);
  }, [title]);

  const titleSuggestions = (() => {
    const q = debouncedTitle.trim().toLowerCase();
    if (!q || !titleSuggestOpen) return [];
    const seen = new Set();
    const matches = [];
    for (const it of items || []) {
      if (initialItem && it.id === initialItem.id) continue; // 지금 수정 중인 항목 자신은 제외
      const candidates = [it.title, ...(it.reminders || []).map((r) => r.label)];
      for (const text of candidates) {
        if (!text || !text.toLowerCase().includes(q)) continue;
        if (seen.has(text)) continue;
        seen.add(text);
        matches.push({ text, date: it.date });
      }
    }
    matches.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 최근 날짜 우선
    return matches.slice(0, 5);
  })();

  const applyPreset = (p) => {
    const hasExisting = checklist.length > 0 || reminders.some((r) => r.label.trim());
    if (hasExisting) {
      const ok = window.confirm("이미 입력된 체크리스트/딸림 일정이 프리셋 내용으로 덮어씌워져요. 계속할까요?");
      if (!ok) return;
    }
    setChecklist((p.checklist || []).map((c) => ({ id: uid(), text: c.text, checked: false })));
    setChecklistOpen((p.checklist || []).length > 0);
    setReminders((p.reminders || []).map((r) => ({ id: uid(), days: r.days, direction: r.direction || "before", label: r.label, done: false })));
    setAppliedPresetId(p.id);
  };

  const [presetPrompt, setPresetPrompt] = useState(null); // null | { reminders, checklistToSave }

  const registerPreset = () => {
    const cleanReminders = reminders
      .filter((r) => r.label.trim())
      .map((r) => ({ days: Number(r.days) || 0, direction: r.direction === "after" ? "after" : "before", label: r.label.trim() }));
    const cleanChecklist = checklist.filter((c) => c.text.trim()).map((c) => ({ text: c.text.trim() }));
    if (cleanReminders.length === 0 && cleanChecklist.length === 0) {
      window.alert("프리셋으로 저장할 체크리스트나 딸림 일정이 없어요.");
      return;
    }
    const ok = window.confirm("체크리스트와 딸림 일정 구성을 프리셋으로 저장하시겠습니까?");
    if (!ok) return;
    setPresetPrompt({
      reminders: cleanReminders,
      checklistToSave: cleanChecklist,
    });
  };

  const confirmPresetName = (name) => {
    if (!name || !name.trim() || !presetPrompt) {
      setPresetPrompt(null);
      return;
    }
    onSavePreset({
      id: uid(),
      name: name.trim(),
      checklist: presetPrompt.checklistToSave,
      reminders: presetPrompt.reminders,
    });
    setPresetPrompt(null);
  };

  const hasSubNow = reminders.some((r) => r.label.trim()) || checklist.some((c) => c.text.trim());
  const canSave = title.trim() && (recurring || date);

  const save = () => {
    if (!canSave) return;
    onSave({
      id: initialItem?.id || uid(),
      title: title.trim(),
      note: note.trim(),
      date: recurring ? initialItem?.date || today : date,
      time: recurring ? "00:00" : time || "00:00",
      recurring,
      lastDoneDate: initialItem?.lastDoneDate || null,
      done: initialItem?.done || false,
      pinned: initialItem?.pinned || false,
      checklist,
      reminders: recurring
        ? []
        : reminders
            .filter((r) => r.label.trim())
            .map((r) => ({
              id: r.id,
              days: Number(r.days) || 0,
              direction: r.direction === "after" ? "after" : "before",
              label: r.label.trim(),
              done: r.done || false,
              checklist: [],
            })),
    });
  };

  const warning = recurring ? null : getDateWarning(date);

  const hasUnsavedChanges = () => {
    const curChecklist = checklist.map((c) => ({ text: (c.text || "").trim(), checked: !!c.checked }));
    const curReminders = reminders
      .filter((r) => r.label.trim())
      .map((r) => ({ days: Number(r.days) || 0, direction: r.direction === "after" ? "after" : "before", label: r.label.trim(), done: !!r.done }));
    if (mode === "edit" && initialItem) {
      const initChecklist = (initialItem.checklist || []).map((c) => ({ text: (c.text || "").trim(), checked: !!c.checked }));
      const initReminders = (initialItem.reminders || []).map((r) => ({
        days: r.days ?? 0,
        direction: r.direction === "after" ? "after" : "before",
        label: r.label,
        done: !!r.done,
      }));
      return (
        title.trim() !== (initialItem.title || "") ||
        note.trim() !== (initialItem.note || "") ||
        recurring !== !!initialItem.recurring ||
        date !== initialItem.date ||
        time !== (initialItem.time || "00:00") ||
        JSON.stringify(curChecklist) !== JSON.stringify(initChecklist) ||
        JSON.stringify(curReminders) !== JSON.stringify(initReminders)
      );
    }
    return recurring || title.trim() !== "" || note.trim() !== "" || curChecklist.length > 0 || curReminders.length > 0;
  };

  const handleClose = () => {
    if (hasUnsavedChanges() && !window.confirm("입력한 내용이 있어요. 취소하시겠습니까?")) return;
    onClose();
  };

  const touchRef = useRef({ startX: 0, startY: 0 });
  const onPageTouchStart = (e) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };
  const onPageTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.startY);
    if (dx > 90 && dy < 60) handleClose();
  };

  return (
    <div style={styles.page} onTouchStart={onPageTouchStart} onTouchEnd={onPageTouchEnd}>
      <div style={styles.pageHeaderRow}>
        <button onClick={handleClose} style={styles.iconBtn}>
          <X size={18} color="#5B6470" />
        </button>
        <div style={styles.modalTitle}>{mode === "edit" ? "일정 수정" : "새 일정 추가"}</div>
        <div style={{ width: 30 }} />
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={styles.tplHeaderRow}>
          <label style={{ ...styles.formLabel, marginTop: 12 }}>프리셋 불러오기</label>
          {presets.length > 0 && (
            <button onClick={() => setManagePresets(!managePresets)} style={styles.tplManageBtn}>
              {managePresets ? "완료" : "관리"}
            </button>
          )}
        </div>
        {presets.length === 0 ? (
          <div style={styles.tplHint}>
            아직 저장된 프리셋이 없어요. 체크리스트나 딸림 일정을 채운 뒤 아래 "프리셋으로 저장"을 누르면 다음부터 여기서 바로 불러올 수 있어요.
          </div>
        ) : (
          <>
            <div style={styles.tplChipRow}>
              {presets.map((p) => (
                <div key={p.id} style={styles.tplChipWrap}>
                  <button
                    onClick={() => (managePresets ? null : applyPreset(p))}
                    style={{
                      ...styles.tplChip,
                      borderColor: appliedPresetId === p.id ? "#1F2937" : "#E5E9EC",
                      background: appliedPresetId === p.id ? "#1F2937" : "#fff",
                      color: appliedPresetId === p.id ? "#fff" : "#4A4536",
                    }}
                  >
                    {p.name}
                    <span style={{ opacity: 0.6, fontWeight: 500 }}> · {(p.reminders || []).length}단계</span>
                  </button>
                  {managePresets && (
                    <button onClick={() => onDeletePreset(p.id)} style={styles.tplDeleteBtn}>
                      <Trash2 size={12} color="#DC5B45" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {appliedPresetId && !managePresets && (
              <div style={styles.tplHint}>프리셋 내용이 채워졌어요. 제목이나 세부 내용은 자유롭게 고쳐보세요.</div>
            )}
          </>
        )}
      </div>

      <label style={styles.formLabel}>일정명</label>
      <div style={{ position: "relative" }}>
        <input
          ref={firstInput}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleSuggestOpen(true);
          }}
          onFocus={() => setTitleSuggestOpen(true)}
          onBlur={() => setTimeout(() => setTitleSuggestOpen(false), 120)}
          placeholder="일정명을 입력하세요"
          style={styles.formInput}
        />
        {titleSuggestions.length > 0 && (
          <div style={styles.titleSuggestDropdown}>
            {titleSuggestions.map((s) => (
              <div
                key={s.text}
                style={styles.titleSuggestRow}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTitle(s.text);
                  setTitleSuggestOpen(false);
                }}
              >
                <span style={styles.titleSuggestText}>{s.text}</span>
                <span style={styles.titleSuggestDate}>{fmtMD(s.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <label style={styles.formLabel}>메모</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모를 입력하세요 (선택)"
        style={styles.noteTextarea}
      />

      <div style={styles.recurringRow} onClick={() => setRecurring(!recurring)}>
        <div style={{ ...styles.toggleTrack, background: recurring ? "#0D9488" : "#D7DCE1" }}>
          <div style={{ ...styles.toggleThumb, transform: recurring ? "translateX(18px)" : "translateX(0)" }} />
        </div>
        <span style={styles.recurringLabel}>매일 반복 (날짜 없이, 지울 때까지 계속 떠요)</span>
      </div>

      {!recurring && (
        <>
          <label style={styles.formLabel}>날짜</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...styles.formInput, flex: 2 }} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...styles.formInput, flex: 1 }} />
          </div>
          {warning && (
            <div style={styles.dateWarningRow}>
              <AlertTriangle size={13} style={{ marginRight: 5 }} />
              이 날짜는 {warning.label}이에요.
            </div>
          )}
        </>
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

      {!recurring && (
        <>
          {reminders.map((r) => (
            <div key={r.id} style={styles.reminderBlock}>
              <div style={styles.stepEditRow}>
                <input
                  type="number"
                  min="0"
                  value={r.days}
                  onChange={(e) => updateReminder(r.id, "days", e.target.value)}
                  style={styles.dayInput}
                />
                <div style={styles.directionToggle}>
                  <button
                    onClick={() => updateReminder(r.id, "direction", "before")}
                    style={{ ...styles.directionBtn, ...(r.direction !== "after" ? styles.directionBtnActive : {}) }}
                  >
                    일 전
                  </button>
                  <button
                    onClick={() => updateReminder(r.id, "direction", "after")}
                    style={{ ...styles.directionBtn, ...(r.direction === "after" ? styles.directionBtnActiveAfter : {}) }}
                  >
                    일 후
                  </button>
                </div>
                <button onClick={() => removeReminder(r.id)} style={styles.stepRemoveBtn}>
                  <X size={14} color="#A8AFB8" />
                </button>
              </div>
              <input
                value={r.label}
                onChange={(e) => updateReminder(r.id, "label", e.target.value)}
                placeholder={r.direction === "after" ? "후속 조치 내용" : "할 일"}
                style={{ ...styles.stepLabelInput, width: "100%", marginTop: 6 }}
              />
            </div>
          ))}
          <button onClick={addReminder} style={styles.registerChecklistBtn}>
            <Plus size={14} style={{ marginRight: 6 }} />
            관련 디데이 추가
          </button>
        </>
      )}

      {hasSubNow && (
        <button onClick={registerPreset} style={styles.registerPresetBtn}>
          <Check size={14} style={{ marginRight: 6 }} />
          프리셋으로 저장
        </button>
      )}

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

      <div style={styles.pageFooterSticky}>
        <button style={{ ...styles.doneBtn, opacity: canSave ? 1 : 0.4 }} onClick={save} disabled={!canSave}>
          {mode === "edit" ? "수정 완료" : "일정 저장"}
        </button>
      </div>

      {presetPrompt && (
        <NamePromptModal
          title="프리셋 이름을 입력하세요"
          defaultValue={title}
          onCancel={() => setPresetPrompt(null)}
          onConfirm={confirmPresetName}
        />
      )}
    </div>
  );
}

// ---------- 이름 입력용 커스텀 프롬프트 (네이티브 prompt는 키보드 자동 표시가 안 되는 기기가 있어 자체 구현) ----------
function NamePromptModal({ title, defaultValue, onCancel, onConfirm }) {
  const [value, setValue] = useState(defaultValue || "");
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  return (
    <div style={styles.namePromptOverlay} onClick={onCancel}>
      <div style={styles.namePromptCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.namePromptTitle}>{title}</div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm(value)}
          style={styles.formInput}
        />
        <div style={styles.namePromptBtnRow}>
          <button onClick={onCancel} style={styles.namePromptCancelBtn}>
            취소
          </button>
          <button onClick={() => onConfirm(value)} style={styles.namePromptConfirmBtn}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 스타일 ----------
const styles = {
  namePromptOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,32,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 },
  namePromptCard: { background: "#fff", borderRadius: 16, padding: "20px 18px", width: "100%", maxWidth: 320 },
  namePromptTitle: { fontSize: 14.5, fontWeight: 700, color: "#1F2937", marginBottom: 12 },
  namePromptBtnRow: { display: "flex", gap: 8, marginTop: 14 },
  namePromptCancelBtn: { flex: 1, border: "none", background: "#F0F2F4", color: "#5B6470", fontWeight: 600, fontSize: 13.5, padding: "11px 0", borderRadius: 10 },
  namePromptConfirmBtn: { flex: 1, border: "none", background: "#0D9488", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "11px 0", borderRadius: 10 },
  app: { minHeight: "100vh", background: "#F7F8FA", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", color: "#1F2937" },
  loadingWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FA" },
  loadingStamp: { border: "2px solid #0D9488", color: "#0D9488", padding: "10px 22px", borderRadius: 8, fontWeight: 700, letterSpacing: 1 },
  header: { padding: "20px 20px 14px", background: "#FFFFFF", borderBottom: "1px solid #EBEEF0" },
  headerTopRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  headerBackupBtn: { position: "relative", background: "#F0F2F4", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  headerBackupDot: { position: "absolute", top: 4, right: 5, width: 8, height: 8, borderRadius: "50%", background: "#DC5B45", border: "1.5px solid #fff" },
  dateBig: { fontSize: 21, fontWeight: 700, color: "#1F2937" },
  subLabel: { fontSize: 12.5, color: "#8A93A0", marginTop: 3, marginBottom: 16 },
  tabRow: { display: "flex", background: "#F0F2F4", borderRadius: 10, padding: 3, gap: 2, marginBottom: 0 },
  tabBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 0", borderRadius: 8, border: "none", background: "transparent", color: "#8A93A0", fontSize: 13.5, fontWeight: 600 },
  tabBtnActive: { background: "#FFFFFF", color: "#0D9488", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" },
  body: { flex: 1, padding: "18px 16px 100px", background: "#F7F8FA" },
  emptyWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px" },
  emptyStamp: { border: "2px solid #0D9488", color: "#0D9488", padding: "8px 18px", borderRadius: 8, fontWeight: 700, letterSpacing: 1, marginBottom: 14 },
  emptyText: { fontSize: 13.5, color: "#8A93A0", textAlign: "center" },
  card: { display: "flex", alignItems: "flex-start", background: "#FFFFFF", borderRadius: 14, padding: "14px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", gap: 10 },
  swipeWrap: { position: "relative", overflow: "hidden", borderRadius: 14, marginBottom: 10 },
  swipeContent: { position: "relative", zIndex: 1, touchAction: "pan-y" },
  swipeRightActions: { position: "absolute", inset: 0, display: "flex", justifyContent: "flex-end" },
  swipeLeftActions: { position: "absolute", inset: 0, display: "flex", justifyContent: "flex-start" },
  swipeActionBtn: { width: 72, border: "none", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 12, fontWeight: 700 },
  swipePinBtn: { width: 72, border: "none", background: "#F0F2F4", display: "flex", alignItems: "center", justifyContent: "center" },
  checkCircle: { width: 24, height: 24, borderRadius: "50%", border: "2px solid #D7DCE1", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  cardBody: { flex: 1, cursor: "pointer" },
  cardLine1: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  cardTitleWrap: { minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  relatedParens: { fontSize: 12.5, color: "#9AA3AF", fontWeight: 500 },
  ddayText: { fontSize: 14, fontWeight: 700, flexShrink: 0 },
  restoreBtn: { display: "inline-flex", alignItems: "center", background: "#F0F2F4", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, color: "#5B6470", flexShrink: 0 },
  stepLabel: { fontSize: 15, fontWeight: 600, color: "#1F2937", lineHeight: 1.35 },
  metaRow: { fontSize: 12, color: "#9AA3AF", marginTop: 5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 },
  dot: { color: "#DCE1E6" },
  warningTag: { color: "#DC5B45", fontWeight: 700, display: "inline-flex", alignItems: "center" },
  saveErrorBar: { display: "flex", alignItems: "center", justifyContent: "center", background: "#FBEAE7", color: "#DC5B45", fontSize: 12, padding: "8px 12px", position: "sticky", bottom: 0 },
  loadWarningBar: { display: "flex", alignItems: "center", background: "#FDF3DC", color: "#96691C", fontSize: 11.5, padding: "8px 34px 8px 12px", position: "relative" },
  loadWarningCloseBtn: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none" },
  fab: { position: "fixed", right: 20, bottom: 28, width: 56, height: 56, borderRadius: "50%", background: "#0D9488", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(13,148,136,0.35)", zIndex: 30 },
  calNavRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 12px" },
  calNavLeft: { display: "flex", alignItems: "center", gap: 10 },
  calMonthLabel: { fontSize: 16, fontWeight: 700, color: "#1F2937", letterSpacing: 0.2 },
  calTodayBtn: { background: "#EEF6F5", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: "#0D9488" },
  calNavArrows: { display: "flex", gap: 6 },
  calNavBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" },
  calCardWrap: { background: "#FFFFFF", borderRadius: 14, padding: "10px 6px 4px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" },
  calSearchWrap: { position: "relative", marginBottom: 12 },
  calSearchRow: { display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 12, padding: "10px 12px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" },
  calSearchInput: { flex: 1, border: "none", outline: "none", fontSize: 16, background: "transparent", color: "#1F2937" },
  calSearchClearBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  calSearchDropdown: { position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", borderRadius: 12, boxShadow: "0 6px 20px rgba(15,23,42,0.15)", padding: 6, maxHeight: 280, overflowY: "auto", zIndex: 20 },
  calSearchResultRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, cursor: "pointer" },
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
  calEventBanner: { display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 8, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", cursor: "pointer" },
  calEventBannerText: { fontSize: 13, fontWeight: 600, color: "#1F2937", flex: 1 },
  calEventEditBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  page: { display: "flex", flexDirection: "column", minHeight: "100%" },
  pageHandle: { width: 38, height: 4, background: "#E5E9EC", borderRadius: 2, margin: "0 auto 10px" },
  viewDdayRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  viewTitleText: { fontSize: 21, fontWeight: 700, color: "#1F2937", marginTop: 8, lineHeight: 1.3 },
  viewDateText: { fontSize: 13.5, color: "#8A93A0", marginTop: 6 },
  viewSection: { marginTop: 22 },
  viewSectionLabel: { fontSize: 12, fontWeight: 700, color: "#8A93A0", marginBottom: 8 },
  viewNoteText: { fontSize: 14.5, color: "#1F2937", lineHeight: 1.55, background: "#F7F8FA", borderRadius: 10, padding: "12px 14px", whiteSpace: "pre-wrap" },
  viewReminderRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderBottom: "1px solid #F0F2F4" },
  pageHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1F2937" },
  iconBtn: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconBtnLarge: { background: "#F0F2F4", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  viewCloseBtn: { border: "1px solid #E5E9EC", background: "#fff", color: "#5B6470", fontWeight: 700, fontSize: 14, borderRadius: 12, padding: "0 20px" },
  formLabel: { display: "block", fontSize: 12, fontWeight: 700, color: "#8A93A0", marginTop: 18, marginBottom: 6 },
  formInput: { width: "100%", border: "1px solid #E5E9EC", borderRadius: 10, padding: "11px 12px", fontSize: 16, background: "#F7F8FA", color: "#1F2937" },
  noteTextarea: { width: "100%", border: "1px solid #E5E9EC", borderRadius: 10, padding: "11px 12px", fontSize: 16, background: "#F7F8FA", color: "#1F2937", resize: "vertical", minHeight: 60 },
  recurringRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 18, cursor: "pointer" },
  toggleTrack: { width: 40, height: 22, borderRadius: 11, position: "relative", flexShrink: 0, transition: "background 0.15s" },
  toggleThumb: { width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: 2, boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "transform 0.15s" },
  recurringLabel: { fontSize: 13.5, color: "#1F2937", fontWeight: 600 },
  titleSuggestDropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", borderRadius: 10, boxShadow: "0 6px 20px rgba(15,23,42,0.15)", padding: 4, zIndex: 15, maxHeight: 230, overflowY: "auto" },
  titleSuggestRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 10px", borderRadius: 8, cursor: "pointer" },
  titleSuggestText: { fontSize: 14, color: "#1F2937", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  titleSuggestDate: { fontSize: 11.5, color: "#9AA3AF", flexShrink: 0 },
  dateWarningRow: { display: "flex", alignItems: "center", fontSize: 12, color: "#DC5B45", fontWeight: 600, marginTop: 7 },
  stepEditRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  reminderBlock: { paddingBottom: 4, borderBottom: "1px solid #EEF1F3", marginBottom: 4 },
  directionToggle: { display: "flex", background: "#F0F2F4", borderRadius: 10, padding: 2, flex: 1 },
  directionBtn: { flex: 1, border: "none", background: "transparent", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 600, color: "#8A93A0" },
  directionBtnActive: { background: "#fff", color: "#0D9488", boxShadow: "0 1px 2px rgba(15,23,42,0.08)" },
  directionBtnActiveAfter: { background: "#fff", color: "#B45309", boxShadow: "0 1px 2px rgba(15,23,42,0.08)" },
  checklistMeta: { color: "#8A93A0", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #D7DCE1", width: 22, height: 22, borderRadius: "50%" },
  noteMeta: { color: "#8A93A0", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #D7DCE1", width: 22, height: 22, borderRadius: "50%" },
  registerChecklistBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F2F4", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "#5B6470", width: "100%", marginTop: 18 },
  registerPresetBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF6F5", border: "1px solid #CDE9E5", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 700, color: "#0D9488", width: "100%", marginTop: 12 },
  tplHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  tplManageBtn: { background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "#8A93A0", marginTop: 12 },
  tplChipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  tplChipWrap: { display: "flex", alignItems: "center", gap: 4 },
  tplChip: { border: "1.5px solid #E5E9EC", borderRadius: 20, padding: "7px 13px", fontSize: 12.5, fontWeight: 700 },
  tplDeleteBtn: { background: "#FBEAE7", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tplHint: { fontSize: 11.5, color: "#8A93A0", marginTop: 8 },
  checklistSectionWrap: { background: "#F7F8FA", borderRadius: 10, padding: "10px 10px", marginTop: 10 },
  checklistSectionHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  checklistSectionLabel: { fontSize: 11.5, fontWeight: 700, color: "#0D9488", display: "flex", alignItems: "center" },
  stepNoteCloseBtn: { background: "none", border: "none", padding: 2 },
  checkCircleSmall: { width: 20, height: 20, borderRadius: "50%", border: "2px solid #D7DCE1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checklistEditorRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0" },
  checklistEditorText: { flex: 1, fontSize: 13 },
  checklistAddRow: { display: "flex", gap: 6, marginTop: 4 },
  checklistAddInput: { flex: 1, border: "1px solid #E5E9EC", borderRadius: 8, padding: "8px 10px", fontSize: 16, background: "#fff" },
  checklistAddBtn: { width: 32, height: 32, borderRadius: 8, background: "#0D9488", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dayInput: { width: 50, border: "1px solid #E5E9EC", borderRadius: 10, padding: "10px 8px", fontSize: 16, textAlign: "center", background: "#F7F8FA" },
  dayInputLabel: { fontSize: 12.5, color: "#8A93A0", flexShrink: 0 },
  stepLabelInput: { flex: 1, border: "1px solid #E5E9EC", borderRadius: 10, padding: "10px 12px", fontSize: 16, background: "#F7F8FA" },
  stepRemoveBtn: { background: "none", border: "none", flexShrink: 0 },
  deleteTextBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#DC5B45", fontSize: 13, fontWeight: 600, padding: "16px 0 4px", width: "100%" },
  pageFooterSticky: { position: "sticky", bottom: 0, background: "#F7F8FA", paddingTop: 14, paddingBottom: 4, marginTop: 18 },
  doneBtn: { background: "#0D9488", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
};
