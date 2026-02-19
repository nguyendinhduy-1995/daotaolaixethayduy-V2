/**
 * In-process SSE Event Bus
 *
 * Simple EventEmitter-based bus for broadcasting events to connected SSE clients.
 * Events: lead:new, payment:new, kpi:update
 *
 * Usage:
 *   import { emitEvent, subscribe, unsubscribe } from "@/lib/sse-bus";
 *   emitEvent("lead:new", { leadId: "..." });
 */

export type SSEEventType = "lead:new" | "payment:new" | "kpi:update" | "notification:new";

export interface SSEEvent {
    id: string;
    type: SSEEventType;
    data: unknown;
    timestamp: string;
}

type Listener = (event: SSEEvent) => void;

// ─── Global event store ─────────────────────────────────────────
const listeners = new Set<Listener>();
let _eventCounter = 0;

// ─── Throttle: max 1 event per second per type ──────────────────
const _lastEmit: Record<string, number> = {};
const THROTTLE_MS = 1000;

/** Subscribe to all SSE events */
export function subscribe(listener: Listener): void {
    listeners.add(listener);
}

/** Unsubscribe from SSE events */
export function unsubscribe(listener: Listener): void {
    listeners.delete(listener);
}

/** Emit an event to all connected SSE clients */
export function emitEvent(type: SSEEventType, data: unknown): void {
    const now = Date.now();

    // Throttle per type
    if (_lastEmit[type] && now - _lastEmit[type] < THROTTLE_MS) {
        return; // Skip — too frequent
    }
    _lastEmit[type] = now;

    _eventCounter++;
    const event: SSEEvent = {
        id: String(_eventCounter),
        type,
        data,
        timestamp: new Date().toISOString(),
    };

    for (const listener of listeners) {
        try {
            listener(event);
        } catch (err) {
            console.error("[SSE Bus] Listener error:", err);
        }
    }
}

/** Get current listener count (for monitoring) */
export function getListenerCount(): number {
    return listeners.size;
}
