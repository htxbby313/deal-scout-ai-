type Moment = Date | string;
const time = (value: Moment) => new Date(value).getTime();
const hours = (from: Moment, to: Moment) => Math.round(((time(to) - time(from)) / 3_600_000) * 10) / 10;
const summary = (values: number[]) => { const sorted = [...values].filter(Number.isFinite).sort((a,b)=>a-b); const average = sorted.length ? Math.round((sorted.reduce((a,b)=>a+b,0)/sorted.length)*10)/10 : null; const middle=Math.floor(sorted.length/2); const median=!sorted.length?null:sorted.length%2?sorted[middle]:Math.round(((sorted[middle-1]+sorted[middle])/2)*10)/10; return { average, median, sampleSize: sorted.length }; };

export function buildTimingKpis(funnels: readonly { createdAt: Moment; stageHistory: readonly { toStage: string; occurredAt: Moment }[] }[]) {
  const durations: Record<string, number[]> = { discovery_to_contact: [], discovery_to_contract: [], contract_to_close: [] };
  const byStage:Record<string,number[]>={};
  for (const funnel of funnels) {
    const ordered=[...funnel.stageHistory].sort((a,b)=>time(a.occurredAt)-time(b.occurredAt));for(let index=0;index<ordered.length-1;index+=1){(byStage[ordered[index].toStage]??=[]).push(hours(ordered[index].occurredAt,ordered[index+1].occurredAt));}
    const first = (stage: string) => [...funnel.stageHistory].filter((item)=>item.toStage===stage).sort((a,b)=>time(a.occurredAt)-time(b.occurredAt))[0]?.occurredAt;
    const contact = first("SELLER_ENGAGED"), contract = first("CONTRACTED"), closed = first("CLOSED");
    if (contact) durations.discovery_to_contact.push(hours(funnel.createdAt, contact));
    if (contract) durations.discovery_to_contract.push(hours(funnel.createdAt, contract));
    if (contract && closed) durations.contract_to_close.push(hours(contract, closed));
  }
  return {discovery_to_contact:summary(durations.discovery_to_contact),discovery_to_contract:summary(durations.discovery_to_contract),contract_to_close:summary(durations.contract_to_close),byStage:Object.fromEntries(Object.entries(byStage).map(([key,values])=>[key,summary(values)]))};
}

export type ProfitSegmentRow = { market?: string | null; zip?: string | null; county?: string | null; propertyType?: string | null; buyer?: string | null; leadSource?: string | null; strategy?: string | null; projectedCents?: bigint | null; realizedCents?: bigint | null };
export function buildProfitSegments(rows: readonly ProfitSegmentRow[]) {
  const dimensions = ["market","zip","county","propertyType","buyer","leadSource","strategy"] as const;
  return Object.fromEntries(dimensions.map((dimension) => {
    const grouped = new Map<string,{ projectedCents: bigint; realizedCents: bigint; dealCount: number; realizedCount: number }>();
    for (const row of rows) { const key=row[dimension]?.trim()||"UNSPECIFIED"; const current=grouped.get(key)??{projectedCents:BigInt(0),realizedCents:BigInt(0),dealCount:0,realizedCount:0}; current.projectedCents+=row.projectedCents??BigInt(0); current.realizedCents+=row.realizedCents??BigInt(0); current.dealCount+=1; if(row.realizedCents!=null)current.realizedCount+=1; grouped.set(key,current); }
    return [dimension,[...grouped.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({ key, projectedCents:value.projectedCents.toString(), realizedCents:value.realizedCents.toString(), dealCount:value.dealCount, realizedCount:value.realizedCount }))];
  }));
}

export function buildActivityCompleteness(input: { funnels: readonly { stage:string }[]; transactions: readonly { controlStatus:string }[]; outcomes: readonly { closed:boolean; reason?:string|null }[]; buyerPrices: readonly { status:string }[]; dispositionPackages: readonly { approved:boolean }[] }) {
  const lost=input.outcomes.filter((item)=>!item.closed).length;
  return { buyerPricesRequested: input.buyerPrices.length, buyerPricesReceived: input.buyerPrices.filter((item)=>["DOCUMENTED","COMMITTED"].includes(item.status)).length, dispositionPackagesApproved: input.dispositionPackages.filter((item)=>item.approved).length, dealsLost:lost, dealsBlocked:input.funnels.filter((item)=>item.stage==="DISQUALIFIED").length, dealsStopped:input.transactions.filter((item)=>item.controlStatus==="STOPPED").length, dealsArchived:input.funnels.filter((item)=>item.stage==="ARCHIVED").length, dealsNurtured:input.funnels.filter((item)=>item.stage==="NURTURE").length };
}
