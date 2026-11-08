import { route, companyIdFrom } from "@/server/http";
import { createEmptyJob, createImportJob, listImportJobs, type UploadFile } from "@/server/services/imports";
import { kickJobs } from "@/server/jobs/trigger";
import { Errors } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = route(async (req, actor) => ({ jobs: await listImportJobs(actor, companyIdFrom(req)) }));

/**
 * - Content-Type application/json {}  → tạo lượt nhập rỗng (luồng tải từng phần, dùng trên Vercel).
 * - multipart/form-data "files"       → tải một lần (tối đa 4,5MB tổng trên Vercel).
 */
export const POST = route(async (req, actor) => {
  const companyId = companyIdFrom(req);
  if ((req.headers.get("content-type") ?? "").includes("application/json")) return { job: await createEmptyJob(actor, companyId) };
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw Errors.validation("Không đọc được dữ liệu tải lên.", "Thử tải lại với số lượng file ít hơn hoặc nén thành ZIP.");
  }
  const files: UploadFile[] = [];
  for (const v of form.getAll("files")) {
    if (typeof v === "string") continue;
    files.push({ name: v.name, data: Buffer.from(await v.arrayBuffer()) });
  }
  const job = await createImportJob(actor, companyId, files);
  kickJobs();
  return { job };
});
