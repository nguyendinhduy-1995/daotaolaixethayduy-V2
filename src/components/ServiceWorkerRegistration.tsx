"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;

        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js", {
                    scope: "/",
                });

                // Check for updates every 60 minutes
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);

                // Handle updates
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener("statechange", () => {
                        if (
                            newWorker.state === "activated" &&
                            navigator.serviceWorker.controller
                        ) {
                            // New version available — optionally notify user
                            console.log("[SW] New version available. Refresh to update.");
                        }
                    });
                });

                console.log("[SW] Registered:", registration.scope);
            } catch (err) {
                console.error("[SW] Registration failed:", err);
            }
        };

        register();
    }, []);

    return null;
}
