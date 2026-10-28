import { z } from "zod";
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
export const passwordSchema = z
  .string()
  .min(12, "Usá al menos 12 caracteres.")
  .max(128);
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const controllerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
});
export const idSchema = z.string().cuid();
export const controllerUpdateSchema = z.object({
  id: idSchema,
  active: z.boolean(),
  password: z.union([z.literal(""), passwordSchema]),
});
export type StaffRole = "ADMIN" | "CONTROLLER";
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  sessionVersion: number;
  active: boolean;
};
