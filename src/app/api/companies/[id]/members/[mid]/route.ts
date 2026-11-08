import type { MemberRole } from "@prisma/client";
import { route, readJson } from "@/server/http";
import { removeMember, updateMemberRole } from "@/server/services/users";

export const PATCH = route<{ id: string; mid: string }>(async (req, actor, { id, mid }) => {
  const b = await readJson<{ role: MemberRole }>(req);
  return { membership: await updateMemberRole(actor, id, mid, b.role) };
});
export const DELETE = route<{ id: string; mid: string }>(async (req, actor, { id, mid }) => {
  await removeMember(actor, id, mid);
  return { ok: true };
});
