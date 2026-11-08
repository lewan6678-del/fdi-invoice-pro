import { route, companyIdFrom } from "@/server/http";
import { getInvoice } from "@/server/services/invoices";

export const GET = route<{ id: string }>(async (req, actor, { id }) => ({ invoice: await getInvoice(actor, companyIdFrom(req), id) }));
