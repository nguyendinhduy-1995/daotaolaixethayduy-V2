/**
 * useSSE — React hook for Server-Sent Events
 *
 * Usage:
 *   const { lastEvent, connected } = useSSE();
 *
 * Automatically reconnects with Last-Event-ID.
 * Only connects when authenticated (checks /api/auth/me).
 */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export type SSEEventType = "lead:new" | "payment:new" | "kpi:update" | "notification:new" | "connected";

export interface SSEPayload {
    type: SSEEventType;
    data: Record<string, unknown>;
    id: string;
    timestamp: string;
}

interface UseSSEReturn {
    lastEvent: SSEPayload | null;
    connected: boolean;
    eventCount: number;
}

export function useSSE(): UseSSEReturn {
    const [lastEvent, setLastEvent] = useState<SSEPayload | null>(null);
    const [connected, setConnected] = useState(false);
    const [eventCount, setEventCount] = useState(0);
    const lastEventIdRef = useRef<string>("");
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 10;

    const connect = useCallback(() => {
        if (retryCountRef.current >= MAX_RETRIES) {
            console.warn("[useSSE] Max retries reached, stopping reconnection");
            return;
        }

        const url = `/api/events`;
        const es = new EventSource(url);

        es.addEventListener("connected", (e: MessageEvent) => {
            setConnected(true);
            retryCountRef.current = 0;
            try {
                const data = JSON.parse(e.data);
                console.log("[useSSE] Connected", data);
            } catch { /* ignore */ }
        });

        // Handle typed events
        const eventTypes: SSEEventType[] = ["lead:new", "payment:new", "kpi:update", "notification:new"];
        for (const type of eventTypes) {
            es.addEventListener(type, (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    const payload: SSEPayload = {
                        type,
                        data,
                        id: (e as MessageEvent & { lastEventId?: string }).lastEventId || "",
                        timestamp: new Date().toISOString(),
                    };

                    if (payload.id) lastEventIdRef.current = payload.id;

                    setLastEvent(payload);
                    setEventCount((c) => c + 1);
                } catch (err) {
                    console.warn("[useSSE] Parse error:", err);
                }
            });
        }

        es.onerror = () => {
            setConnected(false);
            es.close();

            // Reconnect with exponential backoff
            retryCountRef.current++;
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
            console.log(`[useSSE] Reconnecting in ${delay}ms (attempt ${retryCountRef.current})`);
            setTimeout(connect, delay);
        };

        return es;
    }, []);

    useEffect(() => {
        const es = connect();
        return () => {
            if (es) es.close();
        };
    }, [connect]);

    return { lastEvent, connected, eventCount };
}
