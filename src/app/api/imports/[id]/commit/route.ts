import { route, companyIdFrom } from "@/server/http";
import { commitJob } from "@/server/services/imports";
import { kickJobs } from "@/server/jobs/trigger";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = route<{ id: string }>(async (req, actor, { id }) => {
  const job = await commitJob(actor, companyIdFrom(req), id);
  kickJobs();
  return { job };
});
