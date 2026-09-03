import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OpportunitiesIndexPage() {
  await requireOwner();
  redirect("/properties");
}
