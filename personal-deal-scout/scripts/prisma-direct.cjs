const { spawnSync } = require("node:child_process");
const { directDatabaseUrl: configuredDirectDatabaseUrl } = require("./database-env.cjs");

function directDatabaseUrl() {
  const configured = configuredDirectDatabaseUrl();
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
