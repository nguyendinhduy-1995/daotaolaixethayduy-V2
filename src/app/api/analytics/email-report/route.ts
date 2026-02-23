import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Email-style Daily Digest Report — triggered by cron
 * POST /api/analytics/email-report — generates and sends a daily digest
 * Requires x-cron-secret or admin auth
 * 
 * For now: generates the report and stores it in AnalyticsAiInsight
 * Email sending can be added via external service (Resend, SendGrid, etc.)
 */

export async function POST(req: Request) {
    // Auth: cron secret or admin
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret !== process.env.CRON_SECRET) {
        const { requireMappedRoutePermissionAuth } = await import("@/lib/route-auth");
        const { requireAdminRole } = await import("@/lib/admin-auth");
        const authResult = await requireMappedRoutePermissionAuth(req);
        if (authResult.error) return authResult.error;
        const adminError = requireAdminRole(authResult.auth.role);
        if (adminError) return adminError;
    }

    try {
        const now = new Date();
        const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().slice(0, 10);
        const dayStart = new Date(`${dateStr}T00:00:00+07:00`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999+07:00`);

        // Gather yesterday's data
        const events = await prisma.siteAnalyticsEvent.findMany({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
            select: { eventType: true, page: true, site: true, sessionId: true, ip: true, country: true },
        });

        const pageViews = events.filter(e => e.eventType === "page_view").length;
        const sessions = new Set(events.map(e => e.sessionId)).size;
        const users = new Set(events.filter(e => e.ip).map(e => e.ip)).size;
        const errors = events.filter(e => e.eventType === "js_error").length;

        // Site breakdown
        const sites: Record<string, number> = {};
        events.forEach(e => { sites[e.site] = (sites[e.site] || 0) + 1; });

        // Top pages
        const pageCounts: Record<string, number> = {};
        events.filter(e => e.eventType === "page_view").forEach(e => { pageCounts[e.page] = (pageCounts[e.page] || 0) + 1; });
        const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // Conversions
        const convEvents = ["form_submit", "phone_click", "zalo_click", "exam_start", "exam_finish"];
        const conversions = events.filter(e => convEvents.includes(e.eventType)).length;

        // Country breakdown
        const countries: Record<string, number> = {};
        events.forEach(e => {
            const c = e.country || "Unknown";
            countries[c] = (countries[c] || 0) + 1;
        });

        // Goals progress
        let goalsReport = "";
        try {
            const goals = await prisma.analyticsGoal.findMany({ where: { active: true } });
            if (goals.length > 0) {
                goalsReport = "\n\n## 🎯 Goals Progress\n";
                for (const g of goals) {
                    // Simple count for daily goals
                    const metricEvents: Record<string, string[]> = {
                        page_views: ["page_view"], sessions: ["page_view"],
                        conversions: ["form_submit", "phone_click", "zalo_click"],
                        exam_starts: ["exam_start"], form_submits: ["form_submit"],
                    };
                    const evtTypes = metricEvents[g.metric] || [g.metric];
                    let current = 0;
                    if (g.metric === "sessions") {
                        current = new Set(events.filter(e => evtTypes.includes(e.eventType) && (!g.site || e.site === g.site)).map(e => e.sessionId)).size;
                    } else {
                        current = events.filter(e => evtTypes.includes(e.eventType) && (!g.site || e.site === g.site)).length;
                    }
                    const pct = g.target > 0 ? Math.round((current / g.target) * 100) : 0;
                    const emoji = pct >= 100 ? "✅" : pct >= 50 ? "🟡" : "🔴";
                    goalsReport += `- ${emoji} **${g.name}**: ${current}/${g.target} (${pct}%) — ${g.period}\n`;
                }
            }
        } catch { /* ignore if goals table doesn't exist yet */ }

        // Build email content (markdown)
        const report = `# 📊 Báo cáo Analytics — ${dateStr}

## Tổng quan
| Metric | Giá trị |
|--------|---------|
| 📄 Lượt xem | ${pageViews} |
| 👥 Sessions | ${sessions} |
| 🧑 Users | ${users} |
| 🎯 Conversions | ${conversions} |
| 🐛 Lỗi | ${errors} |

## Site Breakdown
${Object.entries(sites).map(([s, c]) => `- **${s}**: ${c} events`).join("\n")}

## Top Pages
${topPages.map(([p, c], i) => `${i + 1}. ${p} — **${c}** views`).join("\n")}

## 🌍 Countries
${Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `- ${c}: ${n}`).join("\n")}
${goalsReport}
---
*Báo cáo tự động được tạo bởi Analytics V2*`;

        // Store as insight
        await prisma.analyticsAiInsight.create({
            data: {
                date: dateStr,
                type: "email_digest",
                title: `📊 Daily Digest — ${dateStr}`,
                content: report,
                severity: errors > 10 ? "warning" : "info",
                metrics: { pageViews, sessions, users, conversions, errors, sites, topPages, countries },
            },
        });

        // Send email to all admin users
        const { sendEmail, markdownToHtml } = await import("@/lib/email");
        const adminUsers = await prisma.user.findMany({
            where: { role: "admin", isActive: true },
            select: { email: true },
        });
        const recipients = adminUsers.map(u => u.email).filter(Boolean);

        let emailResult = { success: false, preview: true } as { success: boolean; preview?: boolean; id?: string; error?: string };
        if (recipients.length > 0) {
            emailResult = await sendEmail({
                to: recipients,
                subject: `📊 CRM Daily Digest — ${dateStr}`,
                html: markdownToHtml(report),
                text: report,
            });
        }

        return NextResponse.json({
            ok: true,
            date: dateStr,
            summary: { pageViews, sessions, users, conversions, errors },
            email: {
                sent: emailResult.success && !emailResult.preview,
                preview: emailResult.preview || false,
                recipients: recipients.length,
                id: emailResult.id,
                error: emailResult.error,
            },
            report,
        });
    } catch (err) {
        console.error("[email-report.POST]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// GET — fetch recent email digest reports
export async function GET(req: Request) {
    const { requireMappedRoutePermissionAuth } = await import("@/lib/route-auth");
    const { requireAdminRole } = await import("@/lib/admin-auth");
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const reports = await prisma.analyticsAiInsight.findMany({
            where: { type: "email_digest" },
            orderBy: { createdAt: "desc" },
            take: 10,
        });
        return NextResponse.json({ reports });
    } catch (err) {
        console.error("[email-report.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
