export type Role = "super_admin" | "owner" | "manager" | "collector" | "staff";

/** Higher rank = more authority. Legacy 'staff' ranks like collector. */
const RANK: Record<Role, number> = {
  super_admin: 4,
  owner: 3,
  manager: 2,
  collector: 1,
  staff: 1,
};

export function roleRank(role: Role): number {
  return RANK[role] ?? 0;
}

/** Owner and Super admin: full business control (accounts, voids, waives, settings). */
export function isOwnerUp(role: Role): boolean {
  return roleRank(role) >= RANK.owner;
}

/** Manager and above: approve loans, monitor collectors. */
export function isManagerUp(role: Role): boolean {
  return roleRank(role) >= RANK.manager;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  owner: "Owner",
  manager: "Manager",
  collector: "Collector",
  staff: "Collector",
};

/** Roles an owner can assign in account management (super_admin is reserved). */
export const ASSIGNABLE_ROLES = ["owner", "manager", "collector"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
