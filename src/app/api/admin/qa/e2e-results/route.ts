import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * GET /api/admin/qa/e2e-results
 * Returns Playwright test results + snapshots info (admin only)
 */
export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const reportDir = join(process.cwd(), "playwright-report");
    const snapDir = join(process.cwd(), "docs/e2e-snapshots");

    // Read last run results from Playwright JSON report
    let lastRun: string | null = null;
    let summary = { total: 0, passed: 0, failed: 0, skipped: 0 };
    const testCases: { name: string; status: string; duration: number; file: string }[] = [];

    // Try to read Playwright's JSON results
    const resultsPath = join(process.cwd(), "test-results", ".last-run.json");
    if (existsSync(resultsPath)) {
        try {
            const raw = JSON.parse(readFileSync(resultsPath, "utf-8"));
            lastRun = raw.lastRun || null;
            if (raw.status === "passed") {
                summary.passed = 1;
                summary.total = 1;
            }
        } catch { /* ignore */ }
    }

    // Scan test-results directory for individual test data
    const testResultsDir = join(process.cwd(), "test-results");
    if (existsSync(testResultsDir)) {
        try {
            const entries = readdirSync(testResultsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const parts = entry.name.split("-");
                    const status = parts[parts.length - 1] === "retry1" ? "retried" : "ran";
                    testCases.push({
                        name: entry.name.replace(/-chromium$/, "").replace(/-retry\d+$/, ""),
                        status,
                        duration: 0,
                        file: entry.name,
                    });
                }
            }
        } catch { /* ignore */ }
    }

    // List snapshot files
    const snapshots: { name: string; size: number; modified: string }[] = [];
    if (existsSync(snapDir)) {
        try {
            const files = readdirSync(snapDir).filter(f => f.endsWith(".png") || f.endsWith(".webp") || f.endsWith(".mp4"));
            for (const f of files) {
                const stat = statSync(join(snapDir, f));
                snapshots.push({ name: f, size: stat.size, modified: stat.mtime.toISOString() });
            }
        } catch { /* ignore */ }
    }

    // Read HTML report existence
    const htmlReportExists = existsSync(join(reportDir, "index.html"));

    // Update summary from test cases
    if (testCases.length > 0) {
        summary.total = testCases.length;
    }

    return NextResponse.json({
        ok: true,
        lastRun: lastRun || new Date().toISOString(),
        summary,
        htmlReportAvailable: htmlReportExists,
        testCases: testCases.slice(0, 100),
        snapshots: snapshots.slice(0, 50),
    });
}
