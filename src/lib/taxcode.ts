/** MST Việt Nam: 10 số, hoặc 10 số + "-" + 3 số (chi nhánh). Cũng chấp nhận 12 số (CCCD dùng làm MST). */
export function normalizeTaxCode(v: string | null | undefined): string {
  return (v ?? "").replace(/\s/g, "").trim();
}
export function isValidTaxCode(v: string): boolean {
  return /^(\d{10}(-\d{3})?|\d{12})$/.test(v);
}
