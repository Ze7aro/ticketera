import type { DefaultSession } from "next-auth";
import type { StaffRole } from "@/modules/users/validation";
declare module "next-auth" {
  interface User {
    role: StaffRole;
    sessionVersion: number;
  }
  interface Session {
    user: {
      id: string;
      role: StaffRole;
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    role?: StaffRole;
    sessionVersion?: number;
    issuedAt?: number;
  }
}
