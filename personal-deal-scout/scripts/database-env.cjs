const runtimeNames = [
  "NEON_POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL",
];

const directNames = [
  "NEON_POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_UNPOOLED",
  "DATABASE_POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
  "DATABASE_URL",
];

function firstConfigured(environment, names) {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

module.exports = {
  runtimeDatabaseUrl: (environment = process.env) => firstConfigured(environment, runtimeNames),
  directDatabaseUrl: (environment = process.env) => firstConfigured(environment, directNames),
};
