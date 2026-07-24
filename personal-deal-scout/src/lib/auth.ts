import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "deal_scout_owner";

function configured() {
  const username = process.env.OWNER_USERNAME;
  const password = process.env.OWNER_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!username || !password || !secret || secret.length < 32) {
    throw new Error("Owner authentication is not configured securely.");
  }
  return { username, password, secret };
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function ownerIsAuthenticated() {
  try {
    const { username, secret } = configured();
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return false;
    const [value, supplied] = token.split(".");
    if (value !== username || !supplied) return false;
    const expected = signature(value, secret);
    return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function requireOwner() {
  if (!(await ownerIsAuthenticated())) redirect("/login");
}

export async function createOwnerSession(username: string, password: string) {
  const config = configured();
  const usernameOk = username.length === config.username.length && timingSafeEqual(Buffer.from(username), Buffer.from(config.username));
  const passwordOk = password.length === config.password.length && timingSafeEqual(Buffer.from(password), Buffer.from(config.password));
  if (!usernameOk || !passwordOk) return false;
  (await cookies()).set(COOKIE_NAME, `${config.username}.${signature(config.username, config.secret)}`, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12,
  });
  return true;
}
