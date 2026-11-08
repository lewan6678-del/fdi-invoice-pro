"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Info, Package, Percent, FileCode2, Download, Link2, Upload } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";
import { fmtMoney, fmtQty } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/period";
import { DirectionBadge, InvoiceStatusBadge, NATURE_LABEL } from "./status";
import { useToast } from "./toast";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Inv = any;
/** Chỉ định dạng để HIỂN THỊ; file tải về luôn là XML gốc nguyên vẹn. */
function prettyXml(x: string) {
  let depth = 0;
  return x.replace(/>\s*</g, ">\n<").split("\n").map((line) => {
    const t = line.trim();
    if (/^<\/[^>]+>$/.test(t)) depth = Math.max(depth - 1, 0);
    const out = "  ".repeat(depth) + t;
    if (/^<[^!?/][^>]*[^/]>$/.test(t) && !/<\/[^>]+>$/.test(t)) depth++;
    return out;
  }).join("\n");
}
const LINE_NATURE: Record<number, string> = { 1: "Hàng hóa, dịch vụ", 2: "Khuyến mại", 3: "Chiết khấu thương mại", 4: "Ghi chú/diễn giải" };

export function InvoiceDetailDialog({ invoiceId, companyId, canEdit, onClose, onOpenOther }: { invoiceId: string | null; companyId: string; canEdit: boolean; onClose: () => void; onOpenOther: (id: string) => void }) {
  const [inv, setInv] = useState<Inv | null>(null);
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [xml, setXml] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const toast = useToast();
  const pdfInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!invoiceId) return;
    setInv(null); setErr(null); setXml(null);
    api<{ invoice: Inv }>(`/api/invoices/${invoiceId}?companyId=${companyId}`)
      .then((r) => setInv(r.invoice))
      .catch((e) => setErr(e instanceof ApiError ? e.info : { message: "Lỗi tải hóa đơn" }));
  }, [invoiceId, companyId, reload]);

  const fileUrl = (id: string, dl = false) => `/api/files/${id}?companyId=${companyId}${dl ? "&download=1" : ""}`;
  async function loadXml() {
    if (xml || !inv?.xmlFile) return;
    const r = await fetch(fileUrl(inv.xmlFile.id));
    setXml(r.ok ? prettyXml(await r.text()) : "Không tải được XML.");
  }
  async function uploadPdf(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    try {
      await api(`/api/invoices/${inv.id}/pdf?companyId=${companyId}`, { method: "POST", body: fd });
      toast({ tone: "success", title: "Đã đính kèm PDF." });
      setReload((x) => x + 1);
    } catch (e) {
      if (e instanceof ApiError) toast({ tone: "error", title: e.info.message, hint: e.info.hint });
    }
  }

  const title = inv ? `Hóa đơn ${inv.templateCode}${inv.series} – số ${inv.number}` : "Chi tiết hóa đơn";
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="break-words">{v || "—"}</span></div>
  );

  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title} description={inv ? `Ngày lập ${fmtDate(inv.issueDate)} · ${inv.invoiceName ?? "Hóa đơn điện tử"}` : undefined} className="max-w-5xl" data-testid="invoice-dialog">
        {err && <Alert title={err.message} hint={err.hint} />}
        {!inv && !err && <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Đang tải…</div>}
        {inv && (
          <Tabs defaultValue="info" onValueChange={(v) => v === "files" && loadXml()}>
            <TabsList>
              <TabsTrigger value="info"><Info /> Thông tin chung</TabsTrigger>
              <TabsTrigger value="lines"><Package /> Hàng hóa ({inv.lines.length})</TabsTrigger>
              <TabsTrigger value="tax"><Percent /> Thuế</TabsTrigger>
              <TabsTrigger value="files"><FileCode2 /> XML / PDF</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <div className="mb-3 flex flex-wrap gap-2">
                <DirectionBadge d={inv.direction} />
                <Badge tone="violet">{NATURE_LABEL[inv.nature as keyof typeof NATURE_LABEL]}</Badge>
                <InvoiceStatusBadge s={inv.status} />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-md border p-4">
                  <p className="mb-2 text-sm font-semibold">Người bán</p>
                  <Row k="Tên" v={inv.sellerName} />
                  <Row k="MST" v={inv.sellerTaxCode} />
                  <Row k="Địa chỉ" v={inv.sellerAddress} />
                </div>
                <div className="rounded-md border p-4">
                  <p className="mb-2 text-sm font-semibold">Người mua</p>
                  <Row k="Tên đơn vị" v={inv.buyerName} />
                  <Row k="Người mua hàng" v={inv.buyerFullName} />
                  <Row k="MST" v={inv.buyerTaxCode} />
                  <Row k="Địa chỉ" v={inv.buyerAddress} />
                </div>
              </div>
              <div className="mt-4 grid gap-6 rounded-md border p-4 md:grid-cols-2">
                <div>
                  <Row k="Ký hiệu mẫu số" v={inv.templateCode} />
                  <Row k="Ký hiệu hóa đơn" v={inv.series} />
                  <Row k="Số hóa đơn" v={inv.number} />
                  <Row k="Ngày lập" v={fmtDate(inv.issueDate)} />
                </div>
                <div>
                  <Row k="Mã CQT" v={inv.taxAuthorityCode} />
                  <Row k="Hình thức TT" v={inv.paymentMethod} />
                  <Row k="Tiền tệ / Tỷ giá" v={`${inv.currency} / ${fmtQty(inv.exchangeRate)}`} />
                  <Row k="Ngày nhập hệ thống" v={fmtDateTime(inv.createdAt)} />
                </div>
              </div>
              {(inv.nature !== "ORIGINAL" || inv.derivedInvoices.length > 0) && (
                <div className="mt-4 rounded-md border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-violet-500/5">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Link2 className="h-4 w-4" /> Hóa đơn liên quan</p>
                  {inv.nature !== "ORIGINAL" && (
                    <p className="text-sm">
                      {NATURE_LABEL[inv.nature as keyof typeof NATURE_LABEL]} cho hóa đơn {inv.relatedTemplateCode}{inv.relatedSeries} – số {inv.relatedNumber} ngày {fmtDate(inv.relatedIssueDate)}.{" "}
                      {inv.relatedInvoice ? <button className="text-primary hover:underline" onClick={() => onOpenOther(inv.relatedInvoice.id)}>Mở hóa đơn gốc</button> : <span className="text-amber-700 dark:text-amber-300">Hóa đơn gốc chưa được nhập vào hệ thống.</span>}
                    </p>
                  )}
                  {inv.derivedInvoices.map((d: Inv) => (
                    <p key={d.id} className="text-sm">
                      Đã có hóa đơn {NATURE_LABEL[d.nature as keyof typeof NATURE_LABEL].toLowerCase()} {d.templateCode}{d.series} – số {d.number} ngày {fmtDate(d.issueDate)}.{" "}
                      <button className="text-primary hover:underline" onClick={() => onOpenOther(d.id)}>Mở</button>
                    </p>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="lines">
              <div className="max-h-[55vh] overflow-auto rounded-md border">
                <table className="table-base" data-testid="lines-table">
                  <thead><tr><th>STT</th><th>Tên hàng hóa, dịch vụ</th><th>ĐVT</th><th className="num">Số lượng</th><th className="num">Đơn giá</th><th className="num">Chiết khấu</th><th className="num">Thành tiền</th><th>Thuế suất</th></tr></thead>
                  <tbody>
                    {inv.lines.map((l: Inv) => (
                      <tr key={l.id}>
                        <td>{l.lineNo}</td>
                        <td>
                          <p>{l.itemName}</p>
                          <p className="text-xs text-muted-foreground">{l.itemCode ? `Mã: ${l.itemCode} · ` : ""}{LINE_NATURE[l.nature] ?? ""}</p>
                        </td>
                        <td>{l.unit}</td>
                        <td className="num">{fmtQty(l.quantity)}</td>
                        <td className="num">{fmtQty(l.unitPrice)}</td>
                        <td className="num">{l.discountAmount ? fmtMoney(l.discountAmount) : ""}</td>
                        <td className="num font-medium">{fmtMoney(l.amount)}</td>
                        <td>{l.taxRate && <Badge tone="blue">{l.taxRate}</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="tax">
              <div className="grid gap-6 md:grid-cols-2">
                <table className="table-base rounded-md border" data-testid="tax-table">
                  <thead><tr><th>Thuế suất</th><th className="num">Thành tiền chưa thuế</th><th className="num">Tiền thuế</th></tr></thead>
                  <tbody>
                    {inv.taxSummaries.map((s: Inv) => (
                      <tr key={s.id}><td><Badge tone="blue">{s.taxRate}</Badge></td><td className="num">{fmtMoney(s.taxableAmount)}</td><td className="num">{fmtMoney(s.taxAmount)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="rounded-md border p-4">
                  <Row k="Tổng tiền chưa thuế" v={<span className="tabular-nums">{fmtMoney(inv.totalBeforeTax)} {inv.currency}</span>} />
                  <Row k="Tổng tiền thuế GTGT" v={<span className="tabular-nums">{fmtMoney(inv.totalTax)} {inv.currency}</span>} />
                  <Row k="Tổng chiết khấu TM" v={<span className="tabular-nums">{fmtMoney(inv.totalDiscount)} {inv.currency}</span>} />
                  <Row k="Tổng thanh toán" v={<span className="text-base font-semibold tabular-nums">{fmtMoney(inv.totalPayment)} {inv.currency}</span>} />
                  <Row k="Bằng chữ" v={inv.totalInWords} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">XML gốc (bất biến) <span className="font-normal text-muted-foreground">– hiển thị đã căn lề</span></p>
                    {inv.xmlFile && <Button size="sm" variant="outline" asChild><a href={fileUrl(inv.xmlFile.id, true)}><Download /> Tải XML</a></Button>}
                  </div>
                  {inv.xmlFile && <p className="mb-2 break-all text-xs text-muted-foreground">{inv.xmlFile.originalName} · SHA-256: {inv.xmlFile.sha256}</p>}
                  <pre className="h-[50vh] overflow-auto rounded-md border bg-muted/50 p-3 text-xs leading-relaxed" data-testid="xml-view">{xml ?? "Đang tải…"}</pre>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Bản thể hiện PDF</p>
                    {inv.pdfFile && <Button size="sm" variant="outline" asChild><a href={fileUrl(inv.pdfFile.id, true)}><Download /> Tải PDF</a></Button>}
                  </div>
                  {inv.pdfFile ? (
                    <iframe title="PDF hóa đơn" src={fileUrl(inv.pdfFile.id)} className="h-[54vh] w-full rounded-md border" />
                  ) : (
                    <div className="flex h-[54vh] flex-col items-center justify-center gap-3 rounded-md border border-dashed text-center text-sm text-muted-foreground">
                      <p>Chưa có PDF cho hóa đơn này.</p>
                      <p className="max-w-xs text-xs">Mẹo: tải PDF cùng tên với file XML (vd. HD001.xml + HD001.pdf) để hệ thống tự ghép.</p>
                      {canEdit && (
                        <>
                          <input ref={pdfInput} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
                          <Button size="sm" onClick={() => pdfInput.current?.click()}><Upload /> Đính kèm PDF</Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
