import type { InvoiceDirection, InvoiceNature } from "@prisma/client";
import { route, companyIdFrom } from "@/server/http";
import { listInvoices } from "@/server/services/invoices";

export const GET = route(async (req, actor) => {
  const sp = req.nextUrl.searchParams;
  return listInvoices(actor, companyIdFrom(req), {
    period: sp.get("period"),
    direction: (sp.get("direction") as InvoiceDirection) || null,
    nature: (sp.get("nature") as InvoiceNature) || null,
    q: sp.get("q"),
    page: Number(sp.get("page") ?? 1),
    pageSize: Number(sp.get("pageSize") ?? 50),
  });
});
