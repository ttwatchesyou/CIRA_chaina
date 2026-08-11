import { createHash, randomBytes } from "node:crypto";

import { compare } from "bcryptjs";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/types/auth";

export const SESSION_COOKIE_NAME = "iv_session";
export const SINGLE_WORKSPACE_USER_ID = "account_mo";
const SESSION_LIFETIME_DAYS = 7;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function serializeUser(user: { id: string; username: string | null; name: string | null }): AuthUser | null {
  if (!user.username) return null;
  return { id: user.id, username: user.username, name: user.name || user.username };
}

export async function authenticateCredentials(username: string, password: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true, passwordHash: true },
  });
  if (!user?.passwordHash || !(await compare(password, user.passwordHash))) return null;
  return serializeUser(user);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function currentUser(): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: SINGLE_WORKSPACE_USER_ID },
    select: { id: true, username: true, name: true },
  });
  return user ? serializeUser(user) : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("ไม่พบ Account สำหรับพื้นที่ทำงานส่วนกลาง กรุณารัน yarn db:deploy");
  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  cookieStore.set(SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", expires: new Date(0) });
}
