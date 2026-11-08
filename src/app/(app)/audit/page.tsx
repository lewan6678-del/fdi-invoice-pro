import { getWorkspace } from "@/server/auth/current";
import { listAuditLogs } from "@/server/services/dashboard";
import { canAdmin } from "@/server/auth/rbac";
import { Card, PageHeader, Badge } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { NoCompany } from "@/components/app/no-company";
import { fmtDateTime } from "@/lib/period";

const ACTION: Record<string, string> = {
  "company.create": "Tạo công ty", "company.update": "Sửa công ty", "company.activate": "Kích hoạt công ty", "company.deactivate": "Ngừng hoạt động công ty",
  "user.create": "Tạo tài khoản", "member.upsert": "Thêm/cập nhật thành viên", "member.role": "Đổi vai trò", "member.remove": "Xóa thành viên",
  "import.create": "Nhập hóa đơn", "invoice.export_xlsx": "Xuất Excel", "invoice.attach_pdf": "Đính kèm PDF",
};

export default async function AuditPage() {
  const ws = await getWorkspace();
  if (!ws.company) return <NoCompany isSystemAdmin={ws.actor.isSystemAdmin} />;
  if (!canAdmin(ws.company.myRole ?? null)) return <Alert title="Chỉ Quản trị công ty được xem nhật ký hệ thống." />;
  const logs = await listAuditLogs(ws.actor, ws.company.id);
  return (
    <div>
      <PageHeader title="Nhật ký hệ thống (Audit log)" description={`Mọi thao tác thay đổi dữ liệu của ${ws.company.name} – 200 bản ghi gần nhất. Nhật ký chỉ ghi thêm, không sửa/xóa.`} />
      <Card className="overflow-hidden">
        <table className="table-base">
          <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                <td>{l.userEmail ?? "hệ thống"}</td>
                <td><Badge tone="blue">{ACTION[l.action] ?? l.action}</Badge></td>
                <td className="max-w-[480px] truncate font-mono text-xs text-muted-foreground">{l.detail ? JSON.stringify(l.detail) : ""}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Chưa có nhật ký.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
