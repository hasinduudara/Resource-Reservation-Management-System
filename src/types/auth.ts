import type { UserRole, UserStatus } from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}
