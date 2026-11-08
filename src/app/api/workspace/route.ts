import { NextResponse } from "next/server";
import { route, readJson } from "@/server/http";
import { getCompanyRole } from "@/server/auth/rbac";
import { parsePeriod } from "@/lib/period";
import { Errors } from "@/lib/errors";

/** Lưu lựa chọn công ty / kỳ kế toán (chỉ là tùy chọn giao diện, không phải dữ liệu kế toán). */
export const POST = route(async (req, actor) => {
  const body = await readJson<{ companyId?: string; period?: string }>(req);
  const res = NextResponse.json({ ok: true });
  const opts = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365 };
  if (body.companyId) {
    if (!(await getCompanyRole(actor, body.companyId))) throw Errors.notFound("Công ty");
    res.cookies.set("fdi_company", body.companyId, opts);
  }
  if (body.period) {
    if (!parsePeriod(body.period)) throw Errors.validation("Kỳ kế toán không hợp lệ.");
    res.cookies.set("fdi_period", body.period, opts);
  }
  return res;
});
