import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };

/** Chuyển chuỗi số trong XML sang Decimal. Chấp nhận "1234.5", "1,234.5" (dấu phẩy ngăn cách nghìn). */
export function toDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (s === "") return null;
  s = s.replace(/\s/g, "");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    else throw new Error(`Giá trị số không hợp lệ: "${value}"`);
  }
  return new Decimal(s);
}

export function fmtMoney(v: { toString(): string } | string | number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || v === "") return "";
  const d = new Decimal(v.toString());
  const fixed = d.toFixed(digits);
  const [i, f] = fixed.split(".");
  const neg = i.startsWith("-");
  const abs = neg ? i.slice(1) : i;
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + grouped + (f ? "," + f : "");
}

export function fmtQty(v: { toString(): string } | null | undefined): string {
  if (v === null || v === undefined) return "";
  const d = new Decimal(v.toString());
  const s = d.toDecimalPlaces(6).toString();
  const [i, f] = s.split(".");
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (f ? "," + f : "");
}
