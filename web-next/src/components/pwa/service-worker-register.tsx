"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[SW] Service Worker registrado:", registration.scope);
        })
        .catch((error) => {
          console.error("[SW] Falha ao registrar Service Worker:", error);
        });
    }
  }, []);

  return null;
}
