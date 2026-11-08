import type { InvoiceDirection } from "@prisma/client";
import { route, companyIdFrom } from "@/server/http";
import { exportInvoicesXlsx } from "@/server/services/export";

export const runtime = "nodejs";
export const GET = route(async (req, actor) => {
  const sp = req.nextUrl.searchParams;
  const { buffer, fileName } = await exportInvoicesXlsx(actor, companyIdFrom(req), {
    period: sp.get("period"),
    direction: (sp.get("direction") as InvoiceDirection) || null,
    q: sp.get("q"),
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});
