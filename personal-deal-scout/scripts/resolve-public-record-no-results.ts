import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const searchedProperties = await tx.propertyResearchRun.findMany({
      where: {
        status: "NEEDS_MANUAL_VERIFICATION",
        sourcesChecked: { gt: 0 },
      },
      distinct: ["propertyId"],
      select: { propertyId: true },
    });
    const propertyIds = searchedProperties.map(({ propertyId }) => propertyId);

    const findings = propertyIds.length
      ? await tx.propertyResearchFinding.updateMany({
          where: {
            propertyId: { in: propertyIds },
            status: "NEEDS_MANUAL_VERIFICATION",
          },
          data: {
            status: "NOT_FOUND",
            value:
              "No supported public record found in the completed automated search.",
            confidence: 100,
            notes:
              "No evidence found is a completed research result. It does not verify the underlying fact or make the property actionable.",
          },
        })
      : { count: 0 };

    const conflicted = propertyIds.length
      ? await tx.propertyResearchFinding.findMany({
          where: { propertyId: { in: propertyIds }, status: "CONFLICT" },
          distinct: ["propertyId"],
          select: { propertyId: true },
        })
      : [];
    const conflictIds = new Set(conflicted.map(({ propertyId }) => propertyId));
    const completedPropertyIds = propertyIds.filter(
      (propertyId) => !conflictIds.has(propertyId),
    );
    const propertyRuns = completedPropertyIds.length
      ? await tx.propertyResearchRun.updateMany({
          where: {
            propertyId: { in: completedPropertyIds },
            status: "NEEDS_MANUAL_VERIFICATION",
            sourcesChecked: { gt: 0 },
          },
          data: { status: "COMPLETE", manualNeeded: 0 },
        })
      : { count: 0 };

    const developerRuns = await tx.developerResearchRun.updateMany({
      where: {
        status: "NEEDS_MANUAL_VERIFICATION",
        sourcesChecked: { gt: 0 },
      },
      data: { status: "COMPLETE", manualNeeded: 0 },
    });

    await tx.auditLog.create({
      data: {
        type: "research.public_record_resolution",
        summary:
          "Resolved completed public-record searches that returned no evidence.",
        details: {
          findingsMarkedNotFound: findings.count,
          propertyRunsCompleted: propertyRuns.count,
          developerRunsCompleted: developerRuns.count,
          propertiesHeldForConflict: conflictIds.size,
        },
      },
    });

    return {
      findingsMarkedNotFound: findings.count,
      propertyRunsCompleted: propertyRuns.count,
      developerRunsCompleted: developerRuns.count,
      propertiesHeldForConflict: conflictIds.size,
    };
  });

  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Resolution failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
