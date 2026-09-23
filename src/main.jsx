import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import DailyReview from "./DailyReview.jsx";

const params = new URLSearchParams(window.location.search);
const view = params.get("view") === "daily" ? <DailyReview /> : <App />;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{view}</React.StrictMode>
);
