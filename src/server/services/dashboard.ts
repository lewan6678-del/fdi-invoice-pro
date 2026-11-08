import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parsePeriod, periodRange } from "@/lib/period";
import { requireCompanyRole } from "../auth/rbac";
import type { Actor } from "../auth/session";

export async function getDashboard(actor: Actor, companyId: string, period: string | null) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  const p = parsePeriod(period);
  const range = p ? periodRange(p) : null;
  const where: Prisma.InvoiceWhereInput = { companyId, ...(range ? { issueDate: { gte: range.from, lt: range.to } } : {}) };

  const [byDir, byNature, taxRates, recentJobs, errorItems, totalAll] = await Promise.all([
    prisma.invoice.groupBy({ by: ["direction"], where, _count: true, _sum: { totalBeforeTax: true, totalTax: true, totalPayment: true } }),
    prisma.invoice.groupBy({ by: ["nature"], where, _count: true }),
    prisma.invoiceTaxSummary.groupBy({
      by: ["taxRate"],
      where: { companyId, invoice: where },
      _sum: { taxableAmount: true, taxAmount: true },
    }),
    prisma.importJob.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.importItem.count({ where: { companyId, status: "ERROR" } }),
    prisma.invoice.count({ where: { companyId } }),
  ]);

  const year = p?.year ?? new Date().getFullYear();
  const monthly = await prisma.$queryRaw<{ m: number; direction: string; base: Prisma.Decimal; tax: Prisma.Decimal; cnt: bigint }[]>`
    SELECT EXTRACT(MONTH FROM issue_date)::int AS m, direction::text AS direction,
           COALESCE(SUM(total_before_tax),0) AS base, COALESCE(SUM(total_tax),0) AS tax, COUNT(*) AS cnt
    FROM invoices WHERE company_id = ${companyId} AND EXTRACT(YEAR FROM issue_date) = ${year}
    GROUP BY 1, 2 ORDER BY 1`;

  const dir = (d: "SALE" | "PURCHASE") => {
    const r = byDir.find((x) => x.direction === d);
    return { count: r?._count ?? 0, base: r?._sum.totalBeforeTax?.toString() ?? "0", tax: r?._sum.totalTax?.toString() ?? "0", total: r?._sum.totalPayment?.toString() ?? "0" };
  };
  return {
    sale: dir("SALE"),
    purchase: dir("PURCHASE"),
    natures: Object.fromEntries(byNature.map((n) => [n.nature, n._count])) as Record<string, number>,
    taxRates: taxRates.map((t) => ({ taxRate: t.taxRate, base: t._sum.taxableAmount?.toString() ?? "0", tax: t._sum.taxAmount?.toString() ?? "0" })),
    recentJobs,
    errorItems,
    totalAll,
    year,
    monthly: monthly.map((r) => ({ month: r.m, direction: r.direction, base: r.base.toString(), tax: r.tax.toString(), count: Number(r.cnt) })),
  };
}

export async function listAuditLogs(actor: Actor, companyId: string, take = 200) {
  await requireCompanyRole(actor, companyId, "COMPANY_ADMIN");
  return prisma.auditLog.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take });
}
