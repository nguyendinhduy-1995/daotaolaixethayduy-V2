/**
 * Unit tests for SSE bus
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("SSE Bus", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should emit events to subscribers", async () => {
        const { emitEvent, subscribe, unsubscribe } = await import("@/lib/sse-bus");
        const listener = vi.fn();
        subscribe(listener);

        vi.advanceTimersByTime(2000);
        emitEvent("lead:new", { leadId: "test-1" });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "lead:new",
                data: { leadId: "test-1" },
            })
        );

        unsubscribe(listener);
    });

    it("should throttle same event type within 1 second", async () => {
        const { emitEvent, subscribe, unsubscribe } = await import("@/lib/sse-bus");
        const listener = vi.fn();
        subscribe(listener);

        vi.advanceTimersByTime(2000); // Clear any prior throttle
        emitEvent("lead:new", { leadId: "1" });
        emitEvent("lead:new", { leadId: "2" }); // Should be throttled

        expect(listener).toHaveBeenCalledTimes(1);

        // Advance time past throttle
        vi.advanceTimersByTime(1100);
        emitEvent("lead:new", { leadId: "3" }); // Should fire
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe(listener);
    });

    it("should not throttle different event types", async () => {
        const { emitEvent, subscribe, unsubscribe } = await import("@/lib/sse-bus");
        const listener = vi.fn();
        subscribe(listener);

        vi.advanceTimersByTime(2000);
        emitEvent("lead:new", { leadId: "1" });
        emitEvent("payment:new", { receiptId: "1" });

        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe(listener);
    });

    it("should unsubscribe listeners", async () => {
        const { emitEvent, subscribe, unsubscribe } = await import("@/lib/sse-bus");
        const listener = vi.fn();
        subscribe(listener);

        vi.advanceTimersByTime(2000);
        emitEvent("lead:new", { leadId: "1" });
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe(listener);

        vi.advanceTimersByTime(2000);
        emitEvent("lead:new", { leadId: "2" });
        expect(listener).toHaveBeenCalledTimes(1); // No additional call
    });

    it("should track listener count", async () => {
        const { subscribe, unsubscribe, getListenerCount } = await import("@/lib/sse-bus");
        const initial = getListenerCount();
        const listener = vi.fn();

        subscribe(listener);
        expect(getListenerCount()).toBe(initial + 1);

        unsubscribe(listener);
        expect(getListenerCount()).toBe(initial);
    });

    it("should include id and timestamp in events", async () => {
        const { emitEvent, subscribe, unsubscribe } = await import("@/lib/sse-bus");
        type SSEEvent = { id: string; timestamp: string; type: string; data: unknown };
        const listener = vi.fn();
        subscribe(listener);

        vi.advanceTimersByTime(2000);
        emitEvent("kpi:update", { metric: "revenue" });

        const event: SSEEvent = listener.mock.calls[0][0];
        expect(event.id).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(typeof event.id).toBe("string");

        unsubscribe(listener);
    });
});
