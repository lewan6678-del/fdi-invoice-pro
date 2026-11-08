import { prisma } from "@/lib/db";
import { hashPassword } from "@/server/auth/password";
import type { Actor } from "@/server/auth/session";

let seq = 0;
export function uniqTax() {
  seq++;
  const base = String(Date.now()).slice(-6) + String(seq).padStart(4, "0");
  return base.slice(0, 10);
}

export async function makeUser(opts: { sysadmin?: boolean; email?: string; password?: string } = {}): Promise<Actor> {
  const email = opts.email ?? `u${Date.now()}${Math.random().toString(36).slice(2, 7)}@test.local`;
  const u = await prisma.user.create({
    data: { email, name: "Người dùng kiểm thử", passwordHash: await hashPassword(opts.password ?? "Test12345"), isSystemAdmin: !!opts.sysadmin },
  });
  return { id: u.id, email: u.email, name: u.name, isSystemAdmin: u.isSystemAdmin };
}

export async function makeCompany(taxCode = uniqTax(), name = "Công ty FDI Mẫu") {
  return prisma.company.create({ data: { taxCode, name: `${name} ${taxCode}`, address: "KCN Kiểm Thử", currentFiscalYear: 2026 } });
}

export async function addRole(userId: string, companyId: string, role: "COMPANY_ADMIN" | "EDITOR" | "VIEWER") {
  return prisma.membership.create({ data: { userId, companyId, role } });
}
