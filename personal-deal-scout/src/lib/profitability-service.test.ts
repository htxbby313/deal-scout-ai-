import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { __profitabilityServiceTestables } from "./profitability-service";

describe("financial version concurrency retry", () => {
  it("retries serialization and unique conflicts within the bounded limit", async () => {
    let attempts = 0;
    const result = await __profitabilityServiceTestables.withVersionRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw new Prisma.PrismaClientKnownRequestError("conflict", { code: attempts === 1 ? "P2034" : "P2002", clientVersion: "test" });
      return "created";
    });
    expect(result).toBe("created");
    expect(attempts).toBe(3);
  });
});
