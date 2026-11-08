import type { MemberRole } from "@prisma/client";
import { route, readJson } from "@/server/http";
import { addMember, createUser, listMembers } from "@/server/services/users";

export const GET = route<{ id: string }>(async (req, actor, { id }) => ({ members: await listMembers(actor, id) }));

/** mode=existing: gán tài khoản có sẵn; mode=new: tạo tài khoản mới và gán vào công ty. */
export const POST = route<{ id: string }>(async (req, actor, { id }) => {
  const b = await readJson<{ mode: "existing" | "new"; email: string; name?: string; password?: string; role: MemberRole }>(req);
  if (b.mode === "new") return { user: await createUser(actor, { email: b.email, name: b.name, password: b.password }, { companyId: id, role: b.role }) };
  return { membership: await addMember(actor, id, b.email, b.role) };
});
