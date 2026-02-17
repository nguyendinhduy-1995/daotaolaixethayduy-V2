"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { clearToken, fetchMe, type MeResponse } from "@/lib/auth-client";
import type { ApiClientError } from "@/lib/api-client";
import { getErrorMessageVi } from "@/lib/error-messages-vi";

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  const fromEnv = process.env.NEXT_PUBLIC_DEBUG === "1";
  const fromQuery = new URLSearchParams(window.location.search).get("DEBUG") === "1";
  const fromStorage = window.localStorage.getItem("DEBUG") === "1";
  return fromEnv || fromQuery || fromStorage;
}

function debugAuth(event: string, data?: Record<string, unknown>) {
  if (!isDebugEnabled()) return;
  console.info(`[auth-guard] ${event}`, data || {});
}

export function isAuthErrorCode(code: string | undefined) {
  return typeof code === "string" && code.startsWith("AUTH_");
}

export function handleAuthApiError(error: ApiClientError, router: AppRouterInstance) {
  if (!isAuthErrorCode(error.code)) return false;
  clearToken();
  router.replace("/login");
  return true;
}

export type AuthGuardResult =
  | { state: "ok"; user: MeResponse["user"] }
  | { state: "unauthorized"; message: string }
  | { state: "forbidden"; message: string }
  | { state: "error"; message: string };

export async function guardByAuthMe(
  router: AppRouterInstance,
  options?: { redirectOnUnauthorized?: boolean }
): Promise<AuthGuardResult> {
  const redirectOnUnauthorized = options?.redirectOnUnauthorized ?? true;
  debugAuth("start", { redirectOnUnauthorized });
  try {
    const me = await Promise.race([
      fetchMe(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AUTH_TIMEOUT")), 10000)),
    ]);
    debugAuth("ok", { userId: me.user.id, role: me.user.role });
    return { state: "ok", user: me.user };
  } catch (error) {
    const err = error as ApiClientError;
    if (err?.code === "AUTH_FORBIDDEN" || err?.status === 403) {
      debugAuth("forbidden", { status: err?.status, code: err?.code });
      return {
        state: "forbidden",
        message: "Bạn không có quyền truy cập",
      };
    }
    if (isAuthErrorCode(err?.code)) {
      clearToken();
      debugAuth("unauthorized", { status: err?.status, code: err?.code, redirectOnUnauthorized });
      if (redirectOnUnauthorized) {
        router.replace("/login");
      }
      return {
        state: "unauthorized",
        message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
      };
    }
    if (error instanceof Error && error.message === "AUTH_TIMEOUT") {
      debugAuth("timeout");
      return {
        state: "error",
        message: "Không thể kết nối máy chủ. Vui lòng thử lại.",
      };
    }
    debugAuth("error", { status: err?.status, code: err?.code });
    return {
      state: "error",
      message: getErrorMessageVi(err?.code).message,
    };
  }
}
