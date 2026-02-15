"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { clearToken, fetchMe, type MeResponse } from "@/lib/auth-client";
import type { ApiClientError } from "@/lib/api-client";

export function isAuthErrorCode(code: string | undefined) {
  return typeof code === "string" && code.startsWith("AUTH_");
}

export function handleAuthApiError(error: ApiClientError, router: AppRouterInstance) {
  if (!isAuthErrorCode(error.code)) return false;
  clearToken();
  router.replace("/login");
  return true;
}

export async function guardByAuthMe(router: AppRouterInstance): Promise<MeResponse["user"] | null> {
  try {
    const me = await fetchMe();
    return me.user;
  } catch (error) {
    const err = error as ApiClientError;
    if (isAuthErrorCode(err.code)) {
      clearToken();
      router.replace("/login");
      return null;
    }
    throw error;
  }
}

