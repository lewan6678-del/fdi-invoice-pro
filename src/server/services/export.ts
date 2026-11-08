import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { parsePeriod, periodLabel, fmtDate } from "@/lib/period";
import { audit } from "../audit";
import { requireCompanyRole } from "../auth/rbac";
import type { Actor } from "../auth/session";
import { buildInvoiceWhere, type InvoiceFilters } from "./invoices";

const DIR = { SALE: "Bán ra", PURCHASE: "Mua vào" } as const;
const NAT = { ORIGINAL: "Gốc", REPLACEMENT: "Thay thế", ADJUSTMENT: "Điều chỉnh" } as const;
const ST = { ACTIVE: "Hiệu lực", REPLACED: "Bị thay thế", ADJUSTED: "Bị điều chỉnh", CANCELLED: "Đã hủy" } as const;
const num = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? null : Number(d.toString()));

/** Xuất Excel danh sách hóa đơn + chi tiết hàng hóa. Chỉ dữ liệu của MỘT công ty. */
export async function exportInvoicesXlsx(actor: Actor, companyId: string, f: InvoiceFilters) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const where = buildInvoiceWhere(companyId, f);
  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ issueDate: "asc" }, { number: "asc" }],
    include: { lines: { orderBy: { lineNo: "asc" } }, taxSummaries: true },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "FDI Invoice & Tax Automation Pro";
  wb.created = new Date();
  const p = parsePeriod(f.period ?? null);
  const title = `DANH SÁCH HÓA ĐƠN ${f.direction ? DIR[f.direction].toUpperCase() : "MUA VÀO & BÁN RA"} – ${p ? periodLabel(p) : "Tất cả kỳ"}`;

  const ws = wb.addWorksheet("Hoa don");
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([`Công ty: ${company.name} – MST: ${company.taxCode}`]);
  ws.addRow([]);
  const header = ["STT", "Loại", "Tính chất", "Trạng thái", "Mẫu số", "Ký hiệu", "Số HĐ", "Ngày lập", "MST người bán", "Tên người bán", "MST người mua", "Tên người mua", "Tiền tệ", "Tỷ giá", "Tiền trước thuế", "Tiền thuế GTGT", "Tổng thanh toán", "Thuế suất", "HĐ liên quan", "Mã CQT"];
  const hr = ws.addRow(header);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }));
  invoices.forEach((inv, i) => {
    ws.addRow([
      i + 1, DIR[inv.direction], NAT[inv.nature], ST[inv.status], inv.templateCode, inv.series, inv.number, fmtDate(inv.issueDate),
      inv.sellerTaxCode, inv.sellerName, inv.buyerTaxCode, inv.buyerName, inv.currency, num(inv.exchangeRate),
      num(inv.totalBeforeTax), num(inv.totalTax), num(inv.totalPayment),
      inv.taxSummaries.map((s) => s.taxRate).join(", "),
      inv.relatedNumber ? `${inv.relatedTemplateCode ?? ""}${inv.relatedSeries ?? ""}-${inv.relatedNumber}` : "",
      inv.taxAuthorityCode,
    ]);
  });
  const tr = ws.addRow(["", "", "", "", "", "", "", "", "", "", "", "TỔNG CỘNG", "", "",
    invoices.reduce((a, x) => a + Number(x.totalBeforeTax), 0), invoices.reduce((a, x) => a + Number(x.totalTax), 0), invoices.reduce((a, x) => a + Number(x.totalPayment), 0)]);
  tr.font = { bold: true };
  [15, 16, 17].forEach((c) => (ws.getColumn(c).numFmt = "#,##0"));
  ws.getColumn(14).numFmt = "#,##0.00";
  ws.columns.forEach((c, idx) => (c.width = [6, 10, 11, 13, 8, 10, 10, 12, 15, 40, 15, 40, 8, 10, 18, 18, 18, 12, 18, 30][idx] ?? 14));
  ws.views = [{ state: "frozen", ySplit: 4 }];

  const wl = wb.addWorksheet("Chi tiet hang hoa");
  const lh = wl.addRow(["Số HĐ", "Ký hiệu", "Ngày lập", "Loại", "STT", "Mã hàng", "Tên hàng hóa/dịch vụ", "ĐVT", "Số lượng", "Đơn giá", "Chiết khấu", "Thành tiền", "Thuế suất", "Tiền thuế (dòng)"]);
  lh.font = { bold: true, color: { argb: "FFFFFFFF" } };
  lh.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }));
  for (const inv of invoices)
    for (const l of inv.lines)
      wl.addRow([inv.number, inv.series, fmtDate(inv.issueDate), DIR[inv.direction], l.lineNo, l.itemCode, l.itemName, l.unit, num(l.quantity), num(l.unitPrice), num(l.discountAmount), num(l.amount), l.taxRate, num(l.taxAmount)]);
  [9, 10, 11, 12, 14].forEach((c) => (wl.getColumn(c).numFmt = "#,##0.####"));
  wl.columns.forEach((c, idx) => (c.width = [10, 10, 12, 10, 6, 14, 50, 8, 12, 16, 14, 18, 10, 16][idx] ?? 14));
  wl.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await audit(actor, "invoice.export_xlsx", { companyId, detail: { count: invoices.length, period: f.period ?? null, direction: f.direction ?? null } });
  const fileName = `HoaDon_${company.taxCode}_${f.period ?? "all"}${f.direction ? "_" + f.direction : ""}.xlsx`;
  return { buffer, fileName, count: invoices.length };
}
