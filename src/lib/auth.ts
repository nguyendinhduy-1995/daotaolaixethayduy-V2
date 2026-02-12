import jwt from "jsonwebtoken";

export type AuthPayload = { sub: string; role: string; email: string };

export function requireAuth(req: Request): AuthPayload {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new Error("NO_TOKEN");
  return jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
}
