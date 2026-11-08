import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "./auth/session";

export async function audit(
  actor: Actor | null,
  action: string,
  opts: { companyId?: string | null; entityType?: string; entityId?: string; detail?: Prisma.InputJsonValue } = {},
) {
  await prisma.auditLog.create({
    data: {
      action,
      userId: actor?.id,
      userEmail: actor?.email,
      companyId: opts.companyId ?? null,
      entityType: opts.entityType,
      entityId: opts.entityId,
      detail: opts.detail,
    },
  });
}
