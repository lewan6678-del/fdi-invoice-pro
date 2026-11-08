import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, validateSessionToken, type Actor } from "./session";
import { listCompaniesForActor } from "../services/companies";
import { parsePeriod, periodToString } from "@/lib/period";

export const COMPANY_COOKIE = "fdi_company";
export const PERIOD_COOKIE = "fdi_period";

export const getActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  return validateSessionToken(jar.get(SESSION_COOKIE)?.value);
});

export async function requireActor(): Promise<Actor> {
  const a = await getActor();
  if (!a) redirect("/login");
  return a;
}

/** Ngữ cảnh làm việc: người dùng, công ty đang chọn, kỳ kế toán đang chọn. */
export const getWorkspace = cache(async () => {
  const actor = await requireActor();
  const jar = await cookies();
  const companies = await listCompaniesForActor(actor, { includeInactive: true });
  const wanted = jar.get(COMPANY_COOKIE)?.value;
  const company = companies.find((c) => c.id === wanted) ?? companies.find((c) => c.isActive) ?? companies[0] ?? null;
  const p = parsePeriod(jar.get(PERIOD_COOKIE)?.value) ?? parsePeriod(String(new Date().getFullYear()))!;
  return { actor, companies, company, period: periodToString(p), periodObj: p };
});
