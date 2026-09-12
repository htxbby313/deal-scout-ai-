type IntegrationEnvironment = Record<string, string | undefined>;

function firstConfigured(environment: IntegrationEnvironment, names: readonly string[]) {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function firstProviderPrefixed(environment: IntegrationEnvironment, suffix: string) {
  const name = Object.keys(environment)
    .filter((candidate) => candidate.endsWith(`_${suffix}`) && !candidate.startsWith("NEXT_PUBLIC_"))
    .sort()[0];
  return name ? environment[name]?.trim() || undefined : undefined;
}

export const databaseEnvironmentNames = {
  runtime: [
    "NEON_POSTGRES_PRISMA_URL",
    "NEON_DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "DATABASE_URL",
  ],
  direct: [
    "NEON_POSTGRES_URL_NON_POOLING",
    "NEON_DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL_UNPOOLED",
    "DATABASE_POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
    "DATABASE_URL",
  ],
} as const;

export function resolveIntegrationEnvironment(environment: IntegrationEnvironment = process.env) {
  return {
    database: {
      runtimeUrl: firstConfigured(environment, databaseEnvironmentNames.runtime),
      directUrl: firstConfigured(environment, databaseEnvironmentNames.direct),
    },
    email: {
      apiKey: firstConfigured(environment, ["RESEND_API_KEY", "EMAIL_PROVIDER_API_KEY"]),
      from: firstConfigured(environment, ["RESEND_FROM_EMAIL", "EMAIL_FROM_ADDRESS", "EMAIL_FROM"]),
    },
    sms: {
      accountSid: firstConfigured(environment, ["TWILIO_ACCOUNT_SID"]),
      authToken: firstConfigured(environment, ["TWILIO_AUTH_TOKEN", "SMS_PROVIDER_API_KEY"]),
      from: firstConfigured(environment, ["TWILIO_PHONE_NUMBER", "TWILIO_FROM_NUMBER"]),
    },
    nvidia: {
      apiKey: firstConfigured(environment, ["NVIDIA_API_KEY", "NVIDIA_NIM_API_KEY", "NGC_API_KEY"]),
      model: firstConfigured(environment, ["NVIDIA_REASONING_MODEL"]),
    },
    firecrawl: {
      apiKey: firstConfigured(environment, ["FIRECRAWL_API_KEY", "FIRECRAWL_KEY"])
        || firstProviderPrefixed(environment, "FIRECRAWL_API_KEY"),
    },
    enformion: {
      username: firstConfigured(environment, ["ENFORMION_ACCESS_PROFILE_NAME", "ENFORMION_USERNAME"]),
      password: firstConfigured(environment, ["ENFORMION_ACCESS_PROFILE_PASSWORD", "ENFORMION_PASSWORD"]),
    },
    googleMaps: {
      serverApiKey: firstConfigured(environment, ["GOOGLE_MAPS_SERVER_API_KEY", "GOOGLE_MAPS_API_KEY"]),
    },
    webhookSecret: firstConfigured(environment, ["WEBHOOK_SECRET", "DEAL_SCOUT_WEBHOOK_SECRET"]),
  };
}

export const __integrationEnvTestables = { firstConfigured, firstProviderPrefixed };
