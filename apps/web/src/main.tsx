import React from "react";
import ReactDOM from "react-dom/client";
import ProxmPWA from "./ProxmPWA";

// Register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(reg => {
        console.log("[proxm] SW registered:", reg.scope);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available — show update toast
              window.dispatchEvent(new CustomEvent("proxm:update-available"));
            }
          });
        });
      })
      .catch(err => console.warn("[proxm] SW failed:", err));
  });

  // Handle SW messages (notification click → navigate)
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "notification_click") {
      window.location.href = event.data.url;
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProxmPWA />
  </React.StrictMode>
);
