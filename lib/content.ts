import type { Database } from "@/types/database";

type SearchResultRow = Database["public"]["Tables"]["search_results"]["Row"];

export function cleanContent(content: string | null | undefined) {
  if (!content) return "";

  return content
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24_000);
}

export function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function buildFinalReport(query: string, results: SearchResultRow[]) {
  const selectedSources = results
    .filter((result) => result.scrape_status !== "failed")
    .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
    .slice(0, Math.min(5, results.length));

  const keyFindings = selectedSources.map((source) => ({
    source_id: source.id,
    title: source.title,
    url: source.url,
    domain: source.domain,
    finding: source.cleaned_content || source.snippet || "Fonte coletada sem trecho textual suficiente."
  }));

  const sourceList = selectedSources
    .map((source, index) => `${index + 1}. ${source.title ?? source.domain ?? source.url}: ${source.url}`)
    .join("\n");

  const finalAnswer =
    selectedSources.length > 0
      ? [
          `Pesquisa consolidada: ${query}`,
          "",
          "Resumo: as fontes abaixo foram coletadas, limpas e selecionadas como base inicial para a resposta final. Um agente de IA pode usar os trechos em key_findings para produzir uma sintese mais opinativa ou executiva.",
          "",
          "Fontes usadas:",
          sourceList
        ].join("\n")
      : `Pesquisa consolidada: ${query}\n\nNenhuma fonte utilizavel foi coletada.`;

  return {
    summary:
      selectedSources.length > 0
        ? `${selectedSources.length} fonte(s) selecionada(s) para analise final.`
        : "Nenhuma fonte selecionada para analise final.",
    keyFindings,
    finalAnswer,
    sourceIds: selectedSources.map((source) => source.id)
  };
}
