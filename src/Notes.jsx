import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, X, Check, Loader2, Download, Copy, Settings2, ChevronDown } from "lucide-react";
import { C, F, shared } from "./theme";

const CAT_KEY = "powerlog:note-categories";
const DEFAULT_CATS = [
  { key: "hospital", label: "병원/건강", emoji: "🏥" },
  { key: "kids", label: "아이", emoji: "👶" },
  { key: "home", label: "집", emoji: "🏠" },
  { key: "etc", label: "기타", emoji: "📌" },
];

const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

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

export default function Notes() {
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [catEdit, setCatEdit] = useState(false);
  const [active, setActive] = useState("all");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // note being written/edited, or null
  const [toast, setToast] = useState("");
  const searchTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/backup?key=${encodeURIComponent(CAT_KEY)}`);
        const row = await res.json();
        if (row && row.data) {
          const list = JSON.parse(row.data);
          if (Array.isArray(list) && list.length) setCats(list);
        }
      } catch (e) {}
    })();
  }, []);

  const saveCats = (list) => {
    setCats(list);
    fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: CAT_KEY, value: JSON.stringify(list) }),
    }).catch(() => {});
  };

  const load = useCallback(async (q, cat) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      else if (cat && cat !== "all") params.set("category", cat);
      const res = await fetch(`/api/notes?${params.toString()}`);
      const rows = await res.json();
      setNotes(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query.trim(), active);
  }, [active, load]);

  const onSearchChange = (v) => {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(v.trim(), active), 300);
  };

  const saveNote = async (n) => {
    if (!n.title.trim() && !n.body.trim()) {
      setEditing(null);
      return;
    }
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n),
      });
      setEditing(null);
      load(query.trim(), active);
      showToast("저장했어요");
    } catch (e) {
      window.alert("저장에 실패했어요.");
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm("이 메모를 지울까요?")) return;
    try {
      await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      load(query.trim(), active);
    } catch (e) {
      window.alert("삭제에 실패했어요.");
    }
  };

  const catInfo = (key) => cats.find((c) => c.key === key) || { label: key, emoji: "📄" };

  const exportAll = async (asFile) => {
    try {
      const res = await fetch("/api/notes");
      const all = await res.json();
      const grouped = {};
      (all || []).forEach((n) => {
        (grouped[n.category] = grouped[n.category] || []).push(n);
      });
      const lines = ["# 파워로그 메모장 내보내기", ""];
      cats.forEach((c) => {
        const list = grouped[c.key];
        if (!list || !list.length) return;
        lines.push(`## ${c.emoji} ${c.label}`);
        list
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .forEach((n) => {
            lines.push(`- ${n.title ? `**${n.title}** — ` : ""}${(n.body || "").replace(/\n/g, " ")}${n.tags && n.tags.length ? ` (${n.tags.map((t) => "#" + t).join(" ")})` : ""} _(${fmtDate(n.updated_at)})_`);
          });
        lines.push("");
      });
      const text = lines.join("\n");
      if (asFile) {
        const blob = new Blob([text], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `파워로그_메모장_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        const ok = await copyText(text);
        showToast(ok ? "전체 메모가 복사됐어요! 어디든 붙여넣으세요" : "복사에 실패했어요");
      }
    } catch (e) {
      window.alert("내보내기에 실패했어요.");
    }
  };

  return (
    <div style={s.body}>
      <div style={s.searchRow}>
        <Search size={15} color={C.ink2} style={{ marginLeft: 0 }} />
        <input style={s.searchInput} placeholder="메모 검색 (예: 소아과)" value={query} onChange={(e) => onSearchChange(e.target.value)} />
        {query && (
          <button style={s.clearBtn} onClick={() => onSearchChange("")} aria-label="검색어 지우기">
            <X size={14} color={C.ink2} />
          </button>
        )}
      </div>

      <div style={s.catRow}>
        <button onClick={() => setActive("all")} style={{ ...s.catChip, ...(active === "all" && !query ? s.catChipOn : {}) }}>
          전체
        </button>
        {cats.map((c) =>
          catEdit ? (
            <span key={c.key} style={s.catEditing}>
              {c.emoji} {c.label}
              <button
                style={s.catDel}
                onClick={() => {
                  saveCats(cats.filter((x) => x.key !== c.key));
                  if (active === c.key) setActive("all");
                }}
                aria-label={`${c.label} 삭제`}
              >
                <X size={11} color={C.brick} />
              </button>
            </span>
          ) : (
            <button
              key={c.key}
              onClick={() => {
                setActive(c.key);
                setQuery("");
              }}
              style={{ ...s.catChip, ...(active === c.key && !query ? s.catChipOn : {}) }}
            >
              {c.emoji} {c.label}
            </button>
          )
        )}
        <button style={s.catEditBtn} onClick={() => setCatEdit((v) => !v)}>
          <Settings2 size={13} />
        </button>
      </div>
      {catEdit && <NewCategory onAdd={(c) => saveCats([...cats, c])} existing={cats.map((c) => c.key)} />}

      {!editing && (
        <button style={s.addBtn} onClick={() => setEditing({ category: active !== "all" ? active : cats[0].key, title: "", body: "", tags: [] })}>
          <Plus size={16} style={{ marginRight: 6 }} />새 메모
        </button>
      )}

      {editing && <NoteEditor note={editing} cats={cats} onCancel={() => setEditing(null)} onSave={saveNote} onDelete={editing.id ? () => deleteNote(editing.id) : null} />}

      {loading ? (
        <div style={s.center}>
          <Loader2 size={20} color={C.wine} />
        </div>
      ) : notes.length === 0 ? (
        <div style={s.empty}>{query ? "검색 결과가 없어요." : "아직 메모가 없어요. 위 버튼으로 추가해보세요."}</div>
      ) : (
        notes.map((n) => (
          <button key={n.id} style={s.noteCard} onClick={() => setEditing(n)}>
            <div style={s.noteHead}>
              <span style={s.noteCat}>
                {catInfo(n.category).emoji} {catInfo(n.category).label}
              </span>
              <span style={s.noteDate}>{fmtDate(n.updated_at)}</span>
            </div>
            {n.title && <div style={s.noteTitle}>{n.title}</div>}
            {n.body && <div style={s.noteBody}>{n.body}</div>}
            {n.tags && n.tags.length > 0 && (
              <div style={s.noteTags}>
                {n.tags.map((t) => (
                  <span key={t} style={s.tagMini}>
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))
      )}

      <div style={s.exportRow}>
        <button style={s.exportBtn} onClick={() => exportAll(false)}>
          <Copy size={14} style={{ marginRight: 6 }} />
          전체 복사
        </button>
        <button style={s.exportBtn} onClick={() => exportAll(true)}>
          <Download size={14} style={{ marginRight: 6 }} />
          파일로 저장
        </button>
      </div>
      <div style={s.exportHint}>Claude나 다른 곳에 붙여넣어 언제든 학습시킬 수 있어요.</div>

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

function NewCategory({ onAdd, existing }) {
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("📁");
  return (
    <div style={s.newCatRow}>
      <input style={s.emojiInput} value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))} aria-label="이모지" />
      <input style={s.newCatInput} placeholder="새 카테고리 이름" value={label} onChange={(e) => setLabel(e.target.value)} />
      <button
        style={s.addBtnSmall}
        onClick={() => {
          const v = label.trim();
          if (!v) return;
          const key = `c${Date.now().toString(36)}`;
          if (!existing.includes(key)) onAdd({ key, label: v, emoji: emoji || "📁" });
          setLabel("");
        }}
      >
        <Plus size={14} color={C.paper} />
      </button>
    </div>
  );
}

function NoteEditor({ note, cats, onCancel, onSave, onDelete }) {
  const [n, setN] = useState({ id: note.id, category: note.category, title: note.title || "", body: note.body || "", tags: note.tags || [] });
  const [tagDraft, setTagDraft] = useState("");
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
    }
  }, [n.body]);

  return (
    <div style={s.editor}>
      <div style={s.editorCatRow}>
        {cats.map((c) => (
          <button key={c.key} onClick={() => setN({ ...n, category: c.key })} style={{ ...s.editorCatChip, ...(n.category === c.key ? s.editorCatChipOn : {}) }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <input style={s.titleInput} placeholder="제목 (예: OO소아과)" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} />
      <textarea
        ref={bodyRef}
        style={s.bodyInput}
        rows={4}
        placeholder="자유롭게 적어주세요"
        value={n.body}
        onChange={(e) => setN({ ...n, body: e.target.value })}
      />
      <div style={s.chipWrap}>
        {n.tags.map((t) => (
          <span key={t} style={s.tagChipOn} onClick={() => setN({ ...n, tags: n.tags.filter((x) => x !== t) })}>
            #{t} ✕
          </span>
        ))}
      </div>
      <div style={s.addRow}>
        <input
          style={s.addInput}
          placeholder="태그 추가"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = tagDraft.trim().replace(/^#/, "");
              if (v && !n.tags.includes(v)) setN({ ...n, tags: [...n.tags, v] });
              setTagDraft("");
            }
          }}
        />
      </div>
      <div style={s.editorBtnRow}>
        {onDelete && (
          <button style={s.delBtn} onClick={onDelete}>
            삭제
          </button>
        )}
        <button style={s.cancelBtn} onClick={onCancel}>
          취소
        </button>
        <button style={s.saveBtnMain} onClick={() => onSave(n)}>
          <Check size={14} style={{ marginRight: 4 }} />
          저장
        </button>
      </div>
    </div>
  );
}

const s = {
  body: { flex: 1, padding: "0 20px 60px" },
  searchRow: { display: "flex", alignItems: "center", borderBottom: `1px solid ${C.line}`, marginBottom: 14 },
  searchInput: { flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 16, background: "transparent", fontFamily: F.sans, color: C.ink },
  clearBtn: { background: "none", border: "none", padding: "0 4px", display: "flex" },
  catRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 },
  catChip: { ...shared.chip },
  catChipOn: { ...shared.chipOn },
  catEditBtn: { border: "none", background: "none", color: C.ink2, borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  catEditing: { display: "inline-flex", alignItems: "center", gap: 4, border: `1px dashed ${C.line}`, background: "none", fontSize: 13, fontWeight: 500, color: C.ink2, padding: "6px 6px 6px 12px", borderRadius: 20, fontFamily: F.sans },
  catDel: { background: "none", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  newCatRow: { display: "flex", gap: 6, margin: "8px 0" },
  emojiInput: { width: 42, textAlign: "center", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 4px", fontSize: 16, background: "transparent" },
  newCatInput: { ...shared.input, flex: 1, borderRadius: 8 },
  addBtnSmall: { background: C.wine, border: "none", borderRadius: 8, width: 38, display: "flex", alignItems: "center", justifyContent: "center" },
  addBtn: { ...shared.btnSecondary, margin: "4px 0 16px" },
  center: { display: "flex", justifyContent: "center", padding: "40px 0" },
  empty: { textAlign: "center", color: C.ink2, fontSize: 13.5, padding: "40px 20px", lineHeight: 1.6 },
  noteCard: { width: "100%", textAlign: "left", background: "none", border: "none", padding: "14px 0", borderBottom: `1px solid ${C.line}` },
  noteHead: { display: "flex", justifyContent: "space-between", marginBottom: 5 },
  noteCat: { fontSize: 11, fontWeight: 500, color: C.wine },
  noteDate: { fontSize: 11, color: C.ink2 },
  noteTitle: { fontSize: 14.5, fontWeight: 600, color: C.ink, fontFamily: F.serif },
  noteBody: { fontSize: 13, color: C.ink2, marginTop: 4, lineHeight: 1.55, whiteSpace: "pre-wrap" },
  noteTags: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 },
  tagMini: { fontSize: 11.5, color: C.ink2, fontWeight: 500 },
  editor: { ...shared.section, borderTop: "none", paddingTop: 0 },
  editorCatRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  editorCatChip: { ...shared.chip },
  editorCatChipOn: { ...shared.chipOn },
  titleInput: { ...shared.input, borderRadius: 0, border: "none", borderBottom: `1px solid ${C.line}`, fontSize: 15.5, fontWeight: 600, marginBottom: 10, fontFamily: F.serif, padding: "6px 0" },
  bodyInput: { ...shared.textarea, borderRadius: 0, border: "none", borderBottom: `1px solid ${C.line}`, padding: "6px 0", background: "transparent" },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tagChipOn: { ...shared.chipOn, cursor: "pointer" },
  addRow: { display: "flex", gap: 8, marginTop: 10 },
  addInput: { ...shared.input, flex: 1, minWidth: 0, borderRadius: 8 },
  editorBtnRow: { display: "flex", gap: 8, marginTop: 14 },
  delBtn: { border: "none", background: "none", color: C.brick, fontSize: 13, fontWeight: 500, padding: "10px 6px", fontFamily: F.sans },
  cancelBtn: { ...shared.btnSecondary, flex: 1 },
  saveBtnMain: { ...shared.btnPrimary, flex: 1 },
  exportRow: { display: "flex", gap: 8, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.line}` },
  exportBtn: { ...shared.btnSecondary, flex: 1 },
  exportHint: { fontSize: 11.5, color: C.ink2, textAlign: "center", marginTop: 8, lineHeight: 1.5 },
  toast: { ...shared.toast },
};
