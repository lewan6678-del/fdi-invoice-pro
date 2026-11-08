"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Search, Loader2, FileText, ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/card";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";
import { fmtMoney } from "@/lib/money";
import { fmtDate } from "@/lib/period";
import { DirectionBadge, NatureBadge, InvoiceStatusBadge } from "./status";
import { InvoiceDetailDialog } from "./invoice-detail";

interface Row {
  id: string; direction: "SALE" | "PURCHASE"; nature: "ORIGINAL" | "REPLACEMENT" | "ADJUSTMENT"; status: "ACTIVE" | "REPLACED" | "ADJUSTED" | "CANCELLED";
  templateCode: string; series: string; number: string; issueDate: string; sellerName: string; sellerTaxCode: string; buyerName: string | null; buyerTaxCode: string | null;
  currency: string; totalBeforeTax: string; totalTax: string; totalPayment: string; pdfFileId: string | null;
}
interface ListResult { total: number; page: number; pageSize: number; rows: Row[]; sums: { totalBeforeTax: string | null; totalTax: string | null; totalPayment: string | null } }

export function InvoiceBrowser({ companyId, period, canEdit, openId }: { companyId: string; period: string; canEdit: boolean; openId: string | null }) {
  const [direction, setDirection] = useState("");
  const [nature, setNature] = useState("");
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [selected, setSelected] = useState<string | null>(openId);

  const qs = useCallback(
    (extra: Record<string, string> = {}) => new URLSearchParams({ companyId, period, direction, nature, q: qApplied, ...extra }).toString(),
    [companyId, period, direction, nature, qApplied],
  );

  useEffect(() => {
    setLoading(true);
    api<ListResult>(`/api/invoices?${qs({ page: String(page), pageSize: "50" })}`)
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.info : { message: "Lỗi tải dữ liệu" }))
      .finally(() => setLoading(false));
  }, [qs, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setPage(1); setQApplied(q); }}>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Loại hóa đơn</label>
            <Select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }} aria-label="Loại hóa đơn" data-testid="filter-direction">
              <option value="">Tất cả</option>
              <option value="PURCHASE">Mua vào</option>
              <option value="SALE">Bán ra</option>
            </Select>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tính chất</label>
            <Select value={nature} onChange={(e) => { setNature(e.target.value); setPage(1); }} aria-label="Tính chất">
              <option value="">Tất cả</option>
              <option value="ORIGINAL">Hóa đơn gốc</option>
              <option value="REPLACEMENT">Thay thế</option>
              <option value="ADJUSTMENT">Điều chỉnh</option>
            </Select>
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Số HĐ, ký hiệu, MST, tên người bán/mua…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="search-input" />
            </div>
          </div>
          <Button type="submit" variant="secondary"><Search /> Tìm</Button>
          <Button type="button" variant="outline" asChild>
            <a href={`/api/export?${qs()}`} data-testid="export-btn"><FileSpreadsheet /> Xuất Excel</a>
          </Button>
        </form>
      </Card>

      {err && <Alert className="mb-4" title={err.message} hint={err.hint} />}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Đang tải…</div>
        ) : data && data.rows.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="Không có hóa đơn phù hợp" description="Thử đổi kỳ kế toán ở thanh trên cùng, bỏ bộ lọc, hoặc nhập thêm hóa đơn." />
        ) : data ? (
          <div className="overflow-x-auto">
            <table className="table-base" data-testid="invoice-table">
              <thead>
                <tr><th>Ngày lập</th><th>Ký hiệu / Số</th><th>Loại</th><th>Đối tác</th><th className="num">Chưa thuế</th><th className="num">Thuế GTGT</th><th className="num">Tổng thanh toán</th><th>Trạng thái</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const partner = r.direction === "SALE" ? { n: r.buyerName, t: r.buyerTaxCode } : { n: r.sellerName, t: r.sellerTaxCode };
                  return (
                    <tr key={r.id} className="cursor-pointer" onClick={() => setSelected(r.id)} data-testid="invoice-row">
                      <td className="whitespace-nowrap">{fmtDate(r.issueDate)}</td>
                      <td className="whitespace-nowrap">
                        <span className="font-medium">{r.templateCode}{r.series}</span> – <span className="font-semibold">{r.number}</span>
                        {r.pdfFileId && <Paperclip className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" aria-label="Có PDF" />}
                      </td>
                      <td><div className="flex gap-1"><DirectionBadge d={r.direction} /><NatureBadge n={r.nature} /></div></td>
                      <td className="max-w-[320px]"><p className="truncate">{partner.n ?? "(không có tên)"}</p><p className="text-xs text-muted-foreground">{partner.t ?? "—"}</p></td>
                      <td className="num">{fmtMoney(r.totalBeforeTax)}</td>
                      <td className="num">{fmtMoney(r.totalTax)}</td>
                      <td className="num font-medium">{fmtMoney(r.totalPayment)}{r.currency !== "VND" && <span className="ml-1 text-xs text-muted-foreground">{r.currency}</span>}</td>
                      <td><InvoiceStatusBadge s={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/60 font-semibold">
                  <td className="px-3 py-2.5" colSpan={4}>Tổng cộng {data.total} hóa đơn (theo bộ lọc)</td>
                  <td className="num px-3">{fmtMoney(data.sums.totalBeforeTax ?? 0)}</td>
                  <td className="num px-3">{fmtMoney(data.sums.totalTax ?? 0)}</td>
                  <td className="num px-3">{fmtMoney(data.sums.totalPayment ?? 0)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-end gap-2 border-t px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Trang {page}/{pages}</span>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft /> Trước</Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau <ChevronRight /></Button>
          </div>
        )}
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Download className="h-3.5 w-3.5" /> File Excel chỉ chứa hóa đơn của công ty đang chọn, theo đúng bộ lọc hiện tại.</p>
      <InvoiceDetailDialog invoiceId={selected} companyId={companyId} canEdit={canEdit} onClose={() => setSelected(null)} onOpenOther={(id) => setSelected(id)} />
    </>
  );
}
