import type { InvoiceDirection, InvoiceNature, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { parsePeriod, periodRange } from "@/lib/period";
import { requireCompanyRole } from "../auth/rbac";
import type { Actor } from "../auth/session";

export interface InvoiceFilters {
  period?: string | null;
  direction?: InvoiceDirection | "" | null;
  nature?: InvoiceNature | "" | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}

export function buildInvoiceWhere(companyId: string, f: InvoiceFilters): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { companyId };
  const p = parsePeriod(f.period ?? null);
  if (p) {
    const { from, to } = periodRange(p);
    where.issueDate = { gte: from, lt: to };
  }
  if (f.direction) where.direction = f.direction;
  if (f.nature) where.nature = f.nature;
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q.replace(/^0+(?=\d)/, ""), mode: "insensitive" } },
      { series: { contains: q, mode: "insensitive" } },
      { sellerTaxCode: { contains: q } },
      { buyerTaxCode: { contains: q } },
      { sellerName: { contains: q, mode: "insensitive" } },
      { buyerName: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listInvoices(actor: Actor, companyId: string, f: InvoiceFilters) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  const where = buildInvoiceWhere(companyId, f);
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 1), 200);
  const page = Math.max(f.page ?? 1, 1);
  const [total, rows, sums] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, direction: true, nature: true, status: true, templateCode: true, series: true, number: true, issueDate: true,
        sellerName: true, sellerTaxCode: true, buyerName: true, buyerTaxCode: true, currency: true,
        totalBeforeTax: true, totalTax: true, totalPayment: true, pdfFileId: true,
      },
    }),
    prisma.invoice.aggregate({ where, _sum: { totalBeforeTax: true, totalTax: true, totalPayment: true } }),
  ]);
  return { total, page, pageSize, rows, sums: sums._sum };
}

export async function getInvoice(actor: Actor, companyId: string, invoiceId: string) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      lines: { orderBy: { lineNo: "asc" } },
      taxSummaries: { orderBy: { taxRate: "asc" } },
      xmlFile: { select: { id: true, originalName: true, size: true, sha256: true, createdAt: true } },
      pdfFile: { select: { id: true, originalName: true, size: true, sha256: true, createdAt: true } },
      relatedInvoice: { select: { id: true, templateCode: true, series: true, number: true, issueDate: true, status: true } },
      derivedInvoices: { select: { id: true, templateCode: true, series: true, number: true, issueDate: true, nature: true } },
    },
  });
  if (!inv) throw Errors.notFound("Hóa đơn");
  return inv;
}

/** Lấy file gốc – chỉ khi file thuộc đúng công ty mà người dùng có quyền. */
export async function getCompanyFile(actor: Actor, companyId: string, fileId: string) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  const f = await prisma.storedFile.findFirst({ where: { id: fileId, companyId } });
  if (!f) throw Errors.notFound("File");
  return f;
}
