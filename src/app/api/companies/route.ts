import { route, readJson } from "@/server/http";
import { createCompany, listCompaniesForActor } from "@/server/services/companies";

export const GET = route(async (req, actor) => ({ companies: await listCompaniesForActor(actor, { includeInactive: true }) }));
export const POST = route(async (req, actor) => ({ company: await createCompany(actor, await readJson(req)) }));
