import { createOwnerSession } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const authenticated = await createOwnerSession(username, password);

  return Response.redirect(
    new URL(authenticated ? "/" : "/login?error=invalid", request.url),
    303,
  );
}
