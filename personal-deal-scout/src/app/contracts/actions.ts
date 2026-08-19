"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { registerUserSuppliedContractArtifact } from "@/lib/contract-template-registry";

export type ContractActionState = { status: "idle" | "success" | "error"; message: string };

export async function registerCreativeContractSetAction(_previous: ContractActionState, data: FormData): Promise<ContractActionState> {
  await requireOwner();
  try {
    const jurisdictionState = String(data.get("jurisdictionState") ?? "").trim().toUpperCase();
    const suppliedBy = String(data.get("suppliedBy") ?? "").trim();
    if (!/^[A-Z]{2}$/.test(jurisdictionState)) throw new Error("Enter the two-letter state where the property is located.");
    if (!suppliedBy) throw new Error("Supplier identity is required.");
    const directory = join(process.cwd(), "contracts", "review-pending");
    const [purchase, assignment] = await Promise.all([
      readFile(join(directory, "Assignable_Creative_Financing_Contract.md")),
      readFile(join(directory, "Closing_and_Assignment_Contract.md")),
    ]);
    await registerUserSuppliedContractArtifact({ name: "Assignable Creative Financing Purchase & Sale Agreement", type: "PURCHASE_AGREEMENT", jurisdictionState, content: purchase, storageKey: "contracts/review-pending/Assignable_Creative_Financing_Contract.md", suppliedBy });
    await registerUserSuppliedContractArtifact({ name: "Real Estate Contract Assignment & Closing Agreement", type: "ASSIGNMENT_AGREEMENT", jurisdictionState, content: assignment, storageKey: "contracts/review-pending/Closing_and_Assignment_Contract.md", suppliedBy });
    revalidatePath("/contracts");
    revalidatePath("/owner-queue");
    return { status: "success", message: `Registered both exact user-supplied drafts for ${jurisdictionState}. They remain REVIEW_PENDING.` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The contract set could not be registered." };
  }
}
