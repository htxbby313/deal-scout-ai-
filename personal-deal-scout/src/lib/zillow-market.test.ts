import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approvedZillowDatasetManifest, parseApprovedZillowCsv } from "@/lib/zillow-market";

describe("approved Zillow aggregate research manifest", () => {
  it("contains exactly the six reviewed disabled Metro datasets", () => {
    expect(approvedZillowDatasetManifest).toHaveLength(6);
    expect(approvedZillowDatasetManifest.every((item) => item.enabled === false && item.geography === "Metro" && item.directUrl.startsWith("https://files.zillowstatic.com/research/public_csvs/"))).toBe(true);
  });

  for (const dataset of approvedZillowDatasetManifest) {
    it(`parses and hash-verifies the reviewed ${dataset.key} fixture`, () => {
      const body = readFileSync(join(process.cwd(), "src/lib/fixtures/zillow", dataset.fixture), "utf8");
      const result = parseApprovedZillowCsv({ datasetKey: dataset.key, sourceUrl: dataset.directUrl, contentType: "text/csv; charset=utf-8", body });
      expect(result.contentHash).toBe(dataset.fixtureHash);
      expect(result.rowCount).toBe(2);
      expect(result.observations).toHaveLength(4);
    });
  }

  it.each([
    { contentType: "text/html", body: "<html>error</html>", message: "not CSV" },
    { contentType: "text/csv", body: "Wrong,Columns\n1,2", message: "missing required" },
    { contentType: "text/csv", body: "RegionID,RegionName,RegionType,2026-07-31\n1,A,msa,nope", message: "Invalid numeric" },
  ])("quarantines unexpected responses", ({ contentType, body, message }) => {
    const dataset = approvedZillowDatasetManifest[0];
    expect(() => parseApprovedZillowCsv({ datasetKey: dataset.key, sourceUrl: dataset.directUrl, contentType, body })).toThrow(message);
  });

  it("rejects URL substitution even under the official host", () => {
    const dataset = approvedZillowDatasetManifest[0];
    expect(() => parseApprovedZillowCsv({ datasetKey: dataset.key, sourceUrl: `${dataset.directUrl}.other`, contentType: "text/csv", body: "x" })).toThrow("approved manifest");
  });
});
