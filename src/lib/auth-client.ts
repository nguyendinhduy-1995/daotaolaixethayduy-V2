"use client";

import { fetchJson } from "@/lib/api-client";

const ACCESS_TOKEN_KEY = "accessToken";

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
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function fetchMe() {
  const token = getToken();
  if (!token) throw { code: "AUTH_MISSING_BEARER", message: "Thiếu token", status: 401 };
  return fetchJson<MeResponse>("/api/auth/me", { token });
}
