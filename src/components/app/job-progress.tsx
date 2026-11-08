"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lightbulb } from "lucide-react";
import { api } from "@/lib/api-client";
import { ItemStatusBadge, JobStatusBadge } from "./status";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";

export interface JobItem {
  id: string;
  fileName: string;
  archiveName: string | null;
  kind: string;
  status: string;
  errorCode: string | null;
  message: string | null;
  hint: string | null;
  invoiceId: string | null;
}
export interface Job {
  id: string;
  status: string;
  totalItems: number;
  processedItems: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  items: JobItem[];
}

export function JobProgress({ jobId, companyId, initial }: { jobId: string; companyId: string; initial?: Job }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(initial ?? null);
  const [filter, setFilter] = useState("");
  const done = job?.status === "COMPLETED" || job?.status === "FAILED";

  useEffect(() => {
    if (done) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api<{ job: Job }>(`/api/imports/${jobId}?companyId=${companyId}`);
        if (stop) return;
        setJob(r.job);
        if (r.job.status === "COMPLETED" || r.job.status === "FAILED") router.refresh();
        else setTimeout(tick, 800);
      } catch {
        if (!stop) setTimeout(tick, 2500);
      }
    };
    tick();
    return () => {
      stop = true;
    };
  }, [jobId, companyId, done, router]);

  const items = useMemo(() => (job?.items ?? []).filter((i) => !filter || i.status === filter), [job, filter]);
  if (!job) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</div>;
  const pct = job.totalItems ? Math.round((job.processedItems / job.totalItems) * 100) : 0;

  return (
    <div className="space-y-4" data-testid="job-progress">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <JobStatusBadge status={job.status} />
            {!done && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            Đã xử lý {job.processedItems}/{job.totalItems} file
          </span>
          <span className="tabular-nums font-medium">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge tone="green" data-testid="count-success">Thành công: {job.successCount}</Badge>
          <Badge tone="amber" data-testid="count-duplicate">Trùng: {job.duplicateCount}</Badge>
          <Badge tone="red" data-testid="count-error">Lỗi: {job.errorCount}</Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Kết quả từng file</p>
        <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Lọc kết quả">
          <option value="">Tất cả</option>
          <option value="SUCCESS">Thành công</option>
          <option value="DUPLICATE">Trùng</option>
          <option value="ERROR">Lỗi</option>
          <option value="SKIPPED">Bỏ qua</option>
          <option value="PENDING">Đang chờ</option>
        </Select>
      </div>
      <div className="max-h-[480px] overflow-auto rounded-md border">
        <table className="table-base">
          <thead><tr><th>File</th><th>Loại</th><th>Trạng thái</th><th>Chi tiết / Hướng khắc phục</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} data-status={i.status}>
                <td className="max-w-[280px] break-all">
                  <p className="font-medium">{i.fileName}</p>
                  {i.archiveName && <p className="text-xs text-muted-foreground">trong {i.archiveName}</p>}
                </td>
                <td><Badge>{i.kind}</Badge></td>
                <td><ItemStatusBadge status={i.status} /></td>
                <td className="text-sm">
                  <p>{i.message ?? (i.status === "PENDING" ? "Đang chờ xử lý…" : "")}</p>
                  {i.hint && <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{i.hint}</p>}
                  {i.invoiceId && <a className="mt-1 inline-block text-xs text-primary hover:underline" href={`/invoices?open=${i.invoiceId}`}>Xem hóa đơn →</a>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Không có file nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
