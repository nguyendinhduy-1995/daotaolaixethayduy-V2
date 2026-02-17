"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MobileShell } from "@/components/mobile/MobileShell";
import { clearToken, getToken } from "@/lib/auth-client";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { todayInHoChiMinh } from "@/lib/date-utils";
import { roleLabelVi } from "@/lib/kpi-metrics-catalog";

type FeedbackType = "HELPFUL" | "NOT_HELPFUL" | "DONE";
type FeedbackReason =
  | "dung_trong_luc_can"
  | "de_lam_theo"
  | "chua_sat_thuc_te"
  | "thieu_du_lieu"
  | "uu_tien_khac"
  | "khac";

type Suggestion = {
  id: string;
  dateKey: string;
  role: string;
  title: string;
  content: string;
  scoreColor: "RED" | "YELLOW" | "GREEN";
  actionsJson?: Array<Record<string, unknown>> | null;
  branch?: { id: string; name: string } | null;
  owner?: { id: string; name: string | null; email: string } | null;
  _count?: { feedbacks: number };
  feedbackStats?: { total: number; helpful: number; notHelpful: number; done: number };
  n8nNotes?: string;
  myFeedback?: {
    id: string;
    feedbackType: FeedbackType;
    reason: FeedbackReason;
    reasonDetail?: string | null;
    note?: string | null;
    createdAt: string;
  } | null;
};

type FeedbackDraft = {
  feedbackType: FeedbackType;
  reason: FeedbackReason;
  reasonDetail: string;
  note: string;
  data: string;
  hen: string;
  den: string;
  ky: string;
};

const FEEDBACK_REASON_OPTIONS: Array<{ value: FeedbackReason; label: string }> = [
  { value: "dung_trong_luc_can", label: "Đúng lúc, dễ áp dụng" },
  { value: "de_lam_theo", label: "Nội dung rõ, làm theo được" },
  { value: "chua_sat_thuc_te", label: "Chưa sát tình huống thực tế" },
  { value: "thieu_du_lieu", label: "Thiếu dữ liệu để làm" },
  { value: "uu_tien_khac", label: "Đang ưu tiên việc khác" },
  { value: "khac", label: "Khác" },
];

function errText(error: unknown) {
  const e = error as ApiClientError;
  return `${e.code || "INTERNAL_ERROR"}: ${e.message || "Lỗi không xác định"}`;
}

function scoreColorClass(color: Suggestion["scoreColor"]) {
  if (color === "RED") return "bg-rose-100 text-rose-700 border-rose-200";
  if (color === "YELLOW") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function scoreLabel(color: Suggestion["scoreColor"]) {
  if (color === "RED") return "Đỏ";
  if (color === "YELLOW") return "Vàng";
  return "Xanh";
}

function feedbackTypeLabel(type: FeedbackType) {
  if (type === "HELPFUL") return "Hữu ích";
  if (type === "NOT_HELPFUL") return "Chưa đúng";
  return "Đã làm xong";
}

function toFriendlyText(value: unknown) {
  return String(value || "")
    .replaceAll("HAS_PHONE", "data có số")
    .replaceAll("APPOINTED", "lịch hẹn")
    .replaceAll("ARRIVED", "khách đến")
    .replaceAll("SIGNED", "khách ký")
    .replaceAll("direct_page", "Trực Page")
    .replaceAll("telesales", "Tư vấn")
    .replaceAll("outbound", "danh sách gọi")
    .replaceAll("dispatch", "gửi đi")
    .replaceAll("workflow", "luồng tự động")
    .replaceAll("metric", "chỉ số")
    .replaceAll("Outbound", "Danh sách gọi");
}

function buildDefaultDraft(feedbackType: FeedbackType): FeedbackDraft {
  return {
    feedbackType,
    reason: feedbackType === "NOT_HELPFUL" ? "chua_sat_thuc_te" : "dung_trong_luc_can",
    reasonDetail: "",
    note: "",
    data: "",
    hen: "",
    den: "",
    ky: "",
  };
}

function toOptionalNumber(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeActionType(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function getSuggestionIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const candidate = (payload as Record<string, unknown>).suggestionId;
  return typeof candidate === "string" ? candidate : "";
}

function promptStorageKey(suggestionId: string, dateKey: string) {
  return `ai_feedback_prompt:${dateKey}:${suggestionId}`;
}

function wasPromptedToday(suggestionId: string, dateKey: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(promptStorageKey(suggestionId, dateKey)) === "1";
}

function markPromptedToday(suggestionId: string, dateKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(promptStorageKey(suggestionId, dateKey), "1");
}

export default function AiKpiCoachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || todayInHoChiMinh());
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applyingId, setApplyingId] = useState("");
  const [feedbackLoadingId, setFeedbackLoadingId] = useState("");
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<string[]>([]);
  const [promptedSuggestionIds, setPromptedSuggestionIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft>(buildDefaultDraft("HELPFUL"));

  const grouped = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    for (const item of items) {
      const rows = map.get(item.role) || [];
      rows.push(item);
      map.set(item.role, rows);
    }
    return [...map.entries()];
  }, [items]);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ items: Suggestion[] }>(`/api/ai/suggestions?date=${date}`, { token });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(`Lỗi tải gợi ý: ${errText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [date, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logApplyAction = useCallback(
    async (input: { suggestion: Suggestion; actionKey: string; action: Record<string, unknown> }) => {
      const token = getToken();
      if (!token) return;
      try {
        await fetchJson("/api/automation/logs", {
          method: "POST",
          token,
          body: {
            channel: "ui",
            milestone: "ai-apply",
            status: "sent",
            branchId: input.suggestion.branch?.id,
            leadId: typeof input.action.leadId === "string" ? input.action.leadId : undefined,
            studentId: typeof input.action.studentId === "string" ? input.action.studentId : undefined,
            payload: {
              source: "ui",
              suggestionId: input.suggestion.id,
              actionKey: input.actionKey,
              createdById: "current-user",
            },
          },
        });
      } catch {
        // Không chặn luồng chính nếu log phụ thất bại.
      }
    },
    []
  );

  const createCallList = useCallback(
    async (suggestion: Suggestion, action: Record<string, unknown>, actionKey: string) => {
      const token = getToken();
      if (!token) return;
      await fetchJson("/api/outbound/jobs", {
        method: "POST",
        token,
        body: {
          channel: action.channel || "CALL_NOTE",
          templateKey: action.templateKey || "remind_schedule",
          leadId: action.leadId,
          studentId: action.studentId,
          to: action.to,
          variables: action.variables,
          note: `Tạo từ gợi ý ${suggestion.id}`,
          suggestionId: suggestion.id,
          actionKey,
        },
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
        },
      });
      await logApplyAction({ suggestion, actionKey, action });
    },
    [logApplyAction]
  );

  const createTaskFromAction = useCallback(
    async (suggestion: Suggestion, action: Record<string, unknown>, taskType: "TASK" | "REMINDER") => {
      const token = getToken();
      if (!token) return;
      await fetchJson("/api/tasks", {
        method: "POST",
        token,
        body: {
          title: String(action.label || action.title || (taskType === "REMINDER" ? "Nhắc việc" : "Việc cần làm")),
          message: String(action.description || suggestion.title || "Xử lý theo gợi ý"),
          scope: taskType === "REMINDER" ? "SCHEDULE" : "FOLLOWUP",
          priority: String(action.priority || "MEDIUM").toUpperCase(),
          ownerId: suggestion.owner?.id,
          dueAt: typeof action.dueAt === "string" ? action.dueAt : undefined,
          leadId: typeof action.leadId === "string" ? action.leadId : undefined,
          studentId: typeof action.studentId === "string" ? action.studentId : undefined,
          suggestionId: suggestion.id,
          actionKey: taskType === "REMINDER" ? "CREATE_REMINDER" : "CREATE_TASK",
          type: taskType,
          payload: {
            source: "ui",
            actionType: taskType,
          },
        },
      });
      await logApplyAction({ suggestion, actionKey: taskType === "REMINDER" ? "CREATE_REMINDER" : "CREATE_TASK", action });
    },
    [logApplyAction]
  );

  const applySuggestion = useCallback(
    async (item: Suggestion) => {
      const actions = Array.isArray(item.actionsJson) ? item.actionsJson : [];
      if (actions.length === 0) {
        setError("Gợi ý này chưa có hành động để áp dụng.");
        return;
      }

      setApplyingId(item.id);
      setError("");
      try {
        for (const raw of actions) {
          const action = raw as Record<string, unknown>;
          const actionType = normalizeActionType(action.type || action.actionType);

          if (actionType === "CREATE_TASK") {
            await createTaskFromAction(item, action, "TASK");
            continue;
          }

          if (actionType === "CREATE_REMINDER") {
            await createTaskFromAction(item, action, "REMINDER");
            continue;
          }

          if (actionType === "CREATE_CALL_LIST" || actionType === "CREATE_OUTBOUND_JOB") {
            await createCallList(item, action, actionType);
            continue;
          }

          if (actionType === "UPDATE_LEAD_STATUS") {
            setError("Hành động cập nhật trạng thái đang ở chế độ gợi ý, chưa tự chạy.");
            continue;
          }

          // fallback: nếu action không chuẩn thì ưu tiên tạo việc chung.
          await createTaskFromAction(item, action, "TASK");
        }

        setAppliedSuggestionIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      } catch (e) {
        setError(`Lỗi áp dụng gợi ý: ${errText(e)}`);
      } finally {
        setApplyingId("");
      }
    },
    [createCallList, createTaskFromAction]
  );

  useEffect(() => {
    async function promptFeedbackAfterCompletion() {
      if (sheetOpen) return;
      if (loading || items.length === 0) return;
      const token = getToken();
      if (!token) return;

      try {
        const doneTasks = await fetchJson<{ items: Array<{ id: string; payload?: unknown }> }>(
          `/api/tasks?status=DONE&from=${date}&to=${date}&page=1&pageSize=100`,
          { token }
        );

        const doneSuggestionIds = new Set(
          (doneTasks.items || [])
            .map((row) => getSuggestionIdFromPayload(row.payload))
            .filter((id) => id)
        );

        const needPrompt = items.find(
          (item) =>
            doneSuggestionIds.has(item.id) &&
            !item.myFeedback &&
            !promptedSuggestionIds.includes(item.id) &&
            !wasPromptedToday(item.id, date)
        );

        if (needPrompt) {
          markPromptedToday(needPrompt.id, date);
          setPromptedSuggestionIds((prev) => [...prev, needPrompt.id]);
          setActiveSuggestionId(needPrompt.id);
          setFeedbackDraft(buildDefaultDraft("HELPFUL"));
          setSheetOpen(true);
        }
      } catch {
        // Không chặn UI nếu kiểm tra nhắc phản hồi lỗi.
      }
    }

    void promptFeedbackAfterCompletion();
  }, [date, items, loading, promptedSuggestionIds, sheetOpen]);

  function openFeedbackSheet(suggestionId: string, feedbackType: FeedbackType) {
    setActiveSuggestionId(suggestionId);
    setFeedbackDraft(buildDefaultDraft(feedbackType));
    setSheetOpen(true);
  }

  async function submitFeedback() {
    const suggestionId = activeSuggestionId;
    if (!suggestionId) return;
    if (feedbackDraft.reason === "khac" && !feedbackDraft.reasonDetail.trim()) {
      setError("Vui lòng nhập lý do cụ thể khi chọn Khác.");
      return;
    }

    const token = getToken();
    if (!token) return;
    setFeedbackLoadingId(suggestionId);
    setError("");

    try {
      const payload = {
        feedbackType: feedbackDraft.feedbackType,
        reason: feedbackDraft.reason,
        reasonDetail: feedbackDraft.reasonDetail.trim() || undefined,
        note: feedbackDraft.note.trim() || undefined,
        actualResult: {
          data: toOptionalNumber(feedbackDraft.data),
          hen: toOptionalNumber(feedbackDraft.hen),
          den: toOptionalNumber(feedbackDraft.den),
          ky: toOptionalNumber(feedbackDraft.ky),
        },
      };

      const response = await fetchJson<{
        feedback: { id: string; feedbackType: FeedbackType; reason: FeedbackReason; note?: string | null; createdAt: string };
      }>(`/api/ai/suggestions/${suggestionId}/feedback`, {
        method: "POST",
        token,
        body: payload,
      });

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== suggestionId) return item;
          const stats = item.feedbackStats || { total: item._count?.feedbacks || 0, helpful: 0, notHelpful: 0, done: 0 };
          const nextStats = { ...stats, total: stats.total + 1 };
          if (response.feedback.feedbackType === "HELPFUL") nextStats.helpful += 1;
          if (response.feedback.feedbackType === "NOT_HELPFUL") nextStats.notHelpful += 1;
          if (response.feedback.feedbackType === "DONE") nextStats.done += 1;

          return {
            ...item,
            _count: { feedbacks: nextStats.total },
            feedbackStats: nextStats,
            myFeedback: {
              id: response.feedback.id,
              feedbackType: response.feedback.feedbackType,
              reason: response.feedback.reason,
              reasonDetail: feedbackDraft.reasonDetail || null,
              note: response.feedback.note || null,
              createdAt: response.feedback.createdAt,
            },
          };
        })
      );

      setSheetOpen(false);
      setActiveSuggestionId(null);
    } catch (e) {
      setError(`Lỗi gửi phản hồi: ${errText(e)}`);
    } finally {
      setFeedbackLoadingId("");
    }
  }

  return (
    <MobileShell title="Trợ lý công việc" subtitle="Gợi ý việc nên làm theo dữ liệu hôm nay">
      <div className="space-y-4 py-3 md:py-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm md:p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ngày dữ liệu</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button onClick={loadData} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Đang tải...
                </span>
              ) : (
                "Làm mới"
              )}
            </Button>
          </div>
        </div>

        {error ? <Alert type="error" message={error} /> : null}

        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Đang tải gợi ý công việc...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Chưa có gợi ý công việc cho ngày đã chọn.
          </div>
        ) : (
          grouped.map(([role, rows]) => (
            <section key={role} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Vai trò: {roleLabelVi(role)}</h2>
              {rows.map((item) => {
                const alreadyFeedback = Boolean(item.myFeedback);
                const alreadyApplied = appliedSuggestionIds.includes(item.id);
                return (
                  <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${scoreColorClass(item.scoreColor)}`}>
                        {scoreLabel(item.scoreColor)}
                      </span>
                      <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                      {alreadyApplied ? (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">Đã áp dụng</span>
                      ) : null}
                      {alreadyFeedback ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          Đã phản hồi
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{toFriendlyText(item.content)}</p>

                    {Array.isArray(item.actionsJson) && item.actionsJson.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Gợi ý nên làm</p>
                        {item.actionsJson.map((rawAction, idx) => {
                          const action = rawAction as Record<string, unknown>;
                          const label = toFriendlyText(action.label || action.title || `Hành động ${idx + 1}`);
                          return (
                            <div
                              key={`${item.id}-${idx}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-zinc-900">{label}</p>
                                <p className="text-xs text-zinc-500">{toFriendlyText(action.description || action.type || "")}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {item.n8nNotes ? (
                      <details className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-sky-700">
                          Ghi chú n8n
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-xs text-sky-800">{item.n8nNotes}</p>
                      </details>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        className="tap-feedback"
                        onClick={() => applySuggestion(item)}
                        disabled={alreadyApplied || applyingId === item.id}
                      >
                        {applyingId === item.id ? "Đang áp dụng..." : "Áp dụng"}
                      </Button>
                      <Button
                        variant="secondary"
                        className="tap-feedback"
                        disabled={alreadyFeedback || feedbackLoadingId === item.id}
                        onClick={() => openFeedbackSheet(item.id, "HELPFUL")}
                      >
                        Hữu ích
                      </Button>
                      <Button
                        variant="secondary"
                        className="tap-feedback"
                        disabled={alreadyFeedback || feedbackLoadingId === item.id}
                        onClick={() => openFeedbackSheet(item.id, "NOT_HELPFUL")}
                      >
                        Chưa đúng
                      </Button>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      Tổng phản hồi: {item.feedbackStats?.total ?? item._count?.feedbacks ?? 0} | Hữu ích: {item.feedbackStats?.helpful ?? 0} |
                      Chưa đúng: {item.feedbackStats?.notHelpful ?? 0} | Đã làm xong: {item.feedbackStats?.done ?? 0}
                    </div>
                    {item.myFeedback ? (
                      <div className="mt-1 text-xs text-zinc-500">Phản hồi của bạn: {feedbackTypeLabel(item.myFeedback.feedbackType)}</div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))
        )}
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={
          feedbackDraft.feedbackType === "HELPFUL"
            ? "Phản hồi hữu ích"
            : feedbackDraft.feedbackType === "NOT_HELPFUL"
              ? "Phản hồi chưa đúng"
              : "Xác nhận đã làm xong"
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (activeSuggestionId) markPromptedToday(activeSuggestionId, date);
                setSheetOpen(false);
              }}
            >
              Để sau
            </Button>
            <Button onClick={submitFeedback} disabled={!activeSuggestionId || feedbackLoadingId === activeSuggestionId}>
              {feedbackLoadingId === activeSuggestionId ? "Đang gửi..." : "Gửi phản hồi"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1 font-medium text-zinc-900">Lý do</p>
            <select
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              value={feedbackDraft.reason}
              onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, reason: e.target.value as FeedbackReason }))}
            >
              {FEEDBACK_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {feedbackDraft.reason === "khac" ? (
            <div>
              <p className="mb-1 font-medium text-zinc-900">Lý do cụ thể</p>
              <Input
                placeholder="Nhập lý do của bạn"
                value={feedbackDraft.reasonDetail}
                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, reasonDetail: e.target.value }))}
              />
            </div>
          ) : null}

          <div>
            <p className="mb-1 font-medium text-zinc-900">Ghi chú thêm (tuỳ chọn)</p>
            <textarea
              className="min-h-[82px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              placeholder="Ví dụ: Khách phản hồi tốt khi gọi lại sau 16h"
              value={feedbackDraft.note}
              onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>

          <div>
            <p className="mb-1 font-medium text-zinc-900">Kết quả thực tế (tuỳ chọn)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Data có số"
                value={feedbackDraft.data}
                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, data: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                placeholder="Lịch hẹn"
                value={feedbackDraft.hen}
                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, hen: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                placeholder="Khách đến"
                value={feedbackDraft.den}
                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, den: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                placeholder="Khách ký"
                value={feedbackDraft.ky}
                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, ky: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </BottomSheet>
    </MobileShell>
  );
}
