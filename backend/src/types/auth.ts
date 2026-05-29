export type UserRole = "employee" | "engineer" | "admin";

export interface JwtPayload {
  sub: number;
  role: UserRole;
  email: string;
  username: string;
  fullName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
