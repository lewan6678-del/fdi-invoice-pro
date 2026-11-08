import { describe, expect, it } from "vitest";
import { parseInvoiceXml, InvoiceParseError, normalizeTaxRate } from "@/server/parser/invoice-xml";
import { buildInvoiceXml } from "../fixtures/build-invoice";

const base = { sellerTax: "0100000001", buyerTax: "0200000002", number: "123" };

describe("Đọc XML hóa đơn TT78", () => {
  it("đọc thông tin chung, người bán, người mua", () => {
    const inv = parseInvoiceXml(buildInvoiceXml({ ...base, number: "0000123", lines: [{ name: "Thép tấm", unit: "kg", qty: "10.5", price: "20000", amount: "210000", rate: "10%" }] }));
    expect(inv.templateCode).toBe("1");
    expect(inv.series).toBe("C26TKT");
    expect(inv.number).toBe("123"); // bỏ số 0 đầu
    expect(inv.issueDate.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(inv.seller.taxCode).toBe("0100000001");
    expect(inv.buyer.taxCode).toBe("0200000002");
    expect(inv.buyer.fullName).toBe("Nguyễn Văn Kiểm Thử");
    expect(inv.taxAuthorityCode).toContain("M1-26-TEST");
    expect(inv.lines[0].unit).toBe("kg");
    expect(inv.lines[0].quantity!.toString()).toBe("10.5");
    expect(inv.lines[0].unitPrice!.toString()).toBe("20000");
    expect(inv.totalTax.toString()).toBe("21000");
    expect(inv.totalPayment.toString()).toBe("231000");
  });

  it("đọc nhiều dòng hàng", () => {
    const lines = Array.from({ length: 25 }, (_, i) => ({ name: `Hàng ${i + 1}`, unit: "cái", qty: "2", price: "1000", amount: "2000", rate: "10%" }));
    const inv = parseInvoiceXml(buildInvoiceXml({ ...base, lines }));
    expect(inv.lines).toHaveLength(25);
    expect(inv.lines[24].lineNo).toBe(25);
    expect(inv.totalBeforeTax.toString()).toBe("50000");
  });

  it("đọc nhiều thuế suất GTGT (10%, 8%, 5%, 0%, KCT)", () => {
    const inv = parseInvoiceXml(
      buildInvoiceXml({
        ...base,
        lines: [
          { name: "A", amount: "1000000", rate: "10%" },
          { name: "B", amount: "2000000", rate: "8%" },
          { name: "C", amount: "500000", rate: "5%" },
          { name: "D", amount: "300000", rate: "0%" },
          { name: "E", amount: "100000", rate: "KCT" },
        ],
      }),
    );
    const m = Object.fromEntries(inv.taxSummaries.map((s) => [s.taxRate, s.taxAmount.toString()]));
    expect(m).toEqual({ "10%": "100000", "8%": "160000", "5%": "25000", "0%": "0", KCT: "0" });
    expect(inv.totalTax.toString()).toBe("285000");
  });

  it("xử lý namespace có tiền tố và hồ sơ bọc ngoài TDiep", () => {
    const a = parseInvoiceXml(buildInvoiceXml({ ...base, ns: "prefixed", lines: [{ name: "X", amount: "100", rate: "10%" }] }));
    const b = parseInvoiceXml(buildInvoiceXml({ ...base, envelope: true, lines: [{ name: "X", amount: "100", rate: "10%" }] }));
    expect(a.seller.taxCode).toBe("0100000001");
    expect(b.number).toBe("123");
  });

  it("đọc hóa đơn thay thế / điều chỉnh", () => {
    const inv = parseInvoiceXml(
      buildInvoiceXml({ ...base, number: "200", nature: "1", related: { template: "1", series: "C26TKT", number: "123", date: "2026-03-15" }, lines: [{ name: "X", amount: "100", rate: "10%" }] }),
    );
    expect(inv.nature).toBe("REPLACEMENT");
    expect(inv.related?.number).toBe("123");
    const adj = parseInvoiceXml(
      buildInvoiceXml({ ...base, number: "201", nature: "2", related: { template: "1", series: "C26TKT", number: "123", date: "2026-03-15" }, lines: [{ name: "X", amount: "100", rate: "10%" }] }),
    );
    expect(adj.nature).toBe("ADJUSTMENT");
  });

  it("giữ chính xác số thập phân lớn (Decimal, không làm tròn float)", () => {
    const inv = parseInvoiceXml(buildInvoiceXml({ ...base, lines: [{ name: "X", qty: "0.123456", price: "123456789.123456", amount: "15241578.75", rate: "KCT" }] }));
    expect(inv.lines[0].unitPrice!.toString()).toBe("123456789.123456");
    expect(inv.lines[0].quantity!.toString()).toBe("0.123456");
  });

  it("báo lỗi XML sai cấu trúc kèm hướng khắc phục", () => {
    try {
      parseInvoiceXml("<HDon><DLHDon><TTChung></DLHDon>");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InvoiceParseError);
      expect((e as InvoiceParseError).code).toBe("MALFORMED_XML");
      expect((e as InvoiceParseError).hint).toBeTruthy();
    }
  });

  it("báo lỗi XML không phải hóa đơn", () => {
    expect(() => parseInvoiceXml("<ToKhai><A>1</A></ToKhai>")).toThrowError(/không phải hóa đơn/);
  });

  it("báo lỗi thiếu trường bắt buộc", () => {
    const xml = buildInvoiceXml({ ...base, lines: [{ name: "X", amount: "1", rate: "10%" }] }).replace(/<SHDon>.*?<\/SHDon>/, "");
    expect(() => parseInvoiceXml(xml)).toThrowError(/SHDon/);
  });

  it("chuẩn hóa thuế suất", () => {
    expect(normalizeTaxRate("10%")).toBe("10%");
    expect(normalizeTaxRate("10")).toBe("10%");
    expect(normalizeTaxRate("0.08")).toBe("8%");
    expect(normalizeTaxRate("kct")).toBe("KCT");
  });
});
