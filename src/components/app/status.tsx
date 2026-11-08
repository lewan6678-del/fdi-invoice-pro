import { Badge } from "@/components/ui/card";

export function JobStatusBadge({ status }: { status: string }) {
  const m: Record<string, [string, "default" | "blue" | "green" | "amber" | "red"]> = {
    PENDING: ["Đang chờ", "default"],
    PROCESSING: ["Đang xử lý", "blue"],
    COMPLETED: ["Hoàn tất", "green"],
    FAILED: ["Thất bại", "red"],
  };
  const [l, t] = m[status] ?? [status, "default"];
  return <Badge tone={t}>{l}</Badge>;
}

export function ItemStatusBadge({ status }: { status: string }) {
  const m: Record<string, [string, "default" | "blue" | "green" | "amber" | "red"]> = {
    PENDING: ["Đang chờ", "default"],
    SUCCESS: ["Thành công", "green"],
    DUPLICATE: ["Trùng", "amber"],
    ERROR: ["Lỗi", "red"],
    SKIPPED: ["Bỏ qua", "default"],
  };
  const [l, t] = m[status] ?? [status, "default"];
  return <Badge tone={t}>{l}</Badge>;
}

export const DIRECTION_LABEL = { SALE: "Bán ra", PURCHASE: "Mua vào" } as const;
export const NATURE_LABEL = { ORIGINAL: "Gốc", REPLACEMENT: "Thay thế", ADJUSTMENT: "Điều chỉnh" } as const;
export const INVOICE_STATUS_LABEL = { ACTIVE: "Hiệu lực", REPLACED: "Bị thay thế", ADJUSTED: "Bị điều chỉnh", CANCELLED: "Đã hủy" } as const;

export function DirectionBadge({ d }: { d: "SALE" | "PURCHASE" }) {
  return <Badge tone={d === "SALE" ? "green" : "blue"}>{DIRECTION_LABEL[d]}</Badge>;
}
export function NatureBadge({ n }: { n: "ORIGINAL" | "REPLACEMENT" | "ADJUSTMENT" }) {
  if (n === "ORIGINAL") return null;
  return <Badge tone="violet">{NATURE_LABEL[n]}</Badge>;
}
export function InvoiceStatusBadge({ s }: { s: "ACTIVE" | "REPLACED" | "ADJUSTED" | "CANCELLED" }) {
  const tone = s === "ACTIVE" ? "green" : s === "CANCELLED" ? "red" : "amber";
  return <Badge tone={tone}>{INVOICE_STATUS_LABEL[s]}</Badge>;
}
