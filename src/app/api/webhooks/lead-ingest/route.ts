/**
 * POST /api/webhooks/lead-ingest
 *
 * Universal webhook endpoint for N8N / Facebook / Zalo lead ads.
 * Features:
 *   - Verify via shared secret header (x-webhook-secret)
 *   - Anti-duplicate by phone + externalLeadId
 *   - Idempotent — safe for N8N retry
 *
 * Env: WEBHOOK_SECRET — shared secret for verification
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/sse-bus";

export async function POST(req: Request) {
    // ─── Verify webhook secret ────────────────────────────────────
    const secret = req.headers.get("x-webhook-secret") || "";
    const expectedSecret = process.env.WEBHOOK_SECRET || "";

    if (!expectedSecret) {
        return NextResponse.json(
            { ok: false, error: "WEBHOOK_SECRET not configured on server" },
            { status: 500 }
        );
    }

    if (secret !== expectedSecret) {
        return NextResponse.json(
            { ok: false, error: "Invalid webhook secret" },
            { status: 401 }
        );
    }

    // ─── Parse body ───────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { ok: false, error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const phone = String(body.phone || "").replace(/\D/g, "");
    const fullName = String(body.fullName || body.full_name || body.name || "");
    const source = String(body.source || "webhook");
    const channel = String(body.channel || "webhook");
    const province = String(body.province || "");
    const licenseType = String(body.licenseType || body.license_type || "");
    const externalLeadId = String(body.externalLeadId || body.external_lead_id || "");

    if (!phone || phone.length < 9) {
        return NextResponse.json(
            { ok: false, error: "phone is required (min 9 digits)" },
            { status: 400 }
        );
    }

    try {
        // ─── Anti-duplicate: check phone + externalLeadId ─────────
        const existing = await prisma.lead.findFirst({
            where: { phone },
        });

        if (existing) {
            // Upsert — update if we have new info
            await prisma.lead.update({
                where: { id: existing.id },
                data: {
                    updatedAt: new Date(),
                    ...(fullName && !existing.fullName ? { fullName } : {}),
                    ...(province && !existing.province ? { province } : {}),
                    ...(licenseType && !existing.licenseType ? { licenseType } : {}),
                },
            });

            return NextResponse.json({
                ok: true,
                leadId: existing.id,
                action: "updated",
                message: "Lead already exists, updated with new info",
            });
        }

        // ─── Find default branch ──────────────────────────────────
        const defaultBranch = await prisma.branch.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!defaultBranch) {
            return NextResponse.json(
                { ok: false, error: "No branch configured in CRM" },
                { status: 500 }
            );
        }

        // ─── Create new lead ──────────────────────────────────────
        const lead = await prisma.lead.create({
            data: {
                fullName: fullName || null,
                phone,
                province: province || null,
                licenseType: licenseType || null,
                source,
                channel,
                status: "HAS_PHONE",
                branchId: defaultBranch.id,
            },
        });

        // Create NEW event
        await prisma.leadEvent.create({
            data: {
                leadId: lead.id,
                type: "NEW",
                createdAt: new Date(),
                payload: {
                    source,
                    channel,
                    externalLeadId: externalLeadId || undefined,
                    via: "webhook-ingest",
                },
            },
        });

        // Emit SSE event for real-time dashboard
        emitEvent("lead:new", {
            leadId: lead.id,
            fullName: lead.fullName,
            phone: lead.phone,
            source,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
            ok: true,
            leadId: lead.id,
            action: "created",
            message: "Lead created successfully",
        });
    } catch (err) {
        console.error("[webhook/lead-ingest]", err);
        return NextResponse.json(
            { ok: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
