import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
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

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);

