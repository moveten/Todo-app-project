import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 예전 주소(?view=daily)로 들어오면 파워로그 전용 주소로 이동
const params = new URLSearchParams(window.location.search);
if (params.get("view") === "daily") {
  window.location.replace("/powerlog");
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
