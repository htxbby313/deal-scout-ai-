import { describe, expect, it } from "vitest";
import { __motivatedSellerDiscoveryTestables } from "@/lib/motivated-seller-discovery";

describe("public motivated seller discovery", () => {
  it("extracts a complete public listing address", () => expect(__motivatedSellerDiscoveryTestables.parsePublicSellerCandidate("FSBO 1200 Main Street, Jackson, MS 39201")).toEqual({ address: "1200 Main Street", city: "Jackson", state: "MS", zipCode: "39201" }));
  it("does not turn HUD or bank inventory into seller leads", () => {
    expect(__motivatedSellerDiscoveryTestables.parsePublicSellerCandidate("HUD 1200 Main Street, Jackson, MS 39201")).toBeNull();
    expect(__motivatedSellerDiscoveryTestables.parsePublicSellerCandidate("Bank owned REO 1200 Main Street, Jackson, MS 39201")).toBeNull();
  });
  it("holds incomplete results for review", () => expect(__motivatedSellerDiscoveryTestables.parsePublicSellerCandidate("FSBO somewhere in Jackson")).toBeNull());
});
