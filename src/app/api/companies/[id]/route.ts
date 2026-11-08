import { route, readJson } from "@/server/http";
import { getCompany, updateCompany } from "@/server/services/companies";

export const GET = route<{ id: string }>(async (req, actor, { id }) => ({ company: await getCompany(actor, id) }));
export const PATCH = route<{ id: string }>(async (req, actor, { id }) => ({ company: await updateCompany(actor, id, await readJson(req)) }));
