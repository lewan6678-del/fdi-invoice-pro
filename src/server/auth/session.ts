import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "fdi_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 giờ

export interface Actor {
  id: string;
  email: string;
  name: string;
  isSystemAdmin: boolean;
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string | undefined | null): Promise<Actor | null> {
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!s) return null;
  if (s.expiresAt.getTime() < Date.now() || !s.user.isActive) {
    await prisma.session.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  // gia hạn trượt khi còn < 1/2 thời gian
  if (s.expiresAt.getTime() - Date.now() < SESSION_TTL_MS / 2) {
    await prisma.session.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  }
  const u = s.user;
  return { id: u.id, email: u.email, name: u.name, isSystemAdmin: u.isSystemAdmin };
}

export async function deleteSessionToken(token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
