import { describe, expect, it } from "vitest";
import { createOwnerToken, ownerCredentialsMatch, verifyOwnerToken } from "./owner-auth-token";

const secret = "a-secure-session-secret-that-is-long-enough";
describe("owner authentication boundary", () => {
  it("creates and verifies a signed owner token", () => {
    const token = createOwnerToken("owner", secret);
    expect(verifyOwnerToken(token, "owner", secret)).toBe(true);
    expect(verifyOwnerToken(`${token}x`, "owner", secret)).toBe(false);
    expect(verifyOwnerToken(token, "other", secret)).toBe(false);
  });
  it("fails closed for malformed tokens and short secrets", () => {
    expect(verifyOwnerToken(undefined, "owner", secret)).toBe(false);
    expect(verifyOwnerToken("owner.bad", "owner", secret)).toBe(false);
    expect(() => createOwnerToken("owner", "short")).toThrow();
  });
  it("requires both configured credentials", () => {
    expect(ownerCredentialsMatch({ suppliedUsername: "owner", suppliedPassword: "pass", configuredUsername: "owner", configuredPassword: "pass" })).toBe(true);
    expect(ownerCredentialsMatch({ suppliedUsername: "owner", suppliedPassword: "wrong", configuredUsername: "owner", configuredPassword: "pass" })).toBe(false);
  });
});
