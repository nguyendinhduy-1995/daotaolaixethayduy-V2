import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/landing-status?key=bo-doi-xuat-ngu
 * Public endpoint — returns { enabled: boolean } for a landing page.
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
        return NextResponse.json({ enabled: false });
    }

    const featureKey = `landing_${key.replace(/-/g, "_")}`;
    try {
        const setting = await prisma.featureSetting.findUnique({
            where: { key: featureKey },
        });
        // Default: enabled if no setting exists (backwards compat)
        return NextResponse.json({ enabled: setting ? setting.enabled : true });
    } catch {
        return NextResponse.json({ enabled: true });
    }
}
