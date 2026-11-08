"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api-client";
import { CompanyFormDialog, type CompanyData } from "./company-form";
import { useToast } from "./toast";

interface Row extends CompanyData { id: string; isActive: boolean; myRole: string | null; _count: { invoices: number; memberships: number } }
const ROLE: Record<string, string> = { SYSTEM_ADMIN: "Quản trị hệ thống", COMPANY_ADMIN: "Quản trị công ty", EDITOR: "Editor", VIEWER: "Viewer" };

export function CompaniesTable({ rows, isSystemAdmin }: { rows: Row[]; isSystemAdmin: boolean }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function toggle(r: Row) {
    if (r.isActive && !confirm(`Ngừng hoạt động công ty "${r.name}"?\nDữ liệu được giữ nguyên, nhưng không thể nhập hóa đơn mới.`)) return;
    try {
      await api(`/api/companies/${r.id}/active`, { method: "POST", json: { isActive: !r.isActive } });
      toast({ tone: "success", title: r.isActive ? "Đã ngừng hoạt động công ty." : "Đã kích hoạt lại công ty." });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) toast({ tone: "error", title: e.info.message, hint: e.info.hint });
    }
  }

  return (
    <>
      {isSystemAdmin && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setCreating(true)} data-testid="add-company"><Plus /> Thêm công ty</Button>
        </div>
      )}
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="Chưa có công ty" description={isSystemAdmin ? "Bấm 'Thêm công ty' để khai báo pháp nhân đầu tiên." : "Bạn chưa được gán vào công ty nào."} />
        ) : (
          <table className="table-base" data-testid="companies-table">
            <thead><tr><th>MST</th><th>Tên công ty</th><th>Năm tài chính</th><th className="num">Hóa đơn</th><th className="num">Thành viên</th><th>Vai trò của bạn</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const admin = r.myRole === "SYSTEM_ADMIN" || r.myRole === "COMPANY_ADMIN";
                return (
                  <tr key={r.id}>
                    <td className="font-medium tabular-nums">{r.taxCode}</td>
                    <td><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.address}</p></td>
                    <td className="whitespace-nowrap">{r.currentFiscalYear} (từ T{r.fiscalYearStartMonth})</td>
                    <td className="num">{r._count.invoices}</td>
                    <td className="num">{r._count.memberships}</td>
                    <td><Badge tone="blue">{ROLE[r.myRole ?? ""] ?? "—"}</Badge></td>
                    <td>{r.isActive ? <Badge tone="green">Hoạt động</Badge> : <Badge tone="red">Ngừng hoạt động</Badge>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild><Link href={`/companies/${r.id}`}><Users /> Thành viên</Link></Button>
                        {admin && <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil /> Sửa</Button>}
                        {isSystemAdmin && <Button size="sm" variant="ghost" onClick={() => toggle(r)} className={r.isActive ? "text-red-600" : "text-emerald-600"}><Power /> {r.isActive ? "Ngừng" : "Kích hoạt"}</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {creating && <CompanyFormDialog open onOpenChange={setCreating} canChangeTaxCode />}
      {editing && <CompanyFormDialog open onOpenChange={(o) => !o && setEditing(null)} initial={editing} canChangeTaxCode={isSystemAdmin} />}
    </>
  );
}
