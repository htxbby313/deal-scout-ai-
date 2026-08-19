"use server";
import { revalidatePath } from "next/cache";
import type { RetentionCategory, RetentionReviewStatus } from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { createInactiveRetentionPolicy, decideRetentionReview } from "@/lib/data-retention-service";
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
export async function createRetentionPolicyAction(data: FormData) { await requireOwner(); await createInactiveRetentionPolicy({ category: text(data, "category") as RetentionCategory, jurisdictionState: text(data, "jurisdictionState"), retentionDays: Number(text(data, "retentionDays")) }); revalidatePath("/governance"); }
export async function decideRetentionReviewAction(data: FormData) { await requireOwner(); await decideRetentionReview({ reviewId: text(data, "reviewId"), actor: "owner", reason: text(data, "reason"), requestedStatus: text(data, "status") as Exclude<RetentionReviewStatus, "PENDING"> }); revalidatePath("/governance"); }
