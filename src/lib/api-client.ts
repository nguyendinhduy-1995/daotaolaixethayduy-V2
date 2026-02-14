"use client";

export type ApiClientError = {
  code: string;
  message: string;
  status: number;
};

export async function fetchJson<T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    token?: string | null;
  }
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
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
    const error: ApiClientError = {
      code: errorData?.error?.code || "INTERNAL_ERROR",
      message: errorData?.error?.message || "Lỗi không xác định",
      status: res.status,
    };
    throw error;
  }

  return data as T;
}
