import { route, companyIdFrom } from "@/server/http";
import { getImportJob } from "@/server/services/imports";
import { kickJobs } from "@/server/jobs/trigger";

export const GET = route<{ id: string }>(async (req, actor, { id }) => {
  const job = await getImportJob(actor, companyIdFrom(req), id);
  if (job.status === "PENDING") kickJobs();
  return { job };
});
