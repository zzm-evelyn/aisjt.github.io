import { z } from "zod";

export const profileSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  revision: z.number().int().positive().optional(),
  kind: z.enum(["audience", "context"]),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(4000),
  enabled: z.boolean(),
});
export type Profile = {
  id: string; kind: "audience" | "context"; name: string;
  description: string; enabled: boolean; revision: number;
};
export type ContextSnapshot = {
  audience: Profile; context: Profile; frozenAt: string;
};
export type Catalog = {
  revision: number; profiles: Profile[];
  links: { audienceId: string; contextId: string }[];
};
export const catalogAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveProfile"), profile: profileSchema }),
  z.object({ action: z.literal("setLink"), audienceId: z.string().min(1), contextId: z.string().min(1), enabled: z.boolean() }),
]);
export const selectionSchema = z.object({
  audienceId: z.string().min(1), contextId: z.string().min(1),
  audienceRevision: z.number().int().positive(), contextRevision: z.number().int().positive(),
});
