import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import DailyReview from "./DailyReview.jsx";

const params = new URLSearchParams(window.location.search);
const isPowerlog =
  window.location.pathname.replace(/\/$/, "") === "/powerlog" || params.get("view") === "daily";

// 파워로그일 때는 탭 제목·아이콘·홈 화면 이름을 따로 설정
if (isPowerlog) {
  const setAttr = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };
  document.title = "파워로그";
  setAttr('meta[name="apple-mobile-web-app-title"]', "content", "파워로그");
  setAttr('meta[name="theme-color"]', "content", "#4F46E5");
  setAttr('link[rel="manifest"]', "href", "/manifest-powerlog.json");
  setAttr('link[rel="apple-touch-icon"]', "href", "/powerlog-apple-touch.png");
  document.querySelectorAll('link[rel="icon"]').forEach((el) => {
    el.setAttribute("href", "/powerlog-32.png");
    el.setAttribute("type", "image/png");
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{isPowerlog ? <DailyReview /> : <App />}</React.StrictMode>
);
