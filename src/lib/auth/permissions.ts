// Commerly — RBAC model (mirrors docs/01 §4 and the RLS policies in
// supabase/migrations/20260711120100_rls_policies.sql).
// Client-side guards are convenience only; the database RLS is the authority.

export type OrgRole =
  | "owner" | "admin" | "commercial_manager" | "ecommerce_manager"
  | "account_manager" | "analyst" | "viewer" | "approver";

export type Permission =
  | "view" | "create" | "edit" | "delete" | "approve" | "export"
  | "manage_users" | "manage_settings" | "manage_integrations";

const EDIT_ROLES: OrgRole[] = [
  "owner", "admin", "commercial_manager", "ecommerce_manager", "account_manager", "analyst",
];
const APPROVE_ROLES: OrgRole[] = [
  "owner", "admin", "commercial_manager", "ecommerce_manager", "approver",
];
const ADMIN_ROLES: OrgRole[] = ["owner", "admin"];

const MATRIX: Record<Permission, OrgRole[]> = {
  view: [
    "owner", "admin", "commercial_manager", "ecommerce_manager",
    "account_manager", "analyst", "viewer", "approver",
  ],
  create: EDIT_ROLES,
  edit: EDIT_ROLES,
  delete: ADMIN_ROLES,
  approve: APPROVE_ROLES,
  export: [
    "owner", "admin", "commercial_manager", "ecommerce_manager",
    "account_manager", "analyst", "viewer", "approver",
  ],
  manage_users: ADMIN_ROLES,
  manage_settings: ADMIN_ROLES,
  manage_integrations: ADMIN_ROLES,
};

export function can(role: OrgRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[permission].includes(role);
}

/** Data-scope check for brand/channel-restricted roles (e.g. Account Manager).
 *  Empty/undefined allowed list = full access. */
export function inScope(allowedIds: string[] | null | undefined, id: string | null | undefined): boolean {
  if (!allowedIds || allowedIds.length === 0) return true;
  if (!id) return false;
  return allowedIds.includes(id);
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  commercial_manager: "Commercial Manager",
  ecommerce_manager: "eCommerce Manager",
  account_manager: "Account Manager",
  analyst: "Analyst",
  viewer: "Viewer",
  approver: "Approver",
};
