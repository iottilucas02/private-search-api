import { z } from "zod";

export const searchRequestSchema = z.object({
  query: z.string().trim().min(3).max(500),
  search_type: z.enum(["web", "news", "finance"]).default("web"),
  max_results: z.coerce.number().int().min(1).max(20).default(5),
  callback_url: z.string().url().optional(),
  callback_secret: z.string().min(16).max(256).optional(),
  include_domains: z.array(z.string().trim().min(1)).max(50).optional(),
  exclude_domains: z.array(z.string().trim().min(1)).max(50).optional(),
  country: z.string().trim().min(2).max(80).optional(),
  metadata: z.record(z.unknown()).default({})
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const taskIdSchema = z.string().uuid();
