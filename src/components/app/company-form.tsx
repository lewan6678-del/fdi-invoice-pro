"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "./toast";

export interface CompanyData {
  id?: string; taxCode: string; name: string; englishName?: string | null; address: string; fiscalYearStartMonth: number; currentFiscalYear: number;
  investorCountry?: string | null; email?: string | null; phone?: string | null;
}

export function CompanyFormDialog({ open, onOpenChange, initial, canChangeTaxCode }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: CompanyData; canChangeTaxCode: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setErr(null);
    try {
      if (initial?.id) await api(`/api/companies/${initial.id}`, { method: "PATCH", json: fd });
      else await api("/api/companies", { method: "POST", json: fd });
      toast({ tone: "success", title: initial?.id ? "Đã lưu thông tin công ty." : "Đã tạo công ty mới." });
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.info : { message: "Lỗi không xác định" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial?.id ? "Sửa thông tin công ty" : "Thêm công ty mới"} description="Thông tin pháp nhân dùng để nhận diện hóa đơn mua vào / bán ra theo MST." className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4" data-testid="company-form">
          {err && <Alert title={err.message} hint={err.hint} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã số thuế *" hint={!canChangeTaxCode && initial?.id ? "Chỉ Quản trị hệ thống được đổi MST." : "10 số hoặc 10 số-3 số (chi nhánh)"}>
              <Input name="taxCode" required defaultValue={initial?.taxCode} disabled={!!initial?.id && !canChangeTaxCode} placeholder="0312345678" />
            </Field>
            <Field label="Quốc gia nhà đầu tư">
              <Input name="investorCountry" defaultValue={initial?.investorCountry ?? ""} placeholder="Nhật Bản, Hàn Quốc…" />
            </Field>
          </div>
          <Field label="Tên công ty (tiếng Việt) *"><Input name="name" required defaultValue={initial?.name} placeholder="CÔNG TY TNHH …" /></Field>
          <Field label="Tên tiếng Anh"><Input name="englishName" defaultValue={initial?.englishName ?? ""} /></Field>
          <Field label="Địa chỉ *"><Input name="address" required defaultValue={initial?.address} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Năm tài chính hiện tại *"><Input name="currentFiscalYear" type="number" min={2000} max={2100} required defaultValue={initial?.currentFiscalYear ?? year} /></Field>
            <Field label="Tháng bắt đầu năm tài chính *">
              <Select name="fiscalYearStartMonth" defaultValue={initial?.fiscalYearStartMonth ?? 1}>
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
              </Select>
            </Field>
            <Field label="Email"><Input name="email" type="email" defaultValue={initial?.email ?? ""} /></Field>
            <Field label="Điện thoại"><Input name="phone" defaultValue={initial?.phone ?? ""} /></Field>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Lưu</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
