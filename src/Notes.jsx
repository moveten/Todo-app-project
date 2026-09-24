import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, X, Check, Loader2, Download, Copy, Settings2, ChevronDown } from "lucide-react";

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
        <Search size={15} color="#9AA3AF" style={{ marginLeft: 10 }} />
        <input style={s.searchInput} placeholder="메모 검색 (예: 소아과)" value={query} onChange={(e) => onSearchChange(e.target.value)} />
        {query && (
          <button style={s.clearBtn} onClick={() => onSearchChange("")} aria-label="검색어 지우기">
            <X size={14} color="#9AA3AF" />
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
                <X size={11} color="#DC5B45" />
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
          <Loader2 size={20} color="#4F46E5" />
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
        <Plus size={14} color="#fff" />
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
  body: { flex: 1, padding: "12px 16px 60px" },
  searchRow: { display: "flex", alignItems: "center", background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 10 },
  searchInput: { flex: 1, border: "none", outline: "none", padding: "11px 10px", fontSize: 16, background: "transparent", fontFamily: "inherit" },
  clearBtn: { background: "none", border: "none", padding: "0 10px", display: "flex" },
  catRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 4 },
  catChip: { border: "1px solid #E5E9EC", background: "#fff", color: "#5B6470", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 20 },
  catChipOn: { background: "#EEF0FF", border: "1px solid #C7CCFF", color: "#4F46E5" },
  catEditBtn: { border: "none", background: "#F0F2F4", color: "#8A93A0", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  catEditing: { display: "inline-flex", alignItems: "center", gap: 4, border: "1px dashed #D7DCE1", background: "#fff", fontSize: 13, fontWeight: 700, color: "#5B6470", padding: "6px 6px 6px 12px", borderRadius: 20 },
  catDel: { background: "#FBEAE7", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  newCatRow: { display: "flex", gap: 6, margin: "8px 0" },
  emojiInput: { width: 44, textAlign: "center", border: "1px solid #E5E9EC", borderRadius: 10, padding: "8px 4px", fontSize: 16 },
  newCatInput: { flex: 1, border: "1px solid #E5E9EC", borderRadius: 10, padding: "8px 10px", fontSize: 16, outline: "none", fontFamily: "inherit" },
  addBtnSmall: { background: "#4F46E5", border: "none", borderRadius: 10, width: 38, display: "flex", alignItems: "center", justifyContent: "center" },
  addBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #C7CCFF", background: "#fff", color: "#4F46E5", fontSize: 14, fontWeight: 700, padding: "12px 0", borderRadius: 12, margin: "10px 0" },
  center: { display: "flex", justifyContent: "center", padding: "40px 0" },
  empty: { textAlign: "center", color: "#9AA3AF", fontSize: 13.5, padding: "40px 20px", lineHeight: 1.6 },
  noteCard: { width: "100%", textAlign: "left", background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 8, border: "none" },
  noteHead: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  noteCat: { fontSize: 11.5, fontWeight: 800, color: "#4F46E5" },
  noteDate: { fontSize: 11, color: "#B0B7C0" },
  noteTitle: { fontSize: 14.5, fontWeight: 800, color: "#1F2937" },
  noteBody: { fontSize: 13, color: "#5B6470", marginTop: 3, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  noteTags: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagMini: { fontSize: 11.5, color: "#4F46E5", fontWeight: 600 },
  editor: { background: "#fff", borderRadius: 14, padding: "14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", marginBottom: 10 },
  editorCatRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  editorCatChip: { border: "1px solid #E5E9EC", background: "#fff", color: "#8A93A0", fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 20 },
  editorCatChipOn: { background: "#EEF0FF", border: "1px solid #C7CCFF", color: "#4F46E5" },
  titleInput: { width: "100%", boxSizing: "border-box", border: "1px solid #EEF1F3", borderRadius: 10, padding: "9px 10px", fontSize: 15, fontWeight: 700, outline: "none", marginBottom: 8, fontFamily: "inherit" },
  bodyInput: { width: "100%", boxSizing: "border-box", border: "1px solid #EEF1F3", borderRadius: 10, padding: "9px 10px", fontSize: 16, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5, background: "#FAFBFC" },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChipOn: { background: "#EEF0FF", border: "1px solid #C7CCFF", color: "#4F46E5", fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 20, cursor: "pointer" },
  addRow: { display: "flex", gap: 6, marginTop: 8 },
  addInput: { flex: 1, minWidth: 0, border: "1px solid #E5E9EC", borderRadius: 10, padding: "7px 10px", fontSize: 16, outline: "none", fontFamily: "inherit" },
  editorBtnRow: { display: "flex", gap: 8, marginTop: 12 },
  delBtn: { border: "none", background: "#FBEAE7", color: "#DC5B45", fontSize: 13.5, fontWeight: 700, padding: "10px 14px", borderRadius: 10 },
  cancelBtn: { flex: 1, border: "1px solid #E5E9EC", background: "#fff", color: "#5B6470", fontSize: 13.5, fontWeight: 700, padding: "10px 0", borderRadius: 10 },
  saveBtnMain: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#4F46E5", color: "#fff", fontSize: 13.5, fontWeight: 700, padding: "10px 0", borderRadius: 10 },
  exportRow: { display: "flex", gap: 8, marginTop: 16 },
  exportBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E5E9EC", background: "#fff", color: "#1F2937", fontSize: 13.5, fontWeight: 700, padding: "11px 0", borderRadius: 12 },
  exportHint: { fontSize: 11.5, color: "#9AA3AF", textAlign: "center", marginTop: 8, lineHeight: 1.5 },
  toast: { position: "fixed", left: "50%", bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", transform: "translateX(-50%)", background: "rgba(31,41,55,0.92)", color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 20, zIndex: 90, whiteSpace: "nowrap" },
};
