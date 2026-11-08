import { route, readJson } from "@/server/http";
import { changeOwnPassword } from "@/server/services/users";

export const POST = route(async (req, actor) => {
  const b = await readJson<{ current: string; next: string }>(req);
  await changeOwnPassword(actor, String(b.current ?? ""), String(b.next ?? ""));
  return { ok: true };
});
