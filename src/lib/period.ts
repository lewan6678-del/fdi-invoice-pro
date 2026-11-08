/** Kỳ kế toán: tháng (2026-03), quý (2026-Q1) hoặc năm (2026). */
export type PeriodType = "month" | "quarter" | "year";
export interface Period {
  type: PeriodType;
  year: number;
  value: number; // tháng 1-12, quý 1-4, hoặc = year
}

export function parsePeriod(raw: string | null | undefined): Period | null {
  if (!raw) return null;
  let m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (m) {
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { type: "month", year: Number(m[1]), value: month };
  }
  m = /^(\d{4})-Q([1-4])$/.exec(raw);
  if (m) return { type: "quarter", year: Number(m[1]), value: Number(m[2]) };
  m = /^(\d{4})$/.exec(raw);
  if (m) return { type: "year", year: Number(m[1]), value: Number(m[1]) };
  return null;
}

export function periodToString(p: Period): string {
  if (p.type === "month") return `${p.year}-${String(p.value).padStart(2, "0")}`;
  if (p.type === "quarter") return `${p.year}-Q${p.value}`;
  return String(p.year);
}

export function periodLabel(p: Period): string {
  if (p.type === "month") return `Tháng ${String(p.value).padStart(2, "0")}/${p.year}`;
  if (p.type === "quarter") return `Quý ${p.value}/${p.year}`;
  return `Năm ${p.year}`;
}

/** Khoảng ngày [from, to) theo UTC – cột issue_date kiểu DATE. */
export function periodRange(p: Period): { from: Date; to: Date } {
  if (p.type === "month") return { from: new Date(Date.UTC(p.year, p.value - 1, 1)), to: new Date(Date.UTC(p.year, p.value, 1)) };
  if (p.type === "quarter") {
    const sm = (p.value - 1) * 3;
    return { from: new Date(Date.UTC(p.year, sm, 1)), to: new Date(Date.UTC(p.year, sm + 3, 1)) };
  }
  return { from: new Date(Date.UTC(p.year, 0, 1)), to: new Date(Date.UTC(p.year + 1, 0, 1)) };
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
