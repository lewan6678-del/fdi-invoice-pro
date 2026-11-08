import Link from "next/link";
import { getWorkspace } from "@/server/auth/current";
import { listImportJobs } from "@/server/services/imports";
import { canEdit } from "@/server/auth/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/card";
import { NoCompany } from "@/components/app/no-company";
import { Uploader } from "@/components/app/uploader";
import { JobStatusBadge } from "@/components/app/status";
import { fmtDateTime } from "@/lib/period";
import { prisma } from "@/lib/db";

export default async function ImportsPage() {
  const ws = await getWorkspace();
  if (!ws.company) return <NoCompany isSystemAdmin={ws.actor.isSystemAdmin} />;
  const jobs = await listImportJobs(ws.actor, ws.company.id);
  const users = await prisma.user.findMany({ where: { id: { in: jobs.map((j) => j.createdById!).filter(Boolean) } }, select: { id: true, name: true } });
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? "";
  const disabled = !ws.company.isActive ? "Công ty đang ngừng hoạt động – không thể nhập hóa đơn." : !canEdit(ws.company.myRole ?? null) ? "Bạn chỉ có quyền xem (Viewer), không thể nhập hóa đơn." : undefined;
  return (
    <div>
      <PageHeader title="Nhập hóa đơn" description="Tải lên nhiều file XML/PDF/ZIP. Hệ thống tự nhận diện XML hóa đơn, chống trùng, lưu XML gốc bất biến và ghép PDF cùng tên." />
      <Card>
        <CardContent className="p-5"><Uploader companyId={ws.company.id} companyName={`${ws.company.taxCode} – ${ws.company.name}`} disabledReason={disabled} /></CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Lịch sử nhập của công ty</CardTitle>
          <CardDescription>50 lượt gần nhất</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="table-base" data-testid="import-history">
            <thead><tr><th>Thời gian</th><th>Người nhập</th><th>Trạng thái</th><th className="num">Tổng file</th><th className="num">Thành công</th><th className="num">Trùng</th><th className="num">Lỗi</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{fmtDateTime(j.createdAt)}</td>
                  <td>{name(j.createdById)}</td>
                  <td><JobStatusBadge status={j.status} /></td>
                  <td className="num">{j.totalItems}</td>
                  <td className="num text-emerald-600">{j.successCount}</td>
                  <td className="num text-amber-600">{j.duplicateCount}</td>
                  <td className="num text-red-600">{j.errorCount}</td>
                  <td className="text-right"><Link className="text-primary hover:underline" href={`/imports/${j.id}`}>Xem báo cáo</Link></td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có lượt nhập nào.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
