import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOwnerToken, ownerCredentialsMatch, verifyOwnerToken } from "@/lib/owner-auth-token";

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

export async function ownerIsAuthenticated() {
  try {
    const { username, secret } = configured();
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return false;
    return verifyOwnerToken(token, username, secret);
  } catch {
    return false;
  }
}

export async function requireOwner() {
  if (!(await ownerIsAuthenticated())) redirect("/login");
}

export async function createOwnerSession(username: string, password: string) {
  const config = configured();
  if (!ownerCredentialsMatch({ suppliedUsername: username, suppliedPassword: password, configuredUsername: config.username, configuredPassword: config.password })) return false;
  (await cookies()).set(COOKIE_NAME, createOwnerToken(config.username, config.secret), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12,
  });
  return true;
}
