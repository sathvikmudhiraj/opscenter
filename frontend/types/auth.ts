export type UserRole = "employee" | "engineer" | "admin";

export interface AuthUser {
  id: number;
  name: string;
  fullName?: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
  forcePasswordChange?: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
