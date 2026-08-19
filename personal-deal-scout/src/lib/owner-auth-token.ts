import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  return left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function ownerCredentialsMatch(input: { suppliedUsername: string; suppliedPassword: string; configuredUsername: string; configuredPassword: string }) {
  return safeEqual(input.suppliedUsername, input.configuredUsername) && safeEqual(input.suppliedPassword, input.configuredPassword);
}

export function createOwnerToken(username: string, secret: string) {
  if (secret.length < 32) throw new Error("Session secret must contain at least 32 characters.");
  const signature = createHmac("sha256", secret).update(username).digest("hex");
  return `${username}.${signature}`;
}

export function verifyOwnerToken(token: string | undefined, username: string, secret: string) {
  if (!token || secret.length < 32) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const value = token.slice(0, separator);
  const supplied = token.slice(separator + 1);
  if (!safeEqual(value, username)) return false;
  const expected = createHmac("sha256", secret).update(value).digest("hex");
  return safeEqual(supplied, expected);
}
