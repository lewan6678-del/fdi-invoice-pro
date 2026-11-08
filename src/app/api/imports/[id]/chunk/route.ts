import { route, companyIdFrom } from "@/server/http";
import { addChunk } from "@/server/services/imports";

export const runtime = "nodejs";

/** Nhận một phần file (body nhị phân ≤ 3MB). Query: uploadId, index, total, name. */
export const POST = route<{ id: string }>(async (req, actor, { id }) => {
  const sp = req.nextUrl.searchParams;
  const data = Buffer.from(await req.arrayBuffer());
  return addChunk(actor, companyIdFrom(req), id, {
    uploadId: sp.get("uploadId") ?? "",
    index: Number(sp.get("index")),
    total: Number(sp.get("total")),
    fileName: sp.get("name") ?? "file",
    data,
  });
});
