import Link from "next/link";
import { getWorkspace } from "@/server/auth/current";
import { requireCompanyRole } from "@/server/auth/rbac";
import { prisma } from "@/lib/db";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui/card";
import { NoCompany } from "@/components/app/no-company";
import { fmtDate } from "@/lib/period";
import { fmtMoney } from "@/lib/money";
import { NATURE_LABEL, InvoiceStatusBadge } from "@/components/app/status";
import { GitCompareArrows } from "lucide-react";

export default async function RelationsPage() {
  const ws = await getWorkspace();
  if (!ws.company) return <NoCompany isSystemAdmin={ws.actor.isSystemAdmin} />;
  await requireCompanyRole(ws.actor, ws.company.id, "VIEWER");
  const rows = await prisma.invoice.findMany({
    where: { companyId: ws.company.id, nature: { not: "ORIGINAL" } },
    orderBy: { issueDate: "desc" },
    take: 500,
    include: { relatedInvoice: { select: { id: true, templateCode: true, series: true, number: true, issueDate: true, status: true, totalPayment: true } } },
  });
  return (
    <div>
      <PageHeader title="Hóa đơn điều chỉnh / thay thế" description="Quan hệ giữa hóa đơn thay thế/điều chỉnh và hóa đơn gốc được tự động liên kết khi nhập XML (kể cả khi nhập hóa đơn gốc sau)." />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<GitCompareArrows className="h-6 w-6" />} title="Chưa có hóa đơn điều chỉnh/thay thế" description="Khi nhập XML có thông tin TTHDLQuan, hệ thống sẽ hiển thị tại đây." />
        ) : (
          <table className="table-base">
            <thead><tr><th>Hóa đơn</th><th>Tính chất</th><th>Ngày lập</th><th className="num">Tổng TT</th><th>Hóa đơn gốc</th><th>Trạng thái gốc</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link className="font-medium text-primary hover:underline" href={`/invoices?open=${r.id}`}>{r.templateCode}{r.series} – {r.number}</Link></td>
                  <td><Badge tone="violet">{NATURE_LABEL[r.nature]}</Badge></td>
                  <td>{fmtDate(r.issueDate)}</td>
                  <td className="num">{fmtMoney(r.totalPayment)}</td>
                  <td>{r.relatedInvoice ? <Link className="text-primary hover:underline" href={`/invoices?open=${r.relatedInvoice.id}`}>{r.relatedInvoice.templateCode}{r.relatedInvoice.series} – {r.relatedInvoice.number} ({fmtDate(r.relatedInvoice.issueDate)})</Link> : <span className="text-amber-700 dark:text-amber-300">{r.relatedTemplateCode}{r.relatedSeries} – {r.relatedNumber} · chưa nhập HĐ gốc</span>}</td>
                  <td>{r.relatedInvoice ? <InvoiceStatusBadge s={r.relatedInvoice.status} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
