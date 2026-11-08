import { route, readJson } from "@/server/http";
import { setCompanyActive } from "@/server/services/companies";

export const POST = route<{ id: string }>(async (req, actor, { id }) => {
  const b = await readJson<{ isActive: boolean }>(req);
  return { company: await setCompanyActive(actor, id, !!b.isActive) };
});
