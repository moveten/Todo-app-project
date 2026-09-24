// 파워로그 공통 디자인 토큰. 화면 3개(기록/통계/메모장)가 이 값만 공유하면
// 색이 흩어지지 않고, 나중에 톤 하나만 바꿔도 전체가 같이 바뀐다.
export const C = {
  ink: "#211D19",        // 본문 글자
  ink2: "#847B6E",        // 옅은 글자 (설명, 날짜)
  paper: "#FBF8F2",       // 배경
  paperAlt: "#F1EBDD",    // 살짝 짙은 배경 (선택된 칩, 진행바 트랙)
  line: "#E3DACB",        // 구획을 나누는 실선
  wine: "#6B2B3C",        // 유일한 포인트 색
  wineSoft: "#F2E3E4",    // 포인트의 옅은 배경
  wineLine: "#D9BEC2",    // 포인트 톤의 테두리
  ochre: "#8A6A2A",       // 보완할 점 등 두 번째 신호
  ochreSoft: "#F2E9D6",
  brick: "#8B4A3D",       // 0점/경고
  brickSoft: "#F2E1DC",
};

export const F = {
  serif: "'Gowun Batang', serif",
  sans: "'IBM Plex Sans KR', -apple-system, sans-serif",
};

// 화면 사이에 그대로 재사용하는 조각들
export const shared = {
  page: { minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: F.sans, maxWidth: 480, margin: "0 auto" },
  section: { padding: "16px 0", borderTop: `1px solid ${C.line}` },
  sectionLabel: { fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 },
  hint: { fontSize: 12.5, color: C.ink2, lineHeight: 1.6 },
  divider: { border: "none", borderTop: `1px solid ${C.line}`, margin: 0 },

  // 버튼: 앱 전체에서 이 두 종류만 씀
  btnPrimary: { border: "none", background: C.wine, color: "#FBF8F2", fontSize: 14.5, fontWeight: 600, padding: "13px 0", borderRadius: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans },
  btnSecondary: { border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 13.5, fontWeight: 500, padding: "11px 0", borderRadius: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans },
  btnGhost: { border: "none", background: "none", color: C.ink2, fontSize: 12.5, fontWeight: 500, padding: 0, fontFamily: F.sans },

  // 칩/태그: 한 종류만
  chip: { border: `1px solid ${C.line}`, background: "transparent", color: C.ink2, fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 20, fontFamily: F.sans },
  chipOn: { border: `1px solid ${C.wineLine}`, background: C.wineSoft, color: C.wine },

  input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 16, color: C.ink, background: "transparent", fontFamily: F.sans, outline: "none" },
  textarea: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 16, color: C.ink, background: "transparent", resize: "none", fontFamily: F.sans, outline: "none", lineHeight: 1.55 },

  toast: { position: "fixed", left: "50%", bottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)", transform: "translateX(-50%)", background: C.ink, color: C.paper, fontSize: 13, fontWeight: 500, padding: "10px 18px", borderRadius: 20, zIndex: 90, whiteSpace: "nowrap", fontFamily: F.sans },
};
