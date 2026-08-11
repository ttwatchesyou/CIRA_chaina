import { z } from "zod";

export const projectTypeValues = ["OBJECT_DETECTION"] as const;

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "ชื่อโปรเจกต์ต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(100, "ชื่อโปรเจกต์ต้องไม่เกิน 100 ตัวอักษร"),
  description: z
    .string()
    .trim()
    .max(500, "คำอธิบายต้องไม่เกิน 500 ตัวอักษร")
    .optional()
    .transform((value) => value || undefined),
  type: z.literal("OBJECT_DETECTION"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
