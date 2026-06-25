import { z } from "zod";

import { getEnv } from "@/lib/env";

const firecrawlResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      markdown: z.string().optional().nullable(),
      html: z.string().optional().nullable(),
      rawHtml: z.string().optional().nullable(),
      metadata: z
        .object({
          title: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
          sourceURL: z.string().optional().nullable(),
          url: z.string().optional().nullable(),
          statusCode: z.number().optional().nullable(),
          error: z.string().optional().nullable()
        })
        .passthrough()
        .optional()
        .nullable()
    })
    .passthrough()
    .optional()
    .nullable()
});

export type FirecrawlScrape = z.infer<typeof firecrawlResponseSchema>;

export async function scrapeWithFirecrawl(url: string) {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnv("FIRECRAWL_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      removeBase64Images: true,
      blockAds: true,
      timeout: 60_000
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firecrawl scrape failed: ${response.status} ${body}`);
  }

  const parsed = firecrawlResponseSchema.parse(await response.json());

  if (!parsed.success) {
    throw new Error(parsed.data?.metadata?.error ?? "Firecrawl scrape did not succeed");
  }

  return parsed;
}
