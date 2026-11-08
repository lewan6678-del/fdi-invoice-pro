import { XMLParser, XMLValidator } from "fast-xml-parser";
import { Decimal, toDecimal } from "@/lib/money";
import { normalizeTaxCode } from "@/lib/taxcode";

/**
 * Bộ đọc XML hóa đơn điện tử Việt Nam theo Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC
 * (cấu trúc HDon/DLHDon/TTChung/NDHDon...). Hỗ trợ:
 * - Namespace bất kỳ (tiền tố được loại bỏ: <inv:HDon>, <ns2:DLHDon>...)
 * - Hồ sơ bọc ngoài (TDiep/DLieu/HDon, HDonNhan...)
 * - Nhiều dòng hàng, nhiều thuế suất, hóa đơn thay thế/điều chỉnh
 */

export class InvoiceParseError extends Error {
  constructor(public code: string, message: string, public hint: string) {
    super(message);
  }
}

export interface ParsedLine {
  lineNo: number;
  nature: number;
  itemCode: string | null;
  itemName: string;
  unit: string | null;
  quantity: Decimal | null;
  unitPrice: Decimal | null;
  discountRate: Decimal | null;
  discountAmount: Decimal | null;
  amount: Decimal;
  taxRate: string | null;
  taxAmount: Decimal | null;
}

export interface ParsedTaxSummary {
  taxRate: string;
  taxableAmount: Decimal;
  taxAmount: Decimal;
}

export interface ParsedInvoice {
  standard: string;
  invoiceName: string | null;
  templateCode: string;
  series: string;
  number: string;
  issueDate: Date;
  currency: string;
  exchangeRate: Decimal;
  paymentMethod: string | null;
  taxAuthorityCode: string | null;
  seller: { name: string; taxCode: string; address: string | null };
  buyer: { name: string | null; fullName: string | null; taxCode: string | null; address: string | null };
  lines: ParsedLine[];
  taxSummaries: ParsedTaxSummary[];
  totalBeforeTax: Decimal;
  totalTax: Decimal;
  totalDiscount: Decimal;
  totalPayment: Decimal;
  totalInWords: string | null;
  nature: "ORIGINAL" | "REPLACEMENT" | "ADJUSTMENT";
  related: {
    templateCode: string | null;
    series: string | null;
    number: string | null;
    issueDate: Date | null;
    note: string | null;
  } | null;
  warnings: string[];
}

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false, // giữ nguyên chuỗi để đọc Decimal chính xác
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ["HHDVu", "LTSuat", "TTin", "HDon"].includes(name),
  processEntities: true,
});

function txt(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") {
    const t = (v as Node)["#text"];
    return t === undefined ? null : String(t).trim() || null;
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}

function obj(v: unknown): Node | null {
  if (Array.isArray(v)) return (v[0] as Node) ?? null;
  return v && typeof v === "object" ? (v as Node) : null;
}

function arr(v: unknown): Node[] {
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => x && typeof x === "object") as Node[];
}

/** Tìm node HDon ở bất kỳ độ sâu nào (hồ sơ bọc ngoài). */
function findHDon(root: Node, depth = 0): Node | null {
  if (depth > 8 || !root || typeof root !== "object") return null;
  for (const [k, v] of Object.entries(root)) {
    if (k.startsWith("@_") || k === "#text") continue;
    if (k === "HDon") {
      const h = obj(v);
      if (h && h["DLHDon"]) return h;
    }
    if (k === "DLHDon" && obj(v)?.["TTChung"]) return root; // DLHDon trực tiếp dưới gốc
  }
  for (const [k, v] of Object.entries(root)) {
    if (k.startsWith("@_") || k === "#text") continue;
    for (const child of Array.isArray(v) ? v : [v]) {
      if (child && typeof child === "object") {
        const f = findHDon(child as Node, depth + 1);
        if (f) return f;
      }
    }
  }
  return null;
}

/** Đọc TTKhac/TTin dạng {TTruong, KDLieu, DLieu} → map tên trường → giá trị. */
function extraFields(node: Node | null): Record<string, string> {
  const out: Record<string, string> = {};
  const tt = obj(node?.["TTKhac"]);
  for (const t of arr(tt?.["TTin"])) {
    const k = txt(t["TTruong"]);
    const v = txt(t["DLieu"]);
    if (k && v) out[k] = v;
  }
  return out;
}

export function normalizeTaxRate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/\s/g, "");
  if (s === "KCT" || s === "KKKNT") return s;
  if (s.startsWith("KHAC")) return s;
  const m = /^(\d+(?:[.,]\d+)?)%?$/.exec(s);
  if (m) {
    const n = new Decimal(m[1].replace(",", "."));
    // Một số phần mềm ghi 0.1 thay vì 10%
    const pct = !s.endsWith("%") && n.lt(1) && !n.isZero() ? n.mul(100) : n;
    return `${pct.toString()}%`;
  }
  return s;
}

function req(v: string | null, field: string, path: string): string {
  if (!v) throw new InvoiceParseError("MISSING_FIELD", `Thiếu trường bắt buộc "${field}" (${path}).`, "File XML không đủ thông tin theo chuẩn TT78. Tải lại XML gốc từ cổng hóa đơn điện tử hoặc nhà cung cấp.");
  return v;
}

function dec(v: unknown, field: string): Decimal | null {
  try {
    return toDecimal(txt(v));
  } catch {
    throw new InvoiceParseError("INVALID_NUMBER", `Giá trị số không hợp lệ ở trường "${field}": "${txt(v)}".`, "Kiểm tra file XML có bị chỉnh sửa thủ công. Tải lại XML gốc.");
  }
}

function parseDate(v: string | null, field: string): Date {
  const s = req(v, field, "TTChung");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new InvoiceParseError("INVALID_DATE", `Ngày không hợp lệ ở "${field}": "${s}".`, "Ngày phải theo định dạng YYYY-MM-DD theo chuẩn TT78.");
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(d.getTime()) || d.getUTCDate() !== +m[3]) throw new InvoiceParseError("INVALID_DATE", `Ngày không tồn tại: "${s}".`, "Kiểm tra lại ngày lập hóa đơn trong XML.");
  return d;
}

function optDate(v: string | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const m2 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m2) return new Date(Date.UTC(+m2[3], +m2[2] - 1, +m2[1]));
  return null;
}

/** Nhận diện nhanh: buffer có phải XML hóa đơn điện tử? */
export function looksLikeInvoiceXml(buf: Buffer): boolean {
  const head = buf.subarray(0, 4096).toString("utf8").replace(/^﻿/, "");
  return /<\s*([\w-]+:)?(HDon|DLHDon|TDiep)[\s>]/.test(head) || (head.trimStart().startsWith("<") && /DLHDon/.test(buf.toString("utf8")));
}

export function parseInvoiceXml(input: Buffer | string): ParsedInvoice {
  const xml = (typeof input === "string" ? input : input.toString("utf8")).replace(/^﻿/, "");
  if (!xml.trim().startsWith("<")) {
    throw new InvoiceParseError("NOT_XML", "File không phải định dạng XML.", "Chỉ tải lên file .xml hóa đơn điện tử gốc (không phải file Excel/Word đổi đuôi).");
  }
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new InvoiceParseError(
      "MALFORMED_XML",
      `XML sai cấu trúc tại dòng ${valid.err.line}: ${valid.err.msg}`,
      "File có thể bị hỏng hoặc tải về chưa đầy đủ. Tải lại XML gốc từ cổng hoadondientu.gdt.gov.vn hoặc từ nhà cung cấp.",
    );
  }
  const root = parser.parse(xml) as Node;
  const hdon = findHDon(root);
  if (!hdon) {
    throw new InvoiceParseError(
      "NOT_INVOICE",
      "XML không phải hóa đơn điện tử (không tìm thấy thẻ HDon/DLHDon).",
      "Có thể đây là tờ khai, thông báo hoặc XML khác. Chỉ tải lên XML hóa đơn theo chuẩn TT78/NĐ123.",
    );
  }
  const warnings: string[] = [];
  const dl = obj(hdon["DLHDon"])!;
  const tc = obj(dl["TTChung"]);
  if (!tc) throw new InvoiceParseError("MISSING_FIELD", 'Thiếu nhóm "TTChung" (thông tin chung).', "XML không đúng chuẩn TT78.");
  const nd = obj(dl["NDHDon"]);
  if (!nd) throw new InvoiceParseError("MISSING_FIELD", 'Thiếu nhóm "NDHDon" (nội dung hóa đơn).', "XML không đúng chuẩn TT78.");

  const nban = obj(nd["NBan"]);
  const nmua = obj(nd["NMua"]);
  if (!nban) throw new InvoiceParseError("MISSING_FIELD", 'Thiếu thông tin người bán "NBan".', "XML không đúng chuẩn TT78.");

  const sellerTax = normalizeTaxCode(req(txt(nban["MST"]), "NBan/MST", "NDHDon"));
  const templateCode = req(txt(tc["KHMSHDon"]), "KHMSHDon (ký hiệu mẫu số)", "TTChung");
  const series = req(txt(tc["KHHDon"]), "KHHDon (ký hiệu hóa đơn)", "TTChung");
  const numberRaw = req(txt(tc["SHDon"]), "SHDon (số hóa đơn)", "TTChung");
  const number = /^\d+$/.test(numberRaw) ? String(Number(numberRaw)) : numberRaw; // bỏ số 0 ở đầu để chống trùng
  const issueDate = parseDate(txt(tc["NLap"]), "NLap (ngày lập)");

  // Dòng hàng hóa
  const ds = obj(nd["DSHHDVu"]);
  const items = arr(ds?.["HHDVu"]);
  const lines: ParsedLine[] = items.map((it, idx) => {
    const extra = extraFields(it);
    const amount = dec(it["ThTien"], `HHDVu[${idx + 1}]/ThTien`);
    const nature = Number(txt(it["TChat"]) ?? "1") || 1;
    return {
      lineNo: Number(txt(it["STT"]) ?? idx + 1) || idx + 1,
      nature,
      itemCode: txt(it["MHHDVu"]),
      itemName: txt(it["THHDVu"]) ?? "(không có tên)",
      unit: txt(it["DVTinh"]),
      quantity: dec(it["SLuong"], `HHDVu[${idx + 1}]/SLuong`),
      unitPrice: dec(it["DGia"], `HHDVu[${idx + 1}]/DGia`),
      discountRate: dec(it["TLCKhau"], `HHDVu[${idx + 1}]/TLCKhau`),
      discountAmount: dec(it["STCKhau"], `HHDVu[${idx + 1}]/STCKhau`),
      amount: amount ?? new Decimal(0),
      taxRate: normalizeTaxRate(txt(it["TSuat"])),
      taxAmount: dec(it["TThue"] ?? extra["TThue"] ?? extra["TienThue"], `HHDVu[${idx + 1}]/TThue`),
    };
  });
  if (lines.length === 0) warnings.push("Hóa đơn không có dòng hàng hóa/dịch vụ (DSHHDVu trống).");

  // Tổng hợp thanh toán
  const tt = obj(nd["TToan"]) ?? {};
  const ltList = arr(obj(tt["THTTLTSuat"])?.["LTSuat"]);
  let taxSummaries: ParsedTaxSummary[] = ltList.map((l, i) => ({
    taxRate: normalizeTaxRate(txt(l["TSuat"])) ?? "KHAC",
    taxableAmount: dec(l["ThTien"], `LTSuat[${i + 1}]/ThTien`) ?? new Decimal(0),
    taxAmount: dec(l["TThue"], `LTSuat[${i + 1}]/TThue`) ?? new Decimal(0),
  }));

  // Nếu XML không có bảng tổng hợp theo thuế suất → tự tổng hợp từ dòng hàng
  if (taxSummaries.length === 0 && lines.length > 0) {
    const map = new Map<string, { base: Decimal; tax: Decimal }>();
    for (const l of lines) {
      if (l.nature === 4) continue;
      const r = l.taxRate ?? "KHAC";
      const sign = l.nature === 3 ? -1 : 1;
      const cur = map.get(r) ?? { base: new Decimal(0), tax: new Decimal(0) };
      cur.base = cur.base.add(l.amount.mul(sign));
      const pct = /^(\d+(\.\d+)?)%$/.exec(r);
      const lineTax = l.taxAmount ?? (pct ? l.amount.mul(pct[1]).div(100) : new Decimal(0));
      cur.tax = cur.tax.add(lineTax.mul(sign));
      map.set(r, cur);
    }
    taxSummaries = [...map.entries()].map(([taxRate, v]) => ({ taxRate, taxableAmount: v.base, taxAmount: v.tax.toDecimalPlaces(0) }));
    warnings.push("XML không có bảng tổng hợp thuế suất (THTTLTSuat); hệ thống tự tổng hợp từ dòng hàng.");
  }

  const sumBase = taxSummaries.reduce((a, s) => a.add(s.taxableAmount), new Decimal(0));
  const sumTax = taxSummaries.reduce((a, s) => a.add(s.taxAmount), new Decimal(0));
  const totalBeforeTax = dec(tt["TgTCThue"], "TToan/TgTCThue") ?? sumBase;
  const totalTax = dec(tt["TgTThue"], "TToan/TgTThue") ?? sumTax;
  const totalDiscount = dec(tt["TTCKTMai"], "TToan/TTCKTMai") ?? new Decimal(0);
  const totalPayment = dec(tt["TgTTTBSo"], "TToan/TgTTTBSo") ?? totalBeforeTax.add(totalTax);

  if (ltList.length > 0 && !sumTax.eq(totalTax)) {
    warnings.push(`Tổng tiền thuế theo thuế suất (${sumTax.toString()}) khác tổng tiền thuế (${totalTax.toString()}).`);
  }

  // Hóa đơn liên quan (thay thế/điều chỉnh)
  const tchd = txt(tc["TCHDon"]);
  const lq = obj(tc["TTHDLQuan"]);
  let nature: ParsedInvoice["nature"] = "ORIGINAL";
  const tch = tchd ?? txt(lq?.["TCHDon"]);
  if (tch === "1") nature = "REPLACEMENT";
  else if (tch === "2") nature = "ADJUSTMENT";
  const related = lq
    ? {
        templateCode: txt(lq["KHMSHDCLQuan"]),
        series: txt(lq["KHHDCLQuan"]),
        number: (() => {
          const n = txt(lq["SHDCLQuan"]);
          return n && /^\d+$/.test(n) ? String(Number(n)) : n;
        })(),
        issueDate: optDate(txt(lq["NLHDCLQuan"])),
        note: txt(lq["GChu"]),
      }
    : null;
  if (nature !== "ORIGINAL" && !related) warnings.push("Hóa đơn thay thế/điều chỉnh nhưng thiếu thông tin hóa đơn liên quan (TTHDLQuan).");

  const tchung = tc;
  const invoiceName = txt(tchung["THDon"]);
  return {
    standard: "TT78",
    invoiceName,
    templateCode,
    series,
    number,
    issueDate,
    currency: txt(tchung["DVTTe"]) ?? "VND",
    exchangeRate: dec(tchung["TGia"], "TGia") ?? new Decimal(1),
    paymentMethod: txt(tchung["HTTToan"]),
    taxAuthorityCode: txt(hdon["MCCQT"]),
    seller: { name: txt(nban["Ten"]) ?? "", taxCode: sellerTax, address: txt(nban["DChi"]) },
    buyer: {
      name: txt(nmua?.["Ten"]),
      fullName: txt(nmua?.["HVTNMHang"]),
      taxCode: nmua ? normalizeTaxCode(txt(nmua["MST"])) || null : null,
      address: txt(nmua?.["DChi"]),
    },
    lines,
    taxSummaries,
    totalBeforeTax,
    totalTax,
    totalDiscount,
    totalPayment,
    totalInWords: txt(tt["TgTTTBChu"]),
    nature,
    related,
    warnings,
  };
}
