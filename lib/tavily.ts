import { z } from "zod";

import { getEnv } from "@/lib/env";
import type { SearchRequest } from "@/lib/search-schema";

const tavilyResultSchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url(),
  content: z.string().optional().nullable(),
  raw_content: z.string().optional().nullable(),
  score: z.number().optional().nullable(),
  published_date: z.string().optional().nullable()
});

const tavilyResponseSchema = z.object({
  query: z.string(),
  results: z.array(tavilyResultSchema),
  response_time: z.union([z.number(), z.string()]).optional(),
  request_id: z.string().optional()
});

export type TavilyResult = z.infer<typeof tavilyResultSchema>;

export async function searchWithTavily(input: SearchRequest) {
  const topic = input.search_type === "web" ? "general" : input.search_type;

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnv("TAVILY_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: input.query,
      topic,
      max_results: input.max_results,
      search_depth: "advanced",
      chunks_per_source: 3,
      include_answer: false,
      include_raw_content: false,
      include_domains: input.include_domains,
      exclude_domains: input.exclude_domains,
      country: input.country,
      include_usage: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tavily search failed: ${response.status} ${body}`);
  }

  return tavilyResponseSchema.parse(await response.json());
}
