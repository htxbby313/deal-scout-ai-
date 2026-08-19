"use client";

import { useActionState } from "react";
import { reviewAgentTaskAction, runAgentQueueAction } from "@/app/agent-actions";

export type AgentStatus = "ACTIVE" | "PAUSED" | "DISABLED";
export type AgentTaskStatus = "QUEUED" | "IN_PROGRESS" | "WAITING_FOR_APPROVAL" | "BLOCKED" | "COMPLETED" | "CANCELLED" | "FAILED";

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  queuedTasks: number;
  activeTasks: number;
  approvalTasks: number;
  completedTasks: number;
  lastActiveAt: string | null;
  supervisionMode: "SUPERVISED";
  autonomyEligible: boolean;
  autonomyBlockers: string[];
}

export interface AgentTaskSummary {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  status: AgentTaskStatus;
  transactionLabel: string | null;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentEventSummary {
  id: string;
  agentName: string;
  summary: string;
  createdAt: string;
}

export interface AgentDashboardProps {
  agents: AgentSummary[];
  approvalTasks: AgentTaskSummary[];
  recentTasks: AgentTaskSummary[];
  events: AgentEventSummary[];
}

type ActionState = { status: "idle" | "success" | "error"; message: string };
const initialState: ActionState = { status: "idle", message: "" };

const agentStatusLabels: Record<AgentStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  DISABLED: "Disabled",
};

const agentStatusTones: Record<AgentStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800",
  PAUSED: "bg-amber-50 text-amber-800",
  DISABLED: "bg-slate-100 text-slate-700",
};

const taskStatusLabels: Record<AgentTaskStatus, string> = {
  QUEUED: "Queued",
  IN_PROGRESS: "Running",
  WAITING_FOR_APPROVAL: "Owner review",
  BLOCKED: "Blocked",
  COMPLETED: "Complete",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const taskStatusTones: Record<AgentTaskStatus, string> = {
  QUEUED: "bg-blue-50 text-blue-800",
  IN_PROGRESS: "bg-violet-50 text-violet-800",
  WAITING_FOR_APPROVAL: "bg-amber-50 text-amber-800",
  BLOCKED: "bg-orange-50 text-orange-800",
  COMPLETED: "bg-emerald-50 text-emerald-800",
  FAILED: "bg-red-50 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-700",
};

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Never";

function Result({ state }: { state: ActionState }) {
  return state.message ? (
    <p className={`mt-2 text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">
      {state.message}
    </p>
  ) : null;
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${agentStatusTones[status]}`}>{agentStatusLabels[status]}</span>;
}

function TaskStatusBadge({ status }: { status: AgentTaskStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${taskStatusTones[status]}`}>{taskStatusLabels[status]}</span>;
}

function RunQueueButton({ agentId, disabled }: { agentId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(runAgentQueueAction.bind(null, agentId), initialState);
  return (
    <form action={action}>
      <button className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || pending} type="submit">
        {pending ? "Starting…" : "Run queue"}
      </button>
      <Result state={state} />
    </form>
  );
}

function TaskReviewControls({ taskId }: { taskId: string }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ReviewForm decision="APPROVE" taskId={taskId} />
      <ReviewForm decision="REJECT" taskId={taskId} />
    </div>
  );
}

function ReviewForm({ taskId, decision }: { taskId: string; decision: "APPROVE" | "REJECT" }) {
  const [state, action, pending] = useActionState(reviewAgentTaskAction.bind(null, taskId, decision), initialState);
  const rejecting = decision === "REJECT";
  return (
    <form action={action} className={`rounded-xl border p-3 ${rejecting ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
      <label className="text-xs font-bold" htmlFor={`${taskId}-${decision}-note`}>{rejecting ? "Rejection reason" : "Approval note"}</label>
      <input
        className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm"
        id={`${taskId}-${decision}-note`}
        name="note"
        placeholder={rejecting ? "Required" : "Optional"}
        required={rejecting}
      />
      <button className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${rejecting ? "bg-red-700" : "bg-emerald-700"}`} disabled={pending} type="submit">
        {pending ? "Saving…" : rejecting ? "Reject" : "Approve"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function AgentDashboard({ agents, approvalTasks, recentTasks, events }: AgentDashboardProps) {
  const queued = agents.reduce((total, agent) => total + agent.queuedTasks, 0);
  const active = agents.reduce((total, agent) => total + agent.activeTasks, 0);
  const completed = agents.reduce((total, agent) => total + agent.completedTasks, 0);

  return (
    <div className="space-y-6">
      <section aria-label="Agent totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Agents", agents.length], ["Queued", queued], ["Running", active], ["Owner review", approvalTasks.length]].map(([label, value]) => (
          <article className="rounded-2xl border bg-white p-5 shadow-sm" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold">Agent team</h2>
          <p className="text-sm text-slate-500">{completed} tasks complete</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {agents.map((agent) => (
            <article className="rounded-2xl border bg-white p-5 shadow-sm" key={agent.id}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold">{agent.name}</h3><p className="text-sm text-slate-500">{agent.role}</p></div>
                <AgentStatusBadge status={agent.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Supervised</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${agent.autonomyEligible ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}>
                  {agent.autonomyEligible ? "Autonomy eligible · locked" : "Autonomy locked"}
                </span>
              </div>
              {agent.autonomyBlockers.length ? <p className="mt-2 text-xs text-slate-500">Gates · {agent.autonomyBlockers.join(" · ")}</p> : null}
              <dl className="my-5 grid grid-cols-3 gap-2 text-center">
                <div><dt className="text-xs text-slate-500">Queued</dt><dd className="mt-1 font-bold">{agent.queuedTasks}</dd></div>
                <div><dt className="text-xs text-slate-500">Running</dt><dd className="mt-1 font-bold">{agent.activeTasks}</dd></div>
                <div><dt className="text-xs text-slate-500">Review</dt><dd className="mt-1 font-bold">{agent.approvalTasks}</dd></div>
              </dl>
              <p className="mb-3 text-xs text-slate-500">Last active · {formatDate(agent.lastActiveAt)}</p>
              <RunQueueButton agentId={agent.id} disabled={agent.activeTasks > 0 || agent.status !== "ACTIVE"} />
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5"><h2 className="text-xl font-bold">Owner review · {approvalTasks.length}</h2></div>
        <div className="divide-y">
          {approvalTasks.map((task) => (
            <article className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start" key={task.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{task.title}</h3><TaskStatusBadge status={task.status} /></div>
                <p className="mt-1 text-sm text-slate-500">{task.agentName}{task.transactionLabel ? ` · ${task.transactionLabel}` : ""} · {task.evidenceCount} evidence items</p>
                <p className="mt-2 text-xs text-slate-500">Updated {formatDate(task.updatedAt)}</p>
              </div>
              <TaskReviewControls taskId={task.id} />
            </article>
          ))}
          {approvalTasks.length === 0 ? <p className="p-5 text-sm text-slate-500">Nothing waiting for approval.</p> : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Recent tasks</h2>
          <div className="mt-3 divide-y">
            {recentTasks.map((task) => (
              <div className="flex items-start justify-between gap-3 py-3" key={task.id}>
                <div><p className="text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.agentName} · {formatDate(task.updatedAt)}</p></div>
                <TaskStatusBadge status={task.status} />
              </div>
            ))}
            {recentTasks.length === 0 ? <p className="py-3 text-sm text-slate-500">No tasks yet.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Activity log</h2>
          <div className="mt-3 divide-y">
            {events.map((event) => (
              <div className="py-3" key={event.id}><p className="text-sm font-semibold">{event.summary}</p><p className="mt-1 text-xs text-slate-500">{event.agentName} · {formatDate(event.createdAt)}</p></div>
            ))}
            {events.length === 0 ? <p className="py-3 text-sm text-slate-500">No agent activity yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
