import { route, companyIdFrom } from "@/server/http";
import { getCompanyFile } from "@/server/services/invoices";
import { storage } from "@/server/storage";

/** Phục vụ file riêng tư: chỉ người có quyền tại đúng công ty mới tải được. */
export const GET = route<{ id: string }>(async (req, actor, { id }) => {
  const f = await getCompanyFile(actor, companyIdFrom(req), id);
  const data = await storage().get(f.storageKey);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": f.kind === "XML" ? "text/plain; charset=utf-8" : f.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-File-SHA256": f.sha256,
    },
  });
});
