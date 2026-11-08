import type { MemberRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import type { Actor } from "./session";

export const ROLE_RANK: Record<MemberRole, number> = { VIEWER: 1, EDITOR: 2, COMPANY_ADMIN: 3 };
export const ROLE_LABEL: Record<MemberRole | "SYSTEM_ADMIN", string> = {
  SYSTEM_ADMIN: "Quản trị hệ thống",
  COMPANY_ADMIN: "Quản trị công ty",
  EDITOR: "Kế toán (Editor)",
  VIEWER: "Chỉ xem (Viewer)",
};

export type EffectiveRole = MemberRole | "SYSTEM_ADMIN";

/** Trả về vai trò hiệu lực của actor tại công ty, hoặc null nếu không có quyền truy cập. */
export async function getCompanyRole(actor: Actor, companyId: string): Promise<EffectiveRole | null> {
  if (actor.isSystemAdmin) {
    const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    return exists ? "SYSTEM_ADMIN" : null;
  }
  const m = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: actor.id, companyId } },
    select: { role: true },
  });
  return m?.role ?? null;
}

/**
 * Kiểm tra quyền tại công ty – điểm chặn duy nhất cho tenant isolation.
 * Người không thuộc công ty nhận lỗi 404 (không tiết lộ sự tồn tại của dữ liệu).
 */
export async function requireCompanyRole(actor: Actor, companyId: string, min: MemberRole = "VIEWER"): Promise<EffectiveRole> {
  if (!companyId) throw Errors.validation("Chưa chọn công ty.", "Chọn công ty ở thanh trên cùng trước khi thao tác.");
  const role = await getCompanyRole(actor, companyId);
  if (!role) throw Errors.notFound("Công ty");
  if (role === "SYSTEM_ADMIN") return role;
  if (ROLE_RANK[role] < ROLE_RANK[min]) throw Errors.forbidden(min === "COMPANY_ADMIN" ? "quản trị công ty này" : "chỉnh sửa dữ liệu công ty này");
  return role;
}

export function requireSystemAdmin(actor: Actor) {
  if (!actor.isSystemAdmin) throw Errors.forbidden("quản trị hệ thống");
}

export function canEdit(role: EffectiveRole | null) {
  return role === "SYSTEM_ADMIN" || role === "COMPANY_ADMIN" || role === "EDITOR";
}
export function canAdmin(role: EffectiveRole | null) {
  return role === "SYSTEM_ADMIN" || role === "COMPANY_ADMIN";
}
