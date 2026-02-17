"use client";

import { getErrorMessageVi } from "@/lib/error-messages-vi";

export type ApiClientError = {
  code: string;
  message: string;
  status: number;
};

const COOKIE_SESSION_TOKEN = "__cookie_session__";

export async function fetchJson<T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    token?: string | null;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const shouldAttachBearer =
    typeof options?.token === "string" &&
    options.token.length > 0 &&
    options.token !== COOKIE_SESSION_TOKEN;

  const res = await fetch(path, {
    method: options?.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(shouldAttachBearer ? { Authorization: `Bearer ${options?.token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errorData = data as { error?: { code?: string; message?: string } } | null;
    const code = errorData?.error?.code || "INTERNAL_ERROR";
    const mapped = getErrorMessageVi(code);
    const error: ApiClientError = {
      code,
      message: mapped.message,
      status: res.status,
    };
    throw error;
  }

  return data as T;
}

export { COOKIE_SESSION_TOKEN };
