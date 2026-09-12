const { spawnSync } = require("node:child_process");

function directDatabaseUrl() {
  const configured = process.env.NEON_POSTGRES_URL_NON_POOLING
    || process.env.NEON_DATABASE_URL_UNPOOLED
    || process.env.DATABASE_POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL_UNPOOLED
    || process.env.DIRECT_URL
    || process.env.DATABASE_URL;
  if (!configured) throw new Error("A direct or pooled database URL is required for Prisma migrations.");
  const url = new URL(configured);
  if (url.hostname.endsWith(".neon.tech")) url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  url.searchParams.delete("pgbouncer");
  return url.toString();
}

const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), ...process.argv.slice(2)], {
  env: { ...process.env, DATABASE_URL: directDatabaseUrl() },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
