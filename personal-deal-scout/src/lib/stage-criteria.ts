export type StageCriterion = { code: string; description: string; satisfied: boolean; sourceUrl?: string; observedAt?: string };
export function evaluateStageCriteria(input: { entry: readonly StageCriterion[]; exit: readonly StageCriterion[]; requiredEntryCodes?:readonly string[];requiredExitCodes?:readonly string[]; terminal: boolean; approvalEvidence?: unknown; now: Date }) {
  const blockers: string[]=[];
  for(const [kind,criteria] of [["entry",input.entry],["exit",input.exit]] as const){ if(!criteria.length)blockers.push(`${kind}_criteria_missing`); for(const item of criteria){ if(!item.code.trim()||!item.description.trim())blockers.push(`${kind}_criterion_invalid`); if(!item.satisfied)blockers.push(`${kind}_${item.code}_not_satisfied`); if(item.satisfied&&(!item.sourceUrl||!item.observedAt))blockers.push(`${kind}_${item.code}_evidence_missing`); else if(item.observedAt&&(!Number.isFinite(Date.parse(item.observedAt))||new Date(item.observedAt)>input.now))blockers.push(`${kind}_${item.code}_evidence_invalid`); } }
  for(const code of input.requiredEntryCodes??[])if(!input.entry.some(item=>item.code===code))blockers.push(`entry_${code}_missing`);
  for(const code of input.requiredExitCodes??[])if(!input.exit.some(item=>item.code===code))blockers.push(`exit_${code}_missing`);
  if(input.terminal&&!input.approvalEvidence)blockers.push("terminal_owner_approval_evidence_missing");
  return { allowed:blockers.length===0,blockers };
}
