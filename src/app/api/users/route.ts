import { route, readJson } from "@/server/http";
import { createUser, listUsers } from "@/server/services/users";

export const GET = route(async (req, actor) => ({ users: await listUsers(actor) }));
export const POST = route(async (req, actor) => ({ user: await createUser(actor, await readJson(req)) }));
