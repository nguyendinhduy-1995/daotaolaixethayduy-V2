/**
 * Sentry Configuration
 *
 * Enable by setting NEXT_PUBLIC_SENTRY_DSN environment variable.
 * This module initializes Sentry for error tracking and performance monitoring.
 *
 * Usage in next.config.ts:
 *   import "./sentry.config";  // Side-effect import
 *
 * Or explicit init in instrumentation:
 *   import { initSentry } from "./sentry.config";
 *   initSentry();
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";
const SENTRY_ENV = process.env.NODE_ENV || "development";
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || `crm@${new Date().toISOString().slice(0, 10)}`;

/**
 * Lightweight error reporter that sends to Sentry-compatible endpoint.
 * Does NOT require @sentry/nextjs package — uses native fetch.
 *
 * For full Sentry integration, install @sentry/nextjs and use their SDK instead.
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
    if (!SENTRY_DSN) {
        console.error("[Sentry:disabled]", error.message, context);
        return;
    }

    // Parse Sentry DSN: https://{key}@{host}/{project_id}
    const dsnMatch = SENTRY_DSN.match(/https?:\/\/([^@]+)@([^/]+)\/(.+)/);
    if (!dsnMatch) {
        console.error("[Sentry] Invalid DSN format");
        return;
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const storeUrl = `https://${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`;

    const payload = {
        event_id: crypto.randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        platform: "node",
        level: "error",
        environment: SENTRY_ENV,
        release: SENTRY_RELEASE,
        exception: {
            values: [{
                type: error.name,
                value: error.message,
                stacktrace: {
                    frames: (error.stack || "").split("\n").slice(1).map((line) => ({
                        filename: line.trim(),
                    })),
                },
            }],
        },
        tags: {
            runtime: "nextjs",
            ...(context?.tags as Record<string, string> || {}),
        },
        extra: context || {},
    };

    // Fire and forget
    fetch(storeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).catch((err) => {
        console.error("[Sentry] Failed to send:", err.message);
    });
}

/**
 * Capture an unhandled rejection or uncaught exception
 */
export function initSentry(): void {
    if (!SENTRY_DSN) {
        console.log("[Sentry] Disabled — NEXT_PUBLIC_SENTRY_DSN not set");
        return;
    }

    console.log(`[Sentry] Initialized — env=${SENTRY_ENV}, release=${SENTRY_RELEASE}`);

    if (typeof process !== "undefined") {
        process.on("uncaughtException", (error) => {
            captureError(error, { context: "uncaughtException" });
        });

        process.on("unhandledRejection", (reason) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            captureError(error, { context: "unhandledRejection" });
        });
    }
}

// Auto-init on import
initSentry();
