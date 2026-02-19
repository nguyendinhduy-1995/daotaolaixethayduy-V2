/**
 * Unit tests for Zalo OA provider
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set env before import
process.env.ZALO_OA_APP_ID = "test-app";
process.env.ZALO_OA_SECRET_KEY = "test-secret";
process.env.ZALO_OA_ACCESS_TOKEN = "test-token";
process.env.ZALO_OA_DRY_RUN = "true";

describe("Zalo OA Provider", () => {
    beforeEach(() => {
        vi.resetModules();
        mockFetch.mockReset();
    });

    it("sendZNS in dryRun mode should not call API", async () => {
        process.env.ZALO_OA_DRY_RUN = "true";
        const { sendZNS } = await import("@/lib/providers/zalo-oa");

        const result = await sendZNS({
            phone: "0901234567",
            templateId: "tmpl-001",
            templateData: { name: "Test User" },
        });

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
        expect(result.messageId).toContain("dry-run");
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sendText in dryRun should not call API", async () => {
        process.env.ZALO_OA_DRY_RUN = "true";
        const { sendText } = await import("@/lib/providers/zalo-oa");

        const result = await sendText("user-123", "Hello from CRM");

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("isZaloOAConfigured should return true when token is set", async () => {
        process.env.ZALO_OA_ACCESS_TOKEN = "test-token";
        process.env.ZALO_OA_APP_ID = "test-app";
        const { isZaloOAConfigured } = await import("@/lib/providers/zalo-oa");

        expect(isZaloOAConfigured()).toBe(true);
    });

    it("getRateLimitStatus should return limit info", async () => {
        const { getRateLimitStatus } = await import("@/lib/providers/zalo-oa");
        const status = getRateLimitStatus();

        expect(status.limit).toBe(500);
        expect(status.remaining).toBeGreaterThanOrEqual(0);
        expect(status.sent).toBeGreaterThanOrEqual(0);
    });
});
