import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/public/lead
 * Public endpoint – no auth required.
 * Creates a new lead from the landing page form.
 * Supports auto-assign by province when feature is enabled.
 */
export async function POST(req: Request) {
    const rateLimited = checkRateLimit(req, { name: "public-lead", maxRequests: 10, windowSec: 60 });
    if (rateLimited) return rateLimited;

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return jsonError(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ");
        }

        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const phone = typeof body.phone === "string" ? body.phone.replace(/\s+/g, "").trim() : "";
        const province = typeof body.province === "string" ? body.province.trim() : "";
        const licenseType = typeof body.licenseType === "string" ? body.licenseType.trim().toUpperCase() : "";
        const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") as string[] : [];

        // Honeypot: if hidden field present, silently ignore (anti-spam)
        if (body._hp) {
            return NextResponse.json({ ok: true, message: "Đã ghi nhận thông tin. Chúng tôi sẽ liên hệ bạn sớm!" });
        }

        if (!fullName) {
            return jsonError(400, "VALIDATION_ERROR", "Vui lòng nhập họ và tên");
        }

        if (!phone || !/^0\d{8,10}$/.test(phone)) {
            return jsonError(400, "VALIDATION_ERROR", "Số điện thoại không hợp lệ");
        }

        // Check for duplicate phone – touch updatedAt so it surfaces in admin
        const existing = await prisma.lead.findUnique({ where: { phone } });
        if (existing) {
            await prisma.lead.update({
                where: { id: existing.id },
                data: {
                    updatedAt: new Date(),
                    ...(fullName && !existing.fullName ? { fullName } : {}),
                    ...(province && !existing.province ? { province } : {}),
                    ...(licenseType && !existing.licenseType ? { licenseType } : {}),
                    ...(tags.length > 0 ? { tags: { set: [...new Set([...existing.tags, ...tags])] } } : {}),
                },
            });
            return NextResponse.json({ ok: true, message: "Đã ghi nhận thông tin. Chúng tôi sẽ liên hệ bạn sớm!" });
        }

        // ── Province alias normalisation ──
        const PROVINCE_ALIASES: Record<string, string> = {
            "tphcm": "hồ chí minh",
            "tp.hcm": "hồ chí minh",
            "tp hcm": "hồ chí minh",
            "tp. hồ chí minh": "hồ chí minh",
            "sài gòn": "hồ chí minh",
            "saigon": "hồ chí minh",
            "sg": "hồ chí minh",
            "bình dương": "bình dương",
            "biên hòa": "đồng nai",
            "vũng tàu": "bà rịa - vũng tàu",
        };

        function normalizeProvince(raw: string): string {
            const norm = raw.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
            // Check aliases
            if (PROVINCE_ALIASES[norm]) return PROVINCE_ALIASES[norm];
            // Check if raw starts with alias (e.g. "Gò vấp- Hồ Chí Minh")
            for (const [alias, canonical] of Object.entries(PROVINCE_ALIASES)) {
                if (norm.includes(alias)) return canonical;
            }
            return norm;
        }

        // ── Resolve branch & owner via auto-assign ──
        let branchId: string | null = null;
        let ownerId: string | null = null;

        // Check if auto-assign by province is enabled
        const autoAssignSetting = await prisma.featureSetting.findUnique({
            where: { key: "auto_assign_by_province" },
        });

        if (autoAssignSetting?.enabled && province) {
            const provinceNorm = normalizeProvince(province);

            // Find branch matching province
            const branches = await prisma.branch.findMany({
                where: { isActive: true },
                select: { id: true, name: true, provinces: true },
            });

            const matchedBranch = branches.find((b) =>
                (b.provinces as string[]).some((p) => {
                    const pNorm = p.toLowerCase().replace(/\s+/g, " ").trim();
                    return pNorm === provinceNorm ||
                        provinceNorm.includes(pNorm) ||
                        pNorm.includes(provinceNorm);
                })
            );

            if (matchedBranch) {
                branchId = matchedBranch.id;

                // Round-robin: find telesales in this branch; fallback to managers if no telesales
                let staff = await prisma.user.findMany({
                    where: { branchId: matchedBranch.id, role: "telesales", isActive: true },
                    select: { id: true },
                    orderBy: { createdAt: "asc" },
                });

                if (staff.length === 0) {
                    staff = await prisma.user.findMany({
                        where: { branchId: matchedBranch.id, role: "manager", isActive: true },
                        select: { id: true },
                        orderBy: { createdAt: "asc" },
                    });
                }

                if (staff.length > 0) {
                    // Count leads per staff for load balancing
                    const leadCounts = await Promise.all(
                        staff.map(async (t) => ({
                            id: t.id,
                            count: await prisma.lead.count({ where: { ownerId: t.id } }),
                        }))
                    );
                    // Pick user with fewest owned leads
                    leadCounts.sort((a, b) => a.count - b.count);
                    ownerId = leadCounts[0].id;
                }
            }
        }

        // Fallback: default branch
        if (!branchId) {
            const defaultBranch = await prisma.branch.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: "asc" },
                select: { id: true },
            });

            if (!defaultBranch) {
                console.error("[public.lead] No active branch found – cannot create lead");
                return jsonError(500, "INTERNAL_ERROR", "Hệ thống chưa sẵn sàng. Vui lòng liên hệ hotline.");
            }

            branchId = defaultBranch.id;
        }

        const leadSource = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "landing";

        const lead = await prisma.lead.create({
            data: {
                fullName,
                phone,
                province: province || null,
                licenseType: licenseType || null,
                source: leadSource,
                channel: "web",
                status: "HAS_PHONE",
                branchId,
                ownerId,
                ...(tags.length > 0 ? { tags } : {}),
            },
        });

        // Create NEW event
        await prisma.leadEvent.create({
            data: {
                leadId: lead.id,
                type: "NEW",
                createdAt: new Date(),
                payload: {
                    source: "landing",
                    channel: "web",
                    via: "api.public.lead",
                    ...(ownerId ? { autoAssigned: true, ownerId } : {}),
                },
            },
        });

        return NextResponse.json({ ok: true, message: "Đã ghi nhận thông tin. Chúng tôi sẽ liên hệ bạn sớm!" });
    } catch (err) {
        console.error("[public.lead]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống. Vui lòng thử lại sau.");
    }
}
