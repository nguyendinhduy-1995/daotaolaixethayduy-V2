import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_SITES = ["LANDING", "CRM", "STUDENT", "TAPLAI"] as const;

export async function GET(req: Request) {
    const url = new URL(req.url);
    const siteParam = url.searchParams.get("site");

    if (!siteParam || !(VALID_SITES as readonly string[]).includes(siteParam)) {
        return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: "site query param required (LANDING|CRM|STUDENT|TAPLAI)" } },
            { status: 400 }
        );
    }

    try {
        const codes = await prisma.trackingCode.findMany({
            where: {
                isEnabled: true,
                site: { in: ["GLOBAL", siteParam as (typeof VALID_SITES)[number]] },
            },
            select: { site: true, key: true, placement: true, code: true },
            orderBy: { createdAt: "asc" },
        });

        // Override: site-specific wins over GLOBAL for same key
        const merged = new Map<string, { placement: string; code: string }>();
        for (const c of codes) {
            const existing = merged.get(c.key);
            // Always set if not exists; overwrite if this is site-specific (not GLOBAL)
            if (!existing || c.site !== "GLOBAL") {
                merged.set(c.key, { placement: c.placement, code: c.code });
            }
        }

        const head: string[] = [];
        const bodyTop: string[] = [];
        const bodyBottom: string[] = [];

        for (const entry of merged.values()) {
            if (entry.placement === "HEAD") head.push(entry.code);
            else if (entry.placement === "BODY_TOP") bodyTop.push(entry.code);
            else if (entry.placement === "BODY_BOTTOM") bodyBottom.push(entry.code);
        }

        return NextResponse.json(
            { head, bodyTop, bodyBottom },
            { headers: { "Cache-Control": "public, max-age=60" } }
        );
    } catch (err) {
        console.error("[tracking-codes.GET]", err);
        return NextResponse.json({ head: [], bodyTop: [], bodyBottom: [] }, { status: 500 });
    }
}
