import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPANY_NAME,
  ownerPackageByline,
  type OwnerProfile,
} from "./owner-profile";

describe("owner profile byline", () => {
  it("uses company name on Deal Packages when no display name is set", () => {
    const profile: OwnerProfile = {
      displayName: "",
      companyName: DEFAULT_COMPANY_NAME,
      phone: "",
      email: "",
      markets: [],
    };
    expect(ownerPackageByline(profile)).toBe(DEFAULT_COMPANY_NAME);
  });

  it("joins name and company for the Deal Package header", () => {
    expect(
      ownerPackageByline({
        displayName: "Tay",
        companyName: "Coleman & Co. Holdings LLC",
        phone: "555",
        email: "tay@example.com",
        markets: ["Meridian"],
      }),
    ).toBe("Tay · Coleman & Co. Holdings LLC");
  });
});
