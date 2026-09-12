const { spawnSync } = require("node:child_process");

const hasDatabaseUrl = Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL);

if (hasDatabaseUrl) {
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
    "Skipping Prisma migrations: no DATABASE_URL or DIRECT_URL is available during the build.",
  );
}

const build = spawnSync(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit" },
);

process.exit(build.status ?? 1);
