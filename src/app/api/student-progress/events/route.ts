import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { verifyServiceOrStudentAuth } from "@/lib/service-auth";

export async function POST(req: Request) {
    const auth = await verifyServiceOrStudentAuth(req);
    if (!auth.ok) return auth.response;

    const body = auth.body as {
        eventId: string;
        studentId: string;
        type: string;
        occurredAt: string;
        payload?: unknown;
    };

    if (!body.eventId || !body.studentId || !body.type) {
        return jsonError(400, "VALIDATION_ERROR", "eventId, studentId, and type are required");
    }

    // Idempotent: if eventId exists, return success
    const existing = await prisma.appEventLog.findUnique({ where: { eventId: body.eventId } });
    if (existing) {
        return NextResponse.json({ ok: true, id: existing.id, deduplicated: true });
    }

    try {
        const event = await prisma.appEventLog.create({
            data: {
                eventId: body.eventId,
                studentId: body.studentId,
                type: body.type,
                occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
                payload: body.payload as object ?? undefined,
            },
        });

        return NextResponse.json({ ok: true, id: event.id });
    } catch (err) {
        console.error("[student-progress.events]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to create event");
    }
}
