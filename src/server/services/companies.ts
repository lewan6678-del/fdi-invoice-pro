import { z } from "zod";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { isValidTaxCode, normalizeTaxCode } from "@/lib/taxcode";
import { audit } from "../audit";
import { requireCompanyRole, requireSystemAdmin } from "../auth/rbac";
import type { Actor } from "../auth/session";

export const companyInput = z.object({
  taxCode: z.string().transform(normalizeTaxCode).refine(isValidTaxCode, "MST không hợp lệ (10 số, 10 số-3 số chi nhánh, hoặc 12 số)."),
  name: z.string().trim().min(2, "Tên công ty tối thiểu 2 ký tự.").max(300),
  englishName: z.string().trim().max(300).optional().nullable(),
  address: z.string().trim().min(3, "Vui lòng nhập địa chỉ.").max(500),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
  currentFiscalYear: z.coerce.number().int().min(2000).max(2100),
  investorCountry: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email("Email không hợp lệ.").optional().nullable().or(z.literal("").transform(() => null)),
  phone: z.string().trim().max(30).optional().nullable(),
});
export type CompanyInput = z.input<typeof companyInput>;

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw Errors.validation(first.message, `Kiểm tra trường "${first.path.join(".")}".`);
  }
  return r.data;
}
export { parse as parseInput };

export async function listCompaniesForActor(actor: Actor, opts: { includeInactive?: boolean } = {}) {
  const where = actor.isSystemAdmin ? {} : { memberships: { some: { userId: actor.id } } };
  const companies = await prisma.company.findMany({
    where: { ...where, ...(opts.includeInactive ? {} : { isActive: true }) },
    orderBy: { name: "asc" },
    include: {
      memberships: actor.isSystemAdmin ? false : { where: { userId: actor.id }, select: { role: true } },
      _count: { select: { invoices: true, memberships: true } },
    },
  });
  return companies.map((c) => ({
    ...c,
    myRole: actor.isSystemAdmin ? ("SYSTEM_ADMIN" as const) : (c.memberships as { role: string }[])[0]?.role,
  }));
}

export async function getCompany(actor: Actor, companyId: string) {
  const role = await requireCompanyRole(actor, companyId, "VIEWER");
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  return { ...c, myRole: role };
}

export async function createCompany(actor: Actor, data: unknown) {
  requireSystemAdmin(actor);
  const input = parse(companyInput, data);
  const exists = await prisma.company.findUnique({ where: { taxCode: input.taxCode } });
  if (exists) throw Errors.conflict(`MST ${input.taxCode} đã tồn tại (${exists.name}).`, "Mỗi MST chỉ được khai báo một lần. Tìm công ty này trong danh sách để chỉnh sửa.");
  const c = await prisma.company.create({ data: input });
  await audit(actor, "company.create", { companyId: c.id, entityType: "company", entityId: c.id, detail: { taxCode: c.taxCode, name: c.name } });
  return c;
}

export async function updateCompany(actor: Actor, companyId: string, data: unknown) {
  const role = await requireCompanyRole(actor, companyId, "COMPANY_ADMIN");
  const input = parse(companyInput.partial(), data);
  const current = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (input.taxCode && input.taxCode !== current.taxCode) {
    if (role !== "SYSTEM_ADMIN") throw Errors.forbidden("thay đổi MST (chỉ Quản trị hệ thống)");
    const invCount = await prisma.invoice.count({ where: { companyId } });
    if (invCount > 0) throw Errors.conflict("Không thể đổi MST khi công ty đã có hóa đơn.", "Tạo công ty mới với MST đúng và nhập lại hóa đơn.");
    const dup = await prisma.company.findUnique({ where: { taxCode: input.taxCode } });
    if (dup) throw Errors.conflict(`MST ${input.taxCode} đã thuộc công ty khác.`);
  }
  const c = await prisma.company.update({ where: { id: companyId }, data: input });
  await audit(actor, "company.update", { companyId, entityType: "company", entityId: companyId, detail: input as object });
  return c;
}

export async function setCompanyActive(actor: Actor, companyId: string, isActive: boolean) {
  requireSystemAdmin(actor);
  const c = await prisma.company.update({ where: { id: companyId }, data: { isActive } });
  await audit(actor, isActive ? "company.activate" : "company.deactivate", { companyId, entityType: "company", entityId: companyId });
  return c;
}
