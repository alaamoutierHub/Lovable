import { describe, it, expect } from "vitest";
import { can, inScope, OrgRole } from "./permissions";

describe("RBAC — can()", () => {
  it("viewer can view and export but not create/edit/approve/manage", () => {
    expect(can("viewer", "view")).toBe(true);
    expect(can("viewer", "export")).toBe(true);
    expect(can("viewer", "create")).toBe(false);
    expect(can("viewer", "edit")).toBe(false);
    expect(can("viewer", "approve")).toBe(false);
    expect(can("viewer", "manage_settings")).toBe(false);
  });

  it("analyst can create/edit but not approve or delete or manage", () => {
    expect(can("analyst", "create")).toBe(true);
    expect(can("analyst", "edit")).toBe(true);
    expect(can("analyst", "approve")).toBe(false);
    expect(can("analyst", "delete")).toBe(false);
    expect(can("analyst", "manage_users")).toBe(false);
  });

  it("approver can approve but not edit", () => {
    expect(can("approver", "approve")).toBe(true);
    expect(can("approver", "edit")).toBe(false);
  });

  it("only owner/admin can delete, manage users, settings, integrations", () => {
    for (const p of ["delete", "manage_users", "manage_settings", "manage_integrations"] as const) {
      expect(can("owner", p)).toBe(true);
      expect(can("admin", p)).toBe(true);
      expect(can("commercial_manager", p)).toBe(false);
      expect(can("account_manager", p)).toBe(false);
    }
  });

  it("null role has no permissions", () => {
    const perms = ["view", "create", "edit", "approve", "export"] as const;
    for (const p of perms) expect(can(null, p)).toBe(false);
  });

  it("commercial and ecommerce managers can approve", () => {
    expect(can("commercial_manager", "approve")).toBe(true);
    expect(can("ecommerce_manager", "approve")).toBe(true);
  });
});

describe("RBAC — inScope() brand/channel scoping", () => {
  it("empty/undefined allow-list = full access", () => {
    expect(inScope(undefined, "brand-1")).toBe(true);
    expect(inScope([], "brand-1")).toBe(true);
  });
  it("restricted list matches only assigned ids", () => {
    expect(inScope(["b1", "b2"], "b2")).toBe(true);
    expect(inScope(["b1", "b2"], "b3")).toBe(false);
  });
  it("restricted list with missing id = denied", () => {
    expect(inScope(["b1"], null)).toBe(false);
  });
});

describe("RBAC — matrix completeness", () => {
  it("every role resolves view", () => {
    const roles: OrgRole[] = [
      "owner", "admin", "commercial_manager", "ecommerce_manager",
      "account_manager", "analyst", "viewer", "approver",
    ];
    for (const r of roles) expect(can(r, "view")).toBe(true);
  });
});
