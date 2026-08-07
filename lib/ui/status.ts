/**
 * Shared status → badge class mapping for loans, schedules, and remittances.
 * Uses the .badge* component classes from globals.css.
 */

const LOAN_STATUS_BADGE: Record<string, string> = {
  pending_approval: "badge badge-warn",
  approved: "badge badge-info",
  rejected: "badge badge-danger",
  active: "badge badge-success",
  paid: "badge badge-neutral",
  defaulted: "badge badge-danger",
  cancelled: "badge badge-neutral",
  restructured: "badge badge-warn",
  draft: "badge badge-neutral",
};

const SCHEDULE_STATUS_BADGE: Record<string, string> = {
  pending: "badge badge-warn",
  due: "badge badge-info",
  paid: "badge badge-success",
  partial: "badge badge-warn",
  overdue: "badge badge-danger",
  waived: "badge badge-neutral",
};

const REMIT_STATUS_BADGE: Record<string, string> = {
  confirmed: "badge badge-success",
  pending: "badge badge-warn",
  awaiting: "badge badge-warn",
};

export function statusBadgeClass(
  status: string,
  kind: "loan" | "schedule" | "remit" = "loan",
): string {
  const map =
    kind === "schedule"
      ? SCHEDULE_STATUS_BADGE
      : kind === "remit"
        ? REMIT_STATUS_BADGE
        : LOAN_STATUS_BADGE;
  return map[status] ?? "badge badge-neutral";
}

/** Human-facing label for loan statuses (pending_approval → pending). */
export function statusLabel(status: string): string {
  if (status === "pending_approval") return "pending";
  return status.replaceAll("_", " ");
}
