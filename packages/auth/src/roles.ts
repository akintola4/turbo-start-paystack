import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Org-scoped permissions. There is no global role: a user's power always comes
 * from their `member.role` in the organization being acted on.
 */
export const statements = {
  ...defaultStatements,
  billing: ["view", "manage"],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
    ac: ["create", "read", "update", "delete"],
    billing: ["view", "manage"],
  }),
  admin: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
    ac: ["read"],
    // Admins see billing but cannot spend money. Give them "manage" here if
    // your customers expect it.
    billing: ["view"],
  }),
  billing: ac.newRole({
    billing: ["view", "manage"],
    ac: ["read"],
  }),
  member: ac.newRole({
    ac: ["read"],
  }),
  viewer: ac.newRole({
    ac: ["read"],
  }),
};

export type Role = keyof typeof roles;
export const ROLES = Object.keys(roles) as Role[];

/**
 * Used to cap invitations and role changes: nobody can grant a role ranked
 * above their own. `billing` and `member` are peers.
 */
export const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  billing: 2,
  member: 2,
  viewer: 1,
};

type Statements = typeof statements;
export type Resource = keyof Statements;
export type Permission = {
  [R in Resource]: `${R}:${Statements[R][number]}`;
}[Resource];

export function isRole(value: string): value is Role {
  return value in roles;
}

/** Highest rank among a (possibly comma-separated) role string. Unknown
 *  roles rank 0. */
export function rankOf(roleString: string): number {
  return Math.max(
    0,
    ...roleString
      .split(",")
      .map((r) => r.trim())
      .map((r) => (isRole(r) ? ROLE_RANK[r] : 0))
  );
}

export function roleHasPermission(
  roleString: string,
  permission: Permission
): boolean {
  const [resource, action] = permission.split(":") as [Resource, string];
  return roleString
    .split(",")
    .map((r) => r.trim())
    .some((r) => {
      if (!isRole(r)) {
        return false;
      }
      const result = roles[r].authorize({ [resource]: [action] } as never);
      return result.success;
    });
}
