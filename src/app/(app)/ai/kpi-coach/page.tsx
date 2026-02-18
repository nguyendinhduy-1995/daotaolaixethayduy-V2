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

function scoreGradient(color: Suggestion["scoreColor"]) {
  if (color === "RED") return "from-rose-500 to-red-600";
  if (color === "YELLOW") return "from-amber-400 to-orange-500";
  return "from-emerald-400 to-green-600";
}

function scoreBadgeClass(color: Suggestion["scoreColor"]) {
  if (color === "RED") return "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-200";
  if (color === "YELLOW") return "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-200";
  return "bg-gradient-to-r from-emerald-400 to-green-600 text-white shadow-emerald-200";
}

function scoreLabel(color: Suggestion["scoreColor"]) {
  if (color === "RED") return "🔴 Cần lưu ý";
  if (color === "YELLOW") return "🟡 Trung bình";
  return "🟢 Tốt";
}

function feedbackTypeLabel(type: FeedbackType) {
  if (type === "HELPFUL") return "✅ Hữu ích";
  if (type === "NOT_HELPFUL") return "❌ Chưa đúng";
  return "✔️ Đã làm xong";
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

/* ---------- Skeleton ---------- */
function CoachSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="h-3 w-20 rounded-full bg-zinc-200" />
          <div className="mt-3 h-4 w-3/4 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-full rounded bg-zinc-100" />
          <div className="mt-1 h-3 w-5/6 rounded bg-zinc-100" />
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-20 rounded-xl bg-zinc-200" />
            <div className="h-8 w-20 rounded-xl bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
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
        {/* ── Header Banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 text-white shadow-lg shadow-purple-200 animate-fadeInUp">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex flex-wrap items-end gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">✨</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">AI Trợ lý KPI</h2>
              <p className="text-sm text-white/80">Gợi ý hành động dựa trên dữ liệu thực tế</p>
            </div>
          </div>
          <div className="relative mt-3 flex flex-wrap items-end gap-2">
            <div>
              <p className="text-xs font-medium text-white/70">Ngày dữ liệu</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!border-white/30 !bg-white/20 !text-white placeholder:!text-white/50" />
            </div>
            <Button onClick={loadData} disabled={loading} className="!bg-white/20 !text-white hover:!bg-white/30 backdrop-blur-sm">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Đang tải...
                </span>
              ) : (
                "🔄 Làm mới"
              )}
            </Button>
          </div>
        </div>

        {error ? <Alert type="error" message={error} /> : null}

        {/* ── Stats Summary ── */}
        {!loading && items.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 animate-fadeInUp" style={{ animationDelay: "100ms" }}>
            {[
              { label: "Tổng gợi ý", value: items.length, color: "from-blue-500 to-cyan-500", bg: "bg-blue-50" },
              { label: "Đã phản hồi", value: items.filter((i) => i.myFeedback).length, color: "from-emerald-500 to-green-500", bg: "bg-emerald-50" },
              { label: "Đã áp dụng", value: appliedSuggestionIds.length, color: "from-violet-500 to-purple-500", bg: "bg-violet-50" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-2xl ${stat.bg} p-3 text-center shadow-sm`}>
                <p className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</p>
                <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Loading / Empty / Content ── */}
        {loading ? (
          <CoachSkeleton />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center animate-fadeInUp">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">💤</div>
            <p className="font-medium text-zinc-700">Chưa có gợi ý</p>
            <p className="mt-1 text-sm text-zinc-500">Không có gợi ý công việc cho ngày đã chọn.</p>
          </div>
        ) : (
          grouped.map(([role, rows], groupIdx) => (
            <section key={role} className="space-y-3 animate-fadeInUp" style={{ animationDelay: `${(groupIdx + 1) * 150}ms` }}>
              {/* Role Header */}
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm text-white shadow-sm">
                  {role === "telesales" ? "📞" : role === "direct_page" ? "💬" : "👤"}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">{roleLabelVi(role)}</h2>
                  <p className="text-xs text-zinc-500">{rows.length} gợi ý</p>
                </div>
              </div>

              {rows.map((item, idx) => {
                const alreadyFeedback = Boolean(item.myFeedback);
                const alreadyApplied = appliedSuggestionIds.includes(item.id);
                return (
                  <article
                    key={item.id}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition-all hover:shadow-md animate-fadeInUp"
                    style={{ animationDelay: `${(groupIdx + 1) * 150 + idx * 80}ms` }}
                  >
                    {/* Gradient top accent */}
                    <div className={`h-1 bg-gradient-to-r ${scoreGradient(item.scoreColor)}`} />

                    <div className="p-4">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${scoreBadgeClass(item.scoreColor)}`}>
                          {scoreLabel(item.scoreColor)}
                        </span>
                        {alreadyApplied ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                            ✅ Đã áp dụng
                          </span>
                        ) : null}
                        {alreadyFeedback ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                            💬 Đã phản hồi
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm font-bold text-zinc-900">{item.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">{toFriendlyText(item.content)}</p>

                      {/* Actions list */}
                      {Array.isArray(item.actionsJson) && item.actionsJson.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500">
                            <span className="inline-block h-4 w-4 rounded bg-gradient-to-br from-amber-400 to-orange-500 text-center text-[10px] leading-4 text-white">⚡</span>
                            Gợi ý nên làm
                          </p>
                          {item.actionsJson.map((rawAction, actionIdx) => {
                            const action = rawAction as Record<string, unknown>;
                            const label = toFriendlyText(action.label || action.title || `Hành động ${actionIdx + 1}`);
                            return (
                              <div
                                key={`${item.id}-${actionIdx}`}
                                className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-gradient-to-r from-zinc-50 to-white p-3 transition-all hover:border-zinc-200 hover:shadow-sm"
                              >
                                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-xs text-indigo-600">
                                  {actionIdx + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-zinc-900">{label}</p>
                                  <p className="text-xs text-zinc-500">{toFriendlyText(action.description || action.type || "")}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* n8n notes */}
                      {item.n8nNotes ? (
                        <details className="mt-3 rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50 p-3">
                          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-sky-700">
                            🔧 Ghi chú n8n
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-xs text-sky-800">{item.n8nNotes}</p>
                        </details>
                      ) : null}

                      {/* Action buttons */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          className="tap-feedback !bg-gradient-to-r !from-violet-600 !to-indigo-600 !text-white !shadow-md !shadow-violet-200 hover:!shadow-lg"
                          onClick={() => applySuggestion(item)}
                          disabled={alreadyApplied || applyingId === item.id}
                        >
                          {applyingId === item.id ? "⏳ Đang áp dụng..." : "🚀 Áp dụng"}
                        </Button>
                        <Button
                          variant="secondary"
                          className="tap-feedback !border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100"
                          disabled={alreadyFeedback || feedbackLoadingId === item.id}
                          onClick={() => openFeedbackSheet(item.id, "HELPFUL")}
                        >
                          👍 Hữu ích
                        </Button>
                        <Button
                          variant="secondary"
                          className="tap-feedback !border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                          disabled={alreadyFeedback || feedbackLoadingId === item.id}
                          onClick={() => openFeedbackSheet(item.id, "NOT_HELPFUL")}
                        >
                          👎 Chưa đúng
                        </Button>
                      </div>

                      {/* Feedback stats */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">📊 Tổng: {item.feedbackStats?.total ?? item._count?.feedbacks ?? 0}</span>
                        <span className="inline-flex items-center gap-1 text-emerald-600">👍 {item.feedbackStats?.helpful ?? 0}</span>
                        <span className="inline-flex items-center gap-1 text-rose-600">👎 {item.feedbackStats?.notHelpful ?? 0}</span>
                        <span className="inline-flex items-center gap-1 text-blue-600">✅ {item.feedbackStats?.done ?? 0}</span>
                      </div>
                      {item.myFeedback ? (
                        <div className="mt-1 text-xs font-medium text-zinc-500">Phản hồi của bạn: {feedbackTypeLabel(item.myFeedback.feedbackType)}</div>
                      ) : null}
                    </div>
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
            ? "👍 Phản hồi hữu ích"
            : feedbackDraft.feedbackType === "NOT_HELPFUL"
              ? "👎 Phản hồi chưa đúng"
              : "✅ Xác nhận đã làm xong"
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
            <Button
              className="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !text-white"
              onClick={submitFeedback}
              disabled={!activeSuggestionId || feedbackLoadingId === activeSuggestionId}
            >
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
