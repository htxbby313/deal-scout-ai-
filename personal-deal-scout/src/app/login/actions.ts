"use server";

import { redirect } from "next/navigation";
import { createOwnerSession } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const ok = await createOwnerSession(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""));
  if (!ok) redirect("/login?error=invalid");
  redirect("/");
}
