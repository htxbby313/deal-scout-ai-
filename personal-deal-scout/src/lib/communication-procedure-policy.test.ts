import { describe, expect, it } from "vitest";
import { evaluateContactProcedure, permittedLocalTime } from "@/lib/communication-procedure-policy";

describe("communication procedures", () => {
  it("checks local windows without guessing a timezone", () => { expect(permittedLocalTime({ localTime: "10:30", permittedStart: "09:00", permittedEnd: "20:00" })).toBe(true); expect(permittedLocalTime({ localTime: "21:00", permittedStart: "09:00", permittedEnd: "20:00" })).toBe(false); });
  it("requires procedure, disclosure, training, and current scrub", () => expect(evaluateContactProcedure({ procedureStatus: "DRAFT", trainingAcknowledged: false, permittedWindow: false }).allowed).toBe(false));
});
