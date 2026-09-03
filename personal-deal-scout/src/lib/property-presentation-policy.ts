type CurrentGate = {
  type: "CONTRACT" | "DISPOSITION" | string;
  version: number;
  status: "SATISFIED" | "WAIVED" | string;
  expiresAt?: Date | null;
};

type PresentationTransaction = {
  status: string;
  controlStatus: string;
  counselApprovedAt?: Date | null;
  complianceVerifiedAt?: Date | null;
  documents: Array<{
    type: string;
    status: string;
    executedAt?: Date | null;
    contentHash?: string | null;
    storageKey?: string | null;
    sourceUrl?: string | null;
  }>;
  approvals: Array<{
    type: string;
    status: string;
    decidedAt?: Date | null;
    expiresAt?: Date | null;
  }>;
  acquisitionFunnel?: { stage: string; gates: CurrentGate[] } | null;
};

export function evaluatePropertyPresentation(
  transaction: PresentationTransaction | null | undefined,
  now = new Date(),
) {
  const blockers: string[] = [];
  if (!transaction)
    return { allowed: false, blockers: ["contractual_interest_missing"] };
  if (transaction.controlStatus !== "ACTIVE")
    blockers.push("transaction_not_active");
  if (
    ![
      "UNDER_CONTRACT",
      "BUYER_MATCHING",
      "ASSIGNMENT_PENDING",
      "CLOSING_PENDING",
    ].includes(transaction.status)
  )
    blockers.push("transaction_status_not_contracted");
  if (!transaction.counselApprovedAt) blockers.push("counsel_approval_missing");
  if (!transaction.complianceVerifiedAt)
    blockers.push("compliance_verification_missing");
  if (
    !transaction.acquisitionFunnel ||
    !["CONTRACTED", "DISPOSITION_READY"].includes(
      transaction.acquisitionFunnel.stage,
    )
  )
    blockers.push("property_not_contracted");
  const currentGate = (type: string) =>
    transaction.acquisitionFunnel?.gates
      .filter((gate) => gate.type === type)
      .toSorted((a, b) => b.version - a.version)[0];
  for (const type of ["CONTRACT", "DISPOSITION"]) {
    const gate = currentGate(type);
    if (
      !gate ||
      !["SATISFIED", "WAIVED"].includes(gate.status) ||
      (gate.expiresAt && gate.expiresAt <= now)
    )
      blockers.push(`${type.toLowerCase()}_gate_missing`);
  }
  const executedPurchaseAgreement = transaction.documents.some(
    (document) =>
      document.status === "EXECUTED" &&
      Boolean(document.executedAt) &&
      Boolean(document.contentHash) &&
      Boolean(document.storageKey || document.sourceUrl) &&
      /(purchase|acquisition).*(agreement|contract)|(agreement|contract).*(purchase|acquisition)/i.test(
        document.type,
      ),
  );
  if (!executedPurchaseAgreement)
    blockers.push("executed_purchase_agreement_missing");
  const marketingApproval = transaction.approvals
    .filter((approval) => approval.type === "ASSIGNMENT_MARKETING")
    .toSorted(
      (a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0),
    )[0];
  if (
    !marketingApproval ||
    marketingApproval.status !== "APPROVED" ||
    (marketingApproval.expiresAt && marketingApproval.expiresAt <= now)
  )
    blockers.push("assignment_marketing_approval_missing");
  return { allowed: blockers.length === 0, blockers };
}

const GATE_COPY: Record<string, string> = {
  contractual_interest_missing: "No contract on this deal yet",
  transaction_not_active: "Transaction is not active",
  transaction_status_not_contracted: "Not under contract",
  counsel_approval_missing: "Counsel has not approved",
  compliance_verification_missing: "Compliance has not verified",
  property_not_contracted: "Pipeline is not at Contract / Disposition",
  contract_gate_missing: "Contract gate is not satisfied",
  disposition_gate_missing: "Disposition gate is not satisfied",
  executed_purchase_agreement_missing: "Executed purchase agreement is missing",
  assignment_marketing_approval_missing: "Assignment marketing is not approved",
};

export function presentationGateLine(blockers: readonly string[]) {
  if (!blockers.length) return "Shoppable — contract controls allow buyer presentation.";
  const first = GATE_COPY[blockers[0]] ?? blockers[0].replaceAll("_", " ");
  return `Not shoppable — ${first}.`;
}
