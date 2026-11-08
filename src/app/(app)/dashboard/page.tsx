import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, FileText, UploadCloud, Receipt } from "lucide-react";
import { getWorkspace } from "@/server/auth/current";
import { getDashboard } from "@/server/services/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader, Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NoCompany } from "@/components/app/no-company";
import { fmtMoney } from "@/lib/money";
import { fmtDateTime, periodLabel } from "@/lib/period";
import { JobStatusBadge } from "@/components/app/status";

export default async function DashboardPage() {
  const ws = await getWorkspace();
  if (!ws.company) return <NoCompany isSystemAdmin={ws.actor.isSystemAdmin} />;
  const d = await getDashboard(ws.actor, ws.company.id, ws.period);
  const label = periodLabel(ws.periodObj);
  const max = Math.max(1, ...d.monthly.map((m) => Number(m.base)));
  const months = Array.from({ length: 12 }, (_, i) => ({
    m: i + 1,
    sale: Number(d.monthly.find((x) => x.month === i + 1 && x.direction === "SALE")?.base ?? 0),
    purchase: Number(d.monthly.find((x) => x.month === i + 1 && x.direction === "PURCHASE")?.base ?? 0),
  }));
  const vatPayable = Number(d.sale.tax) - Number(d.purchase.tax);

  const Kpi = ({ title, value, sub, icon: Icon, tone }: { title: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; tone: string }) => (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description={`${ws.company.name} – MST ${ws.company.taxCode} · ${label}`}
        actions={
          <>
            <Button variant="outline" asChild><Link href="/invoices"><FileText /> Xem hóa đơn</Link></Button>
            <Button asChild><Link href="/imports"><UploadCloud /> Nhập hóa đơn</Link></Button>
          </>
        }
      />
      {d.totalAll === 0 && (
        <Card className="mb-6">
          <EmptyState icon={<UploadCloud className="h-6 w-6" />} title="Công ty chưa có hóa đơn nào" description="Kéo thả file XML, PDF hoặc ZIP hóa đơn điện tử để hệ thống tự động đọc và lưu trữ." action={<Button asChild><Link href="/imports">Nhập hóa đơn ngay</Link></Button>} />
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Hóa đơn bán ra" value={String(d.sale.count)} sub={`Doanh thu chưa thuế: ${fmtMoney(d.sale.base)} ₫`} icon={ArrowUpRight} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
        <Kpi title="Hóa đơn mua vào" value={String(d.purchase.count)} sub={`Giá trị chưa thuế: ${fmtMoney(d.purchase.base)} ₫`} icon={ArrowDownLeft} tone="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" />
        <Kpi title="Thuế GTGT đầu ra − đầu vào" value={`${fmtMoney(vatPayable)} ₫`} sub={`Đầu ra ${fmtMoney(d.sale.tax)} · Đầu vào ${fmtMoney(d.purchase.tax)} (ước tính, chưa phải số tờ khai)`} icon={Receipt} tone="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" />
        <Kpi title="File nhập lỗi (tất cả kỳ)" value={String(d.errorItems)} sub={`HĐ thay thế: ${d.natures.REPLACEMENT ?? 0} · điều chỉnh: ${d.natures.ADJUSTMENT ?? 0}`} icon={AlertTriangle} tone="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Giá trị chưa thuế theo tháng – năm {d.year}</CardTitle>
            <CardDescription className="flex gap-4">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Bán ra</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Mua vào</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-2">
              {months.map((m) => (
                <div key={m.m} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-48 w-full items-end justify-center gap-0.5">
                    <div className="w-1/2 max-w-4 rounded-t bg-emerald-500" style={{ height: `${(m.sale / max) * 100}%` }} title={`Bán ra T${m.m}: ${fmtMoney(m.sale)} ₫`} />
                    <div className="w-1/2 max-w-4 rounded-t bg-blue-500" style={{ height: `${(m.purchase / max) * 100}%` }} title={`Mua vào T${m.m}: ${fmtMoney(m.purchase)} ₫`} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">T{m.m}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tổng hợp theo thuế suất</CardTitle>
            <CardDescription>{label} – mua vào & bán ra</CardDescription>
          </CardHeader>
          <CardContent>
            {d.taxRates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu trong kỳ.</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Thuế suất</th><th className="num">Chưa thuế</th><th className="num">Thuế</th></tr></thead>
                <tbody>
                  {d.taxRates.map((t) => (
                    <tr key={t.taxRate}><td><Badge tone="blue">{t.taxRate}</Badge></td><td className="num">{fmtMoney(t.base)}</td><td className="num">{fmtMoney(t.tax)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Lượt nhập gần đây</CardTitle>
            <CardDescription>Lịch sử nhập hóa đơn của công ty</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild><Link href="/imports">Xem tất cả</Link></Button>
        </CardHeader>
        <CardContent className="p-0">
          {d.recentJobs.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted-foreground">Chưa có lượt nhập nào.</p>
          ) : (
            <table className="table-base">
              <thead><tr><th>Thời gian</th><th>Trạng thái</th><th className="num">Tổng file</th><th className="num">Thành công</th><th className="num">Trùng</th><th className="num">Lỗi</th><th></th></tr></thead>
              <tbody>
                {d.recentJobs.map((j) => (
                  <tr key={j.id}>
                    <td>{fmtDateTime(j.createdAt)}</td>
                    <td><JobStatusBadge status={j.status} /></td>
                    <td className="num">{j.totalItems}</td>
                    <td className="num text-emerald-600">{j.successCount}</td>
                    <td className="num text-amber-600">{j.duplicateCount}</td>
                    <td className="num text-red-600">{j.errorCount}</td>
                    <td className="text-right"><Link className="text-primary hover:underline" href={`/imports/${j.id}`}>Chi tiết</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
