import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const LEAD_STATUS_TYPES = [
  "NEW",
  "HAS_PHONE",
  "APPOINTED",
  "ARRIVED",
  "SIGNED",
  "STUDYING",
  "EXAMED",
  "RESULT",
  "LOST",
] as const;

export const LEAD_EVENT_TYPES = [...LEAD_STATUS_TYPES, "CALLED", "OWNER_CHANGED", "ASSIGNED_OWNER", "INSTRUCTOR_CHANGED"] as const;

export const STATUS_TRANSITION_EVENT_TYPES = [
  "APPOINTED",
  "ARRIVED",
  "SIGNED",
  "STUDYING",
  "EXAMED",
  "RESULT",
  "LOST",
] as const;

export type LeadStatusType = (typeof LEAD_STATUS_TYPES)[number];
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number];

type DbClient = PrismaClient | Prisma.TransactionClient;

export function isLeadStatusType(value: unknown): value is LeadStatusType {
  return typeof value === "string" && LEAD_STATUS_TYPES.includes(value as LeadStatusType);
}

export function isLeadEventType(value: unknown): value is LeadEventType {
  return typeof value === "string" && LEAD_EVENT_TYPES.includes(value as LeadEventType);
}

export function isStatusTransitionEventType(value: unknown): value is LeadStatusType {
  return (
    typeof value === "string" &&
    STATUS_TRANSITION_EVENT_TYPES.includes(value as (typeof STATUS_TRANSITION_EVENT_TYPES)[number])
  );
}

type LogLeadEventInput = {
  leadId: string;
  type: LeadEventType;
  note?: string;
  meta?: unknown;
  createdById?: string;
};

export async function logLeadEvent(
  { leadId, type, note, meta, createdById }: LogLeadEventInput,
  tx?: Prisma.TransactionClient
) {
  const db: DbClient = tx ?? prisma;
  const payload =
    note !== undefined || meta !== undefined
      ? {
        ...(note !== undefined ? { note } : {}),
        ...(meta !== undefined ? { meta } : {}),
      }
      : undefined;

  return db.leadEvent.create({
    data: {
      leadId,
      type,
      payload,
      createdById,
    },
  });
}
