import { NextResponse } from "next/server";
import type { StudyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

const VALID_STATUSES: StudyStatus[] = ["studying", "paused", "done"];

/**
 * POST /api/students/bulk-status
 *
 * Bulk update studyStatus for multiple students.
 * Body: { studentIds: string[], studyStatus: StudyStatus }
 */
export async function POST(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "students", action: "UPDATE" });
    if (authResult.error) return authResult.error;

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
        }

        const { studentIds, studyStatus } = body as { studentIds: unknown; studyStatus: unknown };
        if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.length > 100) {
            return jsonError(400, "VALIDATION_ERROR", "studentIds phải là mảng 1-100 phần tử");
        }
        if (typeof studyStatus !== "string" || !VALID_STATUSES.includes(studyStatus as StudyStatus)) {
            return jsonError(400, "VALIDATION_ERROR", `studyStatus phải là: ${VALID_STATUSES.join(", ")}`);
        }

        const result = await prisma.student.updateMany({
            where: { id: { in: studentIds as string[] } },
            data: { studyStatus: studyStatus as StudyStatus, updatedAt: new Date() },
        });

        return NextResponse.json({ updated: result.count });
    } catch (err) {
    console.error("[students.bulk-status]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
