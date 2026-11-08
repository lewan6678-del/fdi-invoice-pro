import { route, companyIdFrom } from "@/server/http";
import { attachPdf } from "@/server/services/imports";
import { Errors } from "@/lib/errors";

export const POST = route<{ id: string }>(async (req, actor, { id }) => {
  const form = await req.formData();
  const f = form.get("file");
  if (!f || typeof f === "string") throw Errors.validation("Chưa chọn file PDF.");
  const stored = await attachPdf(actor, companyIdFrom(req), id, { name: f.name, data: Buffer.from(await f.arrayBuffer()) });
  return { file: { id: stored.id } };
});
