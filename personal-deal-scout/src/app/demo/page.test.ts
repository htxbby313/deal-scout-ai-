import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("./demo-workflow.tsx", import.meta.url), "utf8");

describe("safe demo isolation", () => {
  it("is explicitly fictional, read-only, and offers no mutation forms", () => {
    expect(source).toContain("Fictional, read-only, and isolated from your records");
    expect(source).toContain("No production data was read or changed on this page");
    expect(source).not.toContain("<form");
    expect(source).not.toContain("action=");
    expect(workflow).not.toContain("action=");
    expect(workflow).not.toContain("@/app/actions");
  });

  it("keeps an exit control and the complete guided path", () => {
    expect(source).toContain('href="/owner-queue"');
    for (const id of ["today", "lead", "analysis", "buyers", "profit"]) {
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("covers intake, search, follow-up, and stage movement in local state", () => {
    for (const label of ["Add fictional lead", "Find a lead", "Record demo follow-up", "Move to Contacting"]) {
      expect(workflow).toContain(label);
    }
    expect(workflow).toContain("useState");
  });
});
