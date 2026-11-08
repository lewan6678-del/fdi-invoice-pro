import { NextResponse } from "next/server";
import { route, readJson, cookieOpts } from "@/server/http";
import { login } from "@/server/services/users";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/server/auth/session";

export const POST = route(async (req) => {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const { actor, session } = await login(String(body.email ?? ""), String(body.password ?? ""), req.headers.get("user-agent"));
  const res = NextResponse.json({ ok: true, user: { name: actor.name, email: actor.email } });
  res.cookies.set(SESSION_COOKIE, session.token, cookieOpts(SESSION_TTL_MS / 1000));
  return res;
}, { public: true });
