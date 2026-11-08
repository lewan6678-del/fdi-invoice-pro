import { describe, expect, it, beforeAll } from "vitest";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { createImportJob, processImportJob } from "@/server/services/imports";
import { listInvoices, getInvoice, getCompanyFile } from "@/server/services/invoices";
import { exportInvoicesXlsx } from "@/server/services/export";
import { getDashboard } from "@/server/services/dashboard";
import { login } from "@/server/services/users";
import { validateSessionToken, deleteSessionToken } from "@/server/auth/session";
import { storage } from "@/server/storage";
import ExcelJS from "exceljs";
import { buildInvoiceXml, fakePdf } from "../fixtures/build-invoice";
import { makeUser, makeCompany, addRole } from "../helpers";
import type { Actor } from "@/server/auth/session";

let A: Awaited<ReturnType<typeof makeCompany>>;
let B: Awaited<ReturnType<typeof makeCompany>>;
let userA: Actor;
let userB: Actor;
let viewerA: Actor;
const email = `persist${Date.now()}@test.local`;

async function upload(actor: Actor, companyId: string, files: { name: string; data: Buffer | string }[]) {
  const job = await createImportJob(actor, companyId, files.map((f) => ({ name: f.name, data: Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data) })));
  await processImportJob(job.id);
  return prisma.importJob.findUniqueOrThrow({ where: { id: job.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
}

beforeAll(async () => {
  A = await makeCompany("0311111111", "FDI Alpha");
  B = await makeCompany("0322222222", "FDI Beta");
  userA = await makeUser({ email, password: "KeToan2026" });
  userB = await makeUser();
  viewerA = await makeUser();
  await addRole(userA.id, A.id, "EDITOR");
  await addRole(userB.id, B.id, "EDITOR");
  await addRole(viewerA.id, A.id, "VIEWER");
});

describe("Nhập hóa đơn XML", () => {
  it("upload XML hợp lệ (bán ra) → lưu hóa đơn, dòng hàng, XML gốc bất biến", async () => {
    const xml = buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0399999999", number: "1", lines: [{ name: "Linh kiện điện tử", unit: "cái", qty: "100", price: "15000", amount: "1500000", rate: "10%" }] });
    const job = await upload(userA, A.id, [{ name: "HD0001.xml", data: xml }]);
    expect(job.status).toBe("COMPLETED");
    expect(job.successCount).toBe(1);
    const inv = await prisma.invoice.findFirstOrThrow({ where: { companyId: A.id, number: "1" }, include: { lines: true, xmlFile: true } });
    expect(inv.direction).toBe("SALE");
    expect(inv.totalTax.toString()).toBe("150000");
    expect(inv.lines[0].quantity!.toString()).toBe("100");
    const raw = await storage().get(inv.xmlFile!.storageKey);
    expect(raw.toString("utf8")).toBe(xml); // XML gốc giữ nguyên từng byte
  });

  it("XML mua vào nhiều dòng hàng + nhiều thuế suất", async () => {
    const lines = [
      ...Array.from({ length: 12 }, (_, i) => ({ name: `Nguyên liệu ${i + 1}`, unit: "kg", qty: "3", price: "1000", amount: "3000", rate: "10%" })),
      { name: "Dịch vụ vận chuyển", amount: "500000", rate: "8%" },
      { name: "Sách kỹ thuật", amount: "200000", rate: "5%" },
      { name: "Hàng xuất khẩu", amount: "1000000", rate: "0%" },
      { name: "Bảo hiểm", amount: "100000", rate: "KCT" },
    ];
    const xml = buildInvoiceXml({ sellerTax: "0388888888", buyerTax: A.taxCode, number: "55", series: "C26TNC", lines });
    const job = await upload(userA, A.id, [{ name: "mua-vao-55.xml", data: xml }]);
    expect(job.items[0].status).toBe("SUCCESS");
    const inv = await prisma.invoice.findFirstOrThrow({ where: { companyId: A.id, number: "55" }, include: { lines: true, taxSummaries: true } });
    expect(inv.direction).toBe("PURCHASE");
    expect(inv.lines).toHaveLength(16);
    const map = Object.fromEntries(inv.taxSummaries.map((s) => [s.taxRate, s.taxAmount.toString()]));
    expect(map["10%"]).toBe("3600");
    expect(map["8%"]).toBe("40000");
    expect(map["5%"]).toBe("10000");
    expect(map["0%"]).toBe("0");
    expect(map["KCT"]).toBe("0");
  });

  it("XML sai cấu trúc → ghi nhận lỗi có hướng khắc phục, không tạo hóa đơn", async () => {
    const before = await prisma.invoice.count({ where: { companyId: A.id } });
    const job = await upload(userA, A.id, [{ name: "hong.xml", data: "<HDon><DLHDon><TTChung><SHDon>1</TTChung>" }]);
    expect(job.items[0].status).toBe("ERROR");
    expect(job.items[0].errorCode).toBe("MALFORMED_XML");
    expect(job.items[0].hint).toBeTruthy();
    expect(await prisma.invoice.count({ where: { companyId: A.id } })).toBe(before);
  });

  it("XML của công ty khác (không khớp MST) bị từ chối", async () => {
    const xml = buildInvoiceXml({ sellerTax: "0100000009", buyerTax: "0100000008", number: "9", lines: [{ name: "X", amount: "1", rate: "10%" }] });
    const job = await upload(userA, A.id, [{ name: "khac.xml", data: xml }]);
    expect(job.items[0].errorCode).toBe("WRONG_COMPANY");
  });

  it("ZIP nhiều file: xử lý từng file độc lập, ghi nhận thành công/thất bại, ghép PDF", async () => {
    const zip = new JSZip();
    for (let i = 100; i < 105; i++)
      zip.file(`thang03/HD${i}.xml`, buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0377777777", number: String(i), lines: [{ name: "SP", amount: "1000", rate: "8%" }] }));
    zip.file("thang03/HD100.pdf", fakePdf("HD100"));
    zip.file("thang03/loi.xml", "<khong-dong-the>");
    zip.file("ghichu.txt", "tài liệu");
    const data = await zip.generateAsync({ type: "nodebuffer" });
    const job = await upload(userA, A.id, [{ name: "lo-hoa-don.zip", data }]);
    const byName = Object.fromEntries(job.items.map((i) => [i.fileName, i]));
    expect(byName["lo-hoa-don.zip"].status).toBe("SUCCESS");
    for (let i = 100; i < 105; i++) expect(byName[`thang03/HD${i}.xml`].status).toBe("SUCCESS");
    expect(byName["thang03/loi.xml"].status).toBe("ERROR");
    expect(byName["ghichu.txt"].status).toBe("SKIPPED");
    expect(byName["thang03/HD100.pdf"].status).toBe("SUCCESS");
    expect(byName["thang03/HD100.xml"].archiveName).toBe("lo-hoa-don.zip");
    const inv100 = await prisma.invoice.findFirstOrThrow({ where: { companyId: A.id, number: "100" } });
    expect(inv100.pdfFileId).toBeTruthy();
    expect(job.successCount).toBe(7); // zip + 5 xml + 1 pdf
    expect(job.errorCount).toBe(1);
  });

  it("upload trùng → DUPLICATE, không tạo bản ghi mới, không ghi đè dữ liệu cũ", async () => {
    const xml = buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0399999999", number: "1", lines: [{ name: "Linh kiện điện tử", unit: "cái", qty: "100", price: "15000", amount: "1500000", rate: "10%" }] });
    const original = await prisma.invoice.findFirstOrThrow({ where: { companyId: A.id, number: "1" } });
    const job = await upload(userA, A.id, [{ name: "HD0001-lan2.xml", data: xml }]);
    expect(job.items[0].status).toBe("DUPLICATE");
    expect(job.duplicateCount).toBe(1);
    // Cùng số HĐ nhưng nội dung khác (có số 0 ở đầu) vẫn bị chặn
    const xml2 = buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0399999999", number: "00000001", lines: [{ name: "Khác", amount: "9", rate: "10%" }] });
    const job2 = await upload(userA, A.id, [{ name: "HD0001-sua.xml", data: xml2 }]);
    expect(job2.items[0].status).toBe("DUPLICATE");
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: original.id } });
    expect(after.totalPayment.toString()).toBe(original.totalPayment.toString());
    expect(await prisma.invoice.count({ where: { companyId: A.id, number: "1" } })).toBe(1);
  });

  it("hóa đơn thay thế liên kết với hóa đơn gốc và đánh dấu gốc 'Bị thay thế'", async () => {
    const xml = buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0377777777", number: "300", nature: "1", related: { template: "1", series: "C26TKT", number: "101", date: "2026-03-15" }, lines: [{ name: "SP", amount: "2000", rate: "8%" }] });
    await upload(userA, A.id, [{ name: "thay-the.xml", data: xml }]);
    const repl = await prisma.invoice.findFirstOrThrow({ where: { companyId: A.id, number: "300" } });
    const orig = await prisma.invoice.findFirstOrThrow({ where: { companyId: A.id, number: "101" } });
    expect(repl.nature).toBe("REPLACEMENT");
    expect(repl.relatedInvoiceId).toBe(orig.id);
    expect(orig.status).toBe("REPLACED");
  });

  it("Viewer không được upload", async () => {
    await expect(createImportJob(viewerA, A.id, [{ name: "a.xml", data: Buffer.from("<a/>") }])).rejects.toMatchObject({ status: 403 });
  });
});

describe("Cô lập dữ liệu giữa hai MST (tenant isolation)", () => {
  beforeAll(async () => {
    const xml = buildInvoiceXml({ sellerTax: B.taxCode, buyerTax: "0366666666", number: "1", lines: [{ name: "Hàng của Beta", amount: "777000", rate: "10%" }] });
    await upload(userB, B.id, [{ name: "beta.xml", data: xml }]);
  });

  it("người dùng công ty A không đọc được danh sách/chi tiết/file/dashboard của công ty B", async () => {
    const invB = await prisma.invoice.findFirstOrThrow({ where: { companyId: B.id } });
    await expect(listInvoices(userA, B.id, {})).rejects.toMatchObject({ status: 404 });
    await expect(getInvoice(userA, B.id, invB.id)).rejects.toMatchObject({ status: 404 });
    await expect(getDashboard(userA, B.id, null)).rejects.toMatchObject({ status: 404 });
    await expect(getCompanyFile(userA, B.id, invB.xmlFileId!)).rejects.toMatchObject({ status: 404 });
    // Dùng companyId của A nhưng id hóa đơn/file của B → vẫn không thấy
    await expect(getInvoice(userA, A.id, invB.id)).rejects.toMatchObject({ status: 404 });
    await expect(getCompanyFile(userA, A.id, invB.xmlFileId!)).rejects.toMatchObject({ status: 404 });
  });

  it("người dùng công ty A không thể upload vào công ty B", async () => {
    await expect(createImportJob(userA, B.id, [{ name: "x.xml", data: Buffer.from("<a/>") }])).rejects.toMatchObject({ status: 404 });
  });

  it("danh sách hóa đơn A chỉ chứa dữ liệu A", async () => {
    const r = await listInvoices(userA, A.id, { pageSize: 200 });
    expect(r.total).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.sellerTaxCode === A.taxCode || x.buyerTaxCode === A.taxCode)).toBe(true);
    expect(r.rows.some((x) => x.sellerTaxCode === B.taxCode)).toBe(false);
  });

  it("cùng một file XML được lưu riêng cho từng công ty (không dùng chung bản ghi file)", async () => {
    const xml = buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: B.taxCode, number: "900", lines: [{ name: "Bán A→B", amount: "10000", rate: "10%" }] });
    await upload(userA, A.id, [{ name: "ab.xml", data: xml }]);
    await upload(userB, B.id, [{ name: "ab.xml", data: xml }]);
    const ia = await prisma.invoice.findFirstOrThrow({ where: { companyId: A.id, number: "900" } });
    const ib = await prisma.invoice.findFirstOrThrow({ where: { companyId: B.id, number: "900" } });
    expect(ia.direction).toBe("SALE");
    expect(ib.direction).toBe("PURCHASE");
    expect(ia.xmlFileId).not.toBe(ib.xmlFileId);
  });
});

describe("Tìm kiếm theo kỳ & xuất Excel", () => {
  it("lọc theo tháng, quý, năm", async () => {
    const xml = buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0355555555", number: "700", date: "2026-08-20", lines: [{ name: "T8", amount: "1000", rate: "10%" }] });
    await upload(userA, A.id, [{ name: "t8.xml", data: xml }]);
    const m8 = await listInvoices(userA, A.id, { period: "2026-08" });
    const m3 = await listInvoices(userA, A.id, { period: "2026-03" });
    const q3 = await listInvoices(userA, A.id, { period: "2026-Q3" });
    const y = await listInvoices(userA, A.id, { period: "2026" });
    expect(m8.rows.map((r) => r.number)).toEqual(["700"]);
    expect(m3.rows.some((r) => r.number === "700")).toBe(false);
    expect(q3.total).toBe(1);
    expect(y.total).toBe(m3.total + 1);
  });

  it("xuất Excel chỉ có dữ liệu của công ty được chọn", async () => {
    const { buffer, count } = await exportInvoicesXlsx(userA, A.id, { period: "2026" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Hoa don")!;
    const sellerTaxes: string[] = [];
    const buyerTaxes: string[] = [];
    ws.eachRow((row, i) => {
      if (i > 4 && row.getCell(1).value) {
        sellerTaxes.push(String(row.getCell(9).value));
        buyerTaxes.push(String(row.getCell(11).value));
      }
    });
    expect(sellerTaxes.length).toBe(count);
    for (let i = 0; i < count; i++) expect(sellerTaxes[i] === A.taxCode || buyerTaxes[i] === A.taxCode).toBe(true);
    expect(JSON.stringify(sellerTaxes)).not.toContain(B.taxCode);
    const lines = wb.getWorksheet("Chi tiet hang hoa")!;
    let beta = false;
    lines.eachRow((r) => {
      if (String(r.getCell(7).value).includes("Beta")) beta = true;
    });
    expect(beta).toBe(false);
    await expect(exportInvoicesXlsx(userA, B.id, {})).rejects.toMatchObject({ status: 404 });
  });
});

describe("Dữ liệu bền vững", () => {
  it("dữ liệu còn nguyên sau khi đăng xuất và đăng nhập lại", async () => {
    const s1 = await login(email, "KeToan2026");
    const actor1 = (await validateSessionToken(s1.session.token))!;
    const before = await listInvoices(actor1, A.id, { pageSize: 200 });
    await deleteSessionToken(s1.session.token);
    expect(await validateSessionToken(s1.session.token)).toBeNull();
    const s2 = await login(email, "KeToan2026");
    const actor2 = (await validateSessionToken(s2.session.token))!;
    const after = await listInvoices(actor2, A.id, { pageSize: 200 });
    expect(after.total).toBe(before.total);
    expect(after.rows.map((r) => r.id)).toEqual(before.rows.map((r) => r.id));
    const d = await getDashboard(actor2, A.id, "2026");
    expect(d.sale.count + d.purchase.count).toBe(after.total);
  });
});
