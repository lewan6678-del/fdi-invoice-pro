import { z } from "zod";
import type { MemberRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { audit } from "../audit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../auth/password";
import { requireCompanyRole, requireSystemAdmin } from "../auth/rbac";
import { createSession, type Actor } from "../auth/session";
import { parseInput } from "./companies";

const roleEnum = z.enum(["COMPANY_ADMIN", "EDITOR", "VIEWER"]);
const userCreate = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ."),
  name: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự.").max(200),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
  isSystemAdmin: z.boolean().optional().default(false),
});

const publicUser = { id: true, email: true, name: true, isSystemAdmin: true, isActive: true, lastLoginAt: true, createdAt: true } as const;

export async function login(email: string, password: string, userAgent?: string | null) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    await audit(null, "auth.login_failed", { detail: { email } });
    throw Errors.validation("Email hoặc mật khẩu không đúng.", "Kiểm tra lại bàn phím (Caps Lock, bộ gõ tiếng Việt). Quên mật khẩu: liên hệ Quản trị hệ thống để đặt lại.");
  }
  if (!user.isActive) throw Errors.forbidden("đăng nhập: tài khoản đã bị khóa");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id, userAgent);
  const actor: Actor = { id: user.id, email: user.email, name: user.name, isSystemAdmin: user.isSystemAdmin };
  await audit(actor, "auth.login");
  return { actor, session };
}

export async function createUser(actor: Actor, data: unknown, membership?: { companyId: string; role: MemberRole }) {
  const input = parseInput(userCreate, data);
  if (membership) await requireCompanyRole(actor, membership.companyId, "COMPANY_ADMIN");
  else requireSystemAdmin(actor);
  if (input.isSystemAdmin) requireSystemAdmin(actor);
  const pwErr = validatePasswordStrength(input.password);
  if (pwErr) throw Errors.validation(pwErr, "Ví dụ mật khẩu hợp lệ: KeToan2026");
  if (await prisma.user.findUnique({ where: { email: input.email } }))
    throw Errors.conflict(`Email ${input.email} đã có tài khoản.`, membership ? "Dùng chức năng 'Thêm thành viên có sẵn' để gán vào công ty." : undefined);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      isSystemAdmin: input.isSystemAdmin,
      memberships: membership ? { create: { companyId: membership.companyId, role: membership.role } } : undefined,
    },
    select: publicUser,
  });
  await audit(actor, "user.create", { companyId: membership?.companyId, entityType: "user", entityId: user.id, detail: { email: user.email, role: membership?.role ?? null } });
  return user;
}

export async function listUsers(actor: Actor) {
  requireSystemAdmin(actor);
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { ...publicUser, memberships: { select: { role: true, company: { select: { id: true, name: true, taxCode: true } } } } },
  });
}

export async function updateUser(actor: Actor, userId: string, data: { name?: string; isActive?: boolean; isSystemAdmin?: boolean; password?: string }) {
  requireSystemAdmin(actor);
  if (userId === actor.id && (data.isActive === false || data.isSystemAdmin === false))
    throw Errors.validation("Không thể tự khóa hoặc tự bỏ quyền quản trị của chính mình.", "Nhờ một Quản trị hệ thống khác thực hiện.");
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.isActive !== undefined) patch.isActive = !!data.isActive;
  if (data.isSystemAdmin !== undefined) patch.isSystemAdmin = !!data.isSystemAdmin;
  if (data.password) {
    const e = validatePasswordStrength(data.password);
    if (e) throw Errors.validation(e);
    patch.passwordHash = await hashPassword(data.password);
  }
  const u = await prisma.user.update({ where: { id: userId }, data: patch, select: publicUser });
  if (data.isActive === false || data.password) await prisma.session.deleteMany({ where: { userId } });
  await audit(actor, "user.update", { entityType: "user", entityId: userId, detail: { ...data, password: data.password ? "***" : undefined } });
  return u;
}

export async function changeOwnPassword(actor: Actor, current: string, next: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(current, u.passwordHash))) throw Errors.validation("Mật khẩu hiện tại không đúng.");
  const e = validatePasswordStrength(next);
  if (e) throw Errors.validation(e);
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(actor, "user.change_password", { entityType: "user", entityId: actor.id });
}

// ===== Thành viên công ty =====
export async function listMembers(actor: Actor, companyId: string) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  return prisma.membership.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: publicUser } },
  });
}

export async function addMember(actor: Actor, companyId: string, email: string, role: MemberRole) {
  await requireCompanyRole(actor, companyId, "COMPANY_ADMIN");
  roleEnum.parse(role);
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw Errors.notFound(`Tài khoản ${email}`);
  const m = await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId } },
    update: { role },
    create: { userId: user.id, companyId, role },
  });
  await audit(actor, "member.upsert", { companyId, entityType: "membership", entityId: m.id, detail: { email, role } });
  return m;
}

export async function updateMemberRole(actor: Actor, companyId: string, membershipId: string, role: MemberRole) {
  await requireCompanyRole(actor, companyId, "COMPANY_ADMIN");
  roleEnum.parse(role);
  const m = await prisma.membership.findFirst({ where: { id: membershipId, companyId } });
  if (!m) throw Errors.notFound("Thành viên");
  if (m.userId === actor.id && role !== "COMPANY_ADMIN" && !actor.isSystemAdmin)
    throw Errors.validation("Không thể tự hạ quyền của chính mình.");
  const r = await prisma.membership.update({ where: { id: m.id }, data: { role } });
  await audit(actor, "member.role", { companyId, entityType: "membership", entityId: m.id, detail: { role } });
  return r;
}

export async function removeMember(actor: Actor, companyId: string, membershipId: string) {
  await requireCompanyRole(actor, companyId, "COMPANY_ADMIN");
  const m = await prisma.membership.findFirst({ where: { id: membershipId, companyId } });
  if (!m) throw Errors.notFound("Thành viên");
  if (m.userId === actor.id && !actor.isSystemAdmin) throw Errors.validation("Không thể tự xóa mình khỏi công ty.");
  await prisma.membership.delete({ where: { id: m.id } });
  await audit(actor, "member.remove", { companyId, entityType: "membership", entityId: m.id });
}
