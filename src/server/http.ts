import { NextResponse, type NextRequest } from "next/server";
import { AppError, Errors } from "@/lib/errors";
import { SESSION_COOKIE, validateSessionToken, type Actor } from "./auth/session";

type Ctx<P> = { params: Promise<P> };

/** Bọc API route: xác thực, chống CSRF (kiểm tra Origin), chuẩn hóa lỗi tiếng Việt kèm hướng khắc phục. */
export function route<P = Record<string, string>>(
  fn: (req: NextRequest, actor: Actor, params: P) => Promise<Response | unknown>,
  opts: { public?: boolean } = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
        if (origin && host && new URL(origin).host !== host) throw new AppError(403, "CSRF", "Yêu cầu không hợp lệ (khác nguồn).", "Tải lại trang rồi thử lại.");
      }
      let actor: Actor | null = null;
      if (!opts.public) {
        actor = await validateSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
        if (!actor) throw Errors.unauthenticated();
      }
      const params = (await ctx?.params) ?? ({} as P);
      const out = await fn(req, actor as Actor, params);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message, hint: e.hint } }, { status: e.status });
      if ((e as { name?: string }).name === "ZodError") return NextResponse.json({ error: { code: "VALIDATION", message: "Dữ liệu không hợp lệ.", hint: "Kiểm tra lại các trường đã nhập." } }, { status: 400 });
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: { code: "INTERNAL", message: "Đã xảy ra lỗi hệ thống.", hint: "Thử lại. Nếu lỗi lặp lại, liên hệ quản trị hệ thống." } }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw Errors.validation("Dữ liệu gửi lên không hợp lệ.");
  }
}

export function companyIdFrom(req: NextRequest): string {
  const id = req.nextUrl.searchParams.get("companyId") ?? req.headers.get("x-company-id") ?? req.cookies.get("fdi_company")?.value;
  if (!id) throw Errors.validation("Chưa chọn công ty.", "Chọn công ty ở thanh trên cùng.");
  return id;
}

export const cookieOpts = (maxAgeSec: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
  maxAge: maxAgeSec,
});
