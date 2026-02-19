import { prisma } from "@/lib/prisma";

type TrackingData = {
    head: string[];
    bodyTop: string[];
    bodyBottom: string[];
};

async function getTrackingCodes(site: string): Promise<TrackingData> {
    try {
        const codes = await prisma.trackingCode.findMany({
            where: {
                isEnabled: true,
                site: { in: ["GLOBAL", site] as ("GLOBAL" | "LANDING" | "CRM" | "STUDENT" | "TAPLAI")[] },
            },
            select: { site: true, key: true, placement: true, code: true },
            orderBy: { createdAt: "asc" },
        });

        // Override: site-specific wins over GLOBAL for same key
        const merged = new Map<string, { placement: string; code: string }>();
        for (const c of codes) {
            const existing = merged.get(c.key);
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

        return { head, bodyTop, bodyBottom };
    } catch {
        return { head: [], bodyTop: [], bodyBottom: [] };
    }
}

export async function TrackingScripts({ site = "LANDING" }: { site?: string }) {
    const { head, bodyTop } = await getTrackingCodes(site);

    return (
        <>
            {head.map((snippet, i) => (
                <div key={`tracking-head-${i}`} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: snippet }} />
            ))}
            {bodyTop.map((snippet, i) => (
                <div key={`tracking-body-top-${i}`} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: snippet }} />
            ))}
        </>
    );
}

export async function TrackingScriptsBottom({ site = "LANDING" }: { site?: string }) {
    const { bodyBottom } = await getTrackingCodes(site);

    if (bodyBottom.length === 0) return null;

    return (
        <>
            {bodyBottom.map((snippet, i) => (
                <div key={`tracking-body-bottom-${i}`} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: snippet }} />
            ))}
        </>
    );
}
