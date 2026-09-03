const notFound = () =>
  Response.json({ error: "Not found" }, { status: 404 });

export function GET() {
  return notFound();
}

export function HEAD() {
  return notFound();
}
