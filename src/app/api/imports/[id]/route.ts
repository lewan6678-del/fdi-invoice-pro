import { route, companyIdFrom } from "@/server/http";
import { getImportJob } from "@/server/services/imports";
import { kickJobs } from "@/server/jobs/trigger";

export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = route<{ id: string }>(async (req, actor, { id }) => {
  const job = await getImportJob(actor, companyIdFrom(req), id);
  // Tự phục hồi: job chờ, hoặc đang xử lý nhưng mất tín hiệu > 2 phút (hàm serverless bị dừng)
  const stale = job.status === "PROCESSING" && (!job.heartbeatAt || Date.now() - job.heartbeatAt.getTime() > 120_000);
  if (job.status === "PENDING" || stale) kickJobs();
  return { job };
});
