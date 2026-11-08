import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, deleteSessionToken } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  const t = req.cookies.get(SESSION_COOKIE)?.value;
  if (t) await deleteSessionToken(t);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
