import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getWorkspace } from "@/server/auth/current";
import { getImportJob } from "@/server/services/imports";
import { Card, CardContent, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NoCompany } from "@/components/app/no-company";
import { JobProgress, type Job } from "@/components/app/job-progress";
import { fmtDateTime } from "@/lib/period";

export default async function ImportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.company) return <NoCompany isSystemAdmin={ws.actor.isSystemAdmin} />;
  const job = await getImportJob(ws.actor, ws.company.id, id);
  return (
    <div>
      <PageHeader title="Báo cáo lượt nhập" description={`Bắt đầu lúc ${fmtDateTime(job.createdAt)}${job.finishedAt ? ` · hoàn tất ${fmtDateTime(job.finishedAt)}` : ""}`} actions={<Button variant="outline" asChild><Link href="/imports"><ArrowLeft /> Quay lại</Link></Button>} />
      <Card><CardContent className="p-5"><JobProgress jobId={job.id} companyId={ws.company.id} initial={JSON.parse(JSON.stringify(job)) as Job} /></CardContent></Card>
    </div>
  );
}
