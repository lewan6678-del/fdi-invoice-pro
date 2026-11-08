import { route, readJson } from "@/server/http";
import { updateUser } from "@/server/services/users";

export const PATCH = route<{ id: string }>(async (req, actor, { id }) => ({ user: await updateUser(actor, id, await readJson(req)) }));
