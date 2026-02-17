import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

type LogInstructorChangeInput = {
    leadId: string;
    fromInstructorId: string | null;
    toInstructorId: string | null;
    reason?: string;
    createdById?: string;
};

export async function logInstructorChange(
    input: LogInstructorChangeInput,
    tx?: Prisma.TransactionClient,
) {
    const db: DbClient = tx ?? prisma;
    return db.leadEvent.create({
        data: {
            leadId: input.leadId,
            type: "INSTRUCTOR_CHANGED",
            payload: {
                fromInstructorId: input.fromInstructorId,
                toInstructorId: input.toInstructorId,
                ...(input.reason ? { reason: input.reason } : {}),
            },
            createdById: input.createdById,
        },
    });
}
