import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__deferredInstallPrompt = event as BeforeInstallPromptEvent;
  window.dispatchEvent(new CustomEvent("pwa-install-available"));
});

window.addEventListener("appinstalled", () => {
  window.__deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent("pwa-installed"));
});

// PWA registration - only in production
try {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {
    console.log("PWA registration skipped");
  });
} catch (e) {
  console.log("PWA not available");
}

createRoot(document.getElementById("root")!).render(<App />);

