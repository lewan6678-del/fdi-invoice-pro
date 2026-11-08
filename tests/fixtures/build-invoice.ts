/**
 * Bộ sinh XML hóa đơn TỔNG HỢP (dữ liệu giả lập) theo cấu trúc TT78.
 * Tuyệt đối không dùng hóa đơn thật trong kiểm thử.
 */
export interface FixtureLine {
  name: string;
  unit?: string;
  qty?: string;
  price?: string;
  amount: string;
  rate: string; // "10%", "8%", "KCT"...
  nature?: number;
  code?: string;
}
export interface FixtureOpts {
  sellerTax: string;
  buyerTax: string;
  sellerName?: string;
  buyerName?: string;
  template?: string;
  series?: string;
  number: string;
  date?: string;
  lines: FixtureLine[];
  ns?: "default" | "prefixed" | "none";
  envelope?: boolean;
  nature?: "1" | "2";
  related?: { template: string; series: string; number: string; date: string };
  currency?: string;
  rate?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function buildInvoiceXml(o: FixtureOpts): string {
  const p = o.ns === "prefixed" ? "inv:" : "";
  const t = (name: string, v: string | undefined | null) => (v === undefined || v === null ? "" : `<${p}${name}>${esc(v)}</${p}${name}>`);
  const groups = new Map<string, { base: number; tax: number }>();
  for (const l of o.lines) {
    if (l.nature === 4) continue;
    const g = groups.get(l.rate) ?? { base: 0, tax: 0 };
    const sign = l.nature === 3 ? -1 : 1;
    g.base += sign * Number(l.amount);
    const pct = /^(\d+)%$/.exec(l.rate);
    g.tax += sign * (pct ? Math.round((Number(l.amount) * Number(pct[1])) / 100) : 0);
    groups.set(l.rate, g);
  }
  const totBase = [...groups.values()].reduce((a, g) => a + g.base, 0);
  const totTax = [...groups.values()].reduce((a, g) => a + g.tax, 0);
  const lines = o.lines
    .map(
      (l, i) =>
        `<${p}HHDVu>${t("TChat", String(l.nature ?? 1))}${t("STT", String(i + 1))}${t("MHHDVu", l.code)}${t("THHDVu", l.name)}${t("DVTinh", l.unit)}${t("SLuong", l.qty)}${t("DGia", l.price)}${t("ThTien", l.amount)}${t("TSuat", l.rate)}</${p}HHDVu>`,
    )
    .join("");
  const lts = [...groups.entries()].map(([r, g]) => `<${p}LTSuat>${t("TSuat", r)}${t("ThTien", String(g.base))}${t("TThue", String(g.tax))}</${p}LTSuat>`).join("");
  const related = o.related
    ? `<${p}TTHDLQuan>${t("TCHDon", o.nature)}${t("LHDCLQuan", "1")}${t("KHMSHDCLQuan", o.related.template)}${t("KHHDCLQuan", o.related.series)}${t("SHDCLQuan", o.related.number)}${t("NLHDCLQuan", o.related.date)}</${p}TTHDLQuan>`
    : "";
  const nsAttr = o.ns === "prefixed" ? ` xmlns:inv="http://kiemthu.local/einvoice"` : o.ns === "none" ? "" : ` xmlns="http://kiemthu.local/einvoice"`;
  const hdon = `<${p}HDon${nsAttr}><${p}DLHDon Id="data">
<${p}TTChung>${t("PBan", "2.0.0")}${t("THDon", "HÓA ĐƠN GIÁ TRỊ GIA TĂNG")}${t("KHMSHDon", o.template ?? "1")}${t("KHHDon", o.series ?? "C26TKT")}${t("SHDon", o.number)}${t("NLap", o.date ?? "2026-03-15")}${t("DVTTe", o.currency ?? "VND")}${t("TGia", o.rate ?? "1")}${t("HTTToan", "TM/CK")}${related}</${p}TTChung>
<${p}NDHDon>
<${p}NBan>${t("Ten", o.sellerName ?? "CÔNG TY TNHH BÁN HÀNG MẪU")}${t("MST", o.sellerTax)}${t("DChi", "Số 1 Đường Thử Nghiệm, KCN Mẫu")}</${p}NBan>
<${p}NMua>${t("Ten", o.buyerName ?? "CÔNG TY TNHH MUA HÀNG MẪU")}${t("MST", o.buyerTax)}${t("DChi", "Số 2 Đường Thử Nghiệm")}${t("HVTNMHang", "Nguyễn Văn Kiểm Thử")}</${p}NMua>
<${p}DSHHDVu>${lines}</${p}DSHHDVu>
<${p}TToan><${p}THTTLTSuat>${lts}</${p}THTTLTSuat>${t("TgTCThue", String(totBase))}${t("TgTThue", String(totTax))}${t("TgTTTBSo", String(totBase + totTax))}${t("TgTTTBChu", "Số tiền bằng chữ (dữ liệu mẫu)")}</${p}TToan>
</${p}NDHDon></${p}DLHDon>${t("MCCQT", "M1-26-TEST-" + o.number.padStart(8, "0"))}</${p}HDon>`;
  const body = o.envelope ? `<TDiep><TTChung><MNGui>TEST</MNGui></TTChung><DLieu>${hdon}</DLieu></TDiep>` : hdon;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

/** PDF tối giản hợp lệ về chữ ký file (%PDF-) dùng cho kiểm thử. */
export function fakePdf(label: string): Buffer {
  return Buffer.from(`%PDF-1.4\n% Ban the hien mau: ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
}
