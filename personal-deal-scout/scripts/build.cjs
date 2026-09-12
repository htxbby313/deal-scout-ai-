const { spawnSync } = require("node:child_process");
const { directDatabaseUrl, runtimeDatabaseUrl } = require("./database-env.cjs");

const hasDatabaseUrl = Boolean(directDatabaseUrl() || runtimeDatabaseUrl());
const isVercelPreview = process.env.VERCEL_ENV === "preview";

if (isVercelPreview) {
  console.log(
    "Skipping Prisma migrations: Vercel preview builds use the PR's Neon branch, which is migrated by CI.",
  );
} else if (hasDatabaseUrl) {
  const migration = spawnSync(
    process.execPath,
    ["--env-file-if-exists=.env", "scripts/prisma-direct.cjs", "migrate", "deploy"],
    { stdio: "inherit" },
  );

  if (migration.status !== 0) {
    process.exit(migration.status ?? 1);
  }
} else {
  console.log(
    "Skipping Prisma migrations: no supported PostgreSQL connection variable is available during the build.",
  );
}

const build = spawnSync(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit" },
);

process.exit(build.status ?? 1);
