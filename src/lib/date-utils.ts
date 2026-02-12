"use client";

export function formatDateYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayInHoChiMinh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export function shiftDateYmd(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateYmd(date);
}

export function getDateRangeYmd(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (start.getTime() > end.getTime()) return [];

  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    result.push(formatDateYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function formatTimeHms(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function firstDayOfMonthYmd(baseYmd: string) {
  const base = new Date(`${baseYmd}T00:00:00`);
  return formatDateYmd(new Date(base.getFullYear(), base.getMonth(), 1));
}
