import type { UserRole } from "../types/auth";

export const USER_ROLES: UserRole[] = ["employee", "engineer", "admin"];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}
