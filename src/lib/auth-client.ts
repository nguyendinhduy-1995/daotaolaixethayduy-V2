"use client";

import { COOKIE_SESSION_TOKEN, fetchJson } from "@/lib/api-client";

export type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
};

export function getToken() {
  if (typeof window === "undefined") return null;
  return COOKIE_SESSION_TOKEN;
}

export function setToken() {
  // Cookie session is managed by server.
}

export function clearToken() {
  if (typeof window === "undefined") return;
  void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
}

export async function fetchMe() {
  return fetchJson<MeResponse>("/api/auth/me");
}

export async function logoutSession() {
  await fetchJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}
