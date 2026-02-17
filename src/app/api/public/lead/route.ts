import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/public/lead
 * Public endpoint – no auth required.
 * Creates a new lead from the landing page form.
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
                },
            });
            // Still return success to the user (don't reveal existence)
            return NextResponse.json({ ok: true, message: "Đã ghi nhận thông tin. Chúng tôi sẽ liên hệ bạn sớm!" });
        }

        // Find default branch
        const defaultBranch = await prisma.branch.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            select: { id: true },
        });

        if (!defaultBranch) {
            console.error("[public.lead] No active branch found – cannot create lead");
            return jsonError(500, "INTERNAL_ERROR", "Hệ thống chưa sẵn sàng. Vui lòng liên hệ hotline.");
        }

        await prisma.lead.create({
            data: {
                fullName,
                phone,
                province: province || null,
                licenseType: licenseType || null,
                source: "landing",
                channel: "web",
                status: "HAS_PHONE",
                branchId: defaultBranch.id,
            },
        });

        return NextResponse.json({ ok: true, message: "Đã ghi nhận thông tin. Chúng tôi sẽ liên hệ bạn sớm!" });
    } catch (err) {
        console.error("[public.lead]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống. Vui lòng thử lại sau.");
    }
}
