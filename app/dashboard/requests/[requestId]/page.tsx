import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyButton } from "@/components/copy-button";
import { GoogleCreditsButton } from "@/components/google-credits-button";
import { SearchTaskForm } from "@/components/search-task-form";
import { StatusBadge } from "@/components/status-badge";
import { getVideoRequestDetail } from "@/lib/dashboard-data";
import { formatDateTime, formatDuration, truncate } from "@/lib/format";
import {
  formatSearchType,
  getMetadata,
  getMetaString,
  getMetaStringArray,
  getRequestStats,
  type SearchTaskRow
} from "@/lib/video-requests";
import type { Database } from "@/types/database";

type SearchResult = Database["public"]["Tables"]["search_results"]["Row"];
type FinalReport = Database["public"]["Tables"]["final_reports"]["Row"];

type VideoRequestPageProps = {
  params: Promise<{ requestId: string }>;
  searchParams?: Promise<{ create_error?: string }>;
};

export default async function VideoRequestPage({ params, searchParams }: VideoRequestPageProps) {
  const { requestId } = await params;
  const queryParams = searchParams ? await searchParams : {};
  const detail = await getVideoRequestDetail(requestId).catch(() => null);

  if (!detail?.request) {
    notFound();
  }

  const { request, resultsByTask, reportsByTask } = detail;
  const stats = getRequestStats(request);
  const pagePath = `/dashboard/requests/${request.id}`;
  const copyPack = buildRequestCopyPack(request.tasks, resultsByTask, reportsByTask);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard"
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-graphite hover:bg-panel"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-teal">Solicitação de vídeo</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{request.title}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-graphite">
              <Clock className="h-4 w-4" />
              {formatDateTime(request.createdAt)}
            </p>
            {request.context ? <p className="mt-3 text-sm leading-6 text-graphite">{request.context}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton text={request.title} label="Copiar título" />
            <CopyButton text={copyPack} label="Copiar pacote" />
            <GoogleCreditsButton requestId={request.id} />
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Pesquisas" value={String(request.tasks.length)} />
          <Info label="Resultados" value={`${stats.successfulResults}/${stats.requestedResults}`} />
          <Info label="Processando" value={String(stats.processing)} />
          <Info label="Com erro" value={String(stats.failed)} />
        </dl>
      </section>

      <SearchTaskForm
        requestGroupId={request.id}
        videoTitle={request.title}
        videoContext={request.context}
        rowOffset={request.tasks.length}
        redirectTo={pagePath}
        createError={queryParams.create_error}
        title="Adicionar pesquisas"
        subtitle="Inclua uma ou mais consultas neste vídeo"
        submitLabel="Solicitar novas pesquisas"
        showVideoFields={false}
        queryPlaceholder="Adicionar outra busca para este vídeo"
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Pesquisas e fontes</h2>
        {request.tasks.map((task, index) => (
          <TaskPanel
            key={task.id}
            index={index}
            task={task}
            results={resultsByTask.get(task.id) ?? []}
            report={reportsByTask.get(task.id) ?? null}
          />
        ))}
      </section>
    </div>
  );
}

function TaskPanel({
  index,
  task,
  results,
  report
}: {
  index: number;
  task: SearchTaskRow;
  results: SearchResult[];
  report: FinalReport | null;
}) {
  const metadata = getMetadata(task.metadata);
  const sourcesText = buildSourcesText(results);
  const taskPack = buildTaskCopyPack(task, results, report);

  return (
    <details className="group rounded-lg border border-line bg-white shadow-surface">
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-graphite">
            <span className="rounded-md border border-line bg-panel px-2 py-1">Pesquisa {index + 1}</span>
            <span className="rounded-md border border-line bg-panel px-2 py-1">{formatSearchType(task.search_type)}</span>
            <span className="rounded-md border border-line bg-panel px-2 py-1">
              {task.successful_results}/{task.requested_results} resultado(s)
            </span>
            {metadata.scraping_enabled === false ? (
              <span className="rounded-md border border-line bg-panel px-2 py-1">Rápida</span>
            ) : null}
          </div>
          <h3 className="text-base font-semibold text-ink">{truncate(task.query, 150)}</h3>
          <p className="mt-2 text-sm text-graphite">
            {formatDateTime(task.created_at)} · {formatDuration(task.started_at, task.completed_at)}
          </p>
        </div>
        <StatusBadge status={task.status} />
      </summary>

      <div className="space-y-4 border-t border-line p-4">
        <div className="flex flex-wrap gap-2">
          <CopyButton text={task.query} label="Copiar consulta" />
          {report?.final_answer ? <CopyButton text={report.final_answer} label="Copiar resumo" /> : null}
          {sourcesText ? <CopyButton text={sourcesText} label="Copiar fontes" /> : null}
          <CopyButton text={taskPack} label="Copiar pesquisa" />
          <Link
            href={`/dashboard/tasks/${task.id}`}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-graphite hover:bg-panel"
          >
            Ver tarefa
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Status" value={task.status} />
          <Info label="Tipo" value={formatSearchType(task.search_type)} />
          <Info label="Resultados" value={`${task.successful_results}/${task.requested_results}`} />
          <Info label="Duração" value={formatDuration(task.started_at, task.completed_at)} />
        </div>

        {getMetaString(metadata, "country") || getMetaStringArray(metadata, "include_domains").length > 0 ? (
          <div className="rounded-md border border-line bg-panel p-3 text-sm text-graphite">
            {getMetaString(metadata, "country") ? <p>Região: {getMetaString(metadata, "country")}</p> : null}
            {getMetaStringArray(metadata, "include_domains").length > 0 ? (
              <p>Domínios priorizados: {getMetaStringArray(metadata, "include_domains").join(", ")}</p>
            ) : null}
          </div>
        ) : null}

        {report ? (
          <div className="rounded-md border border-line bg-panel p-4">
            <h4 className="text-sm font-semibold text-ink">Resumo da pesquisa</h4>
            {report.summary ? <p className="mt-2 text-sm text-graphite">{report.summary}</p> : null}
            {report.final_answer ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-md border border-line bg-white p-3 text-sm text-ink">
                {report.final_answer}
              </pre>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-ink">Fontes</h4>
          {results.map((result) => (
            <SourceCard key={result.id} result={result} />
          ))}
          {results.length === 0 ? (
            <div className="rounded-md border border-line bg-panel p-5 text-center text-sm text-graphite">
              Nenhuma fonte coletada ainda.
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function SourceCard({ result }: { result: SearchResult }) {
  const sourceText = buildSourceCopyText(result);

  return (
    <article className="rounded-md border border-line bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h5 className="font-semibold text-ink">{result.title ?? result.domain ?? result.url}</h5>
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 break-all text-sm text-teal"
          >
            {result.url}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <CopyButton text={sourceText} label="Copiar texto" />
      </div>

      {result.snippet ? <p className="mt-3 text-sm leading-6 text-graphite">{result.snippet}</p> : null}
      {result.cleaned_content ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Trecho limpo</summary>
          <p className="mt-2 text-sm leading-6 text-graphite">{truncate(result.cleaned_content, 1800)}</p>
        </details>
      ) : null}
    </article>
  );
}

function buildSourceCopyText(result: SearchResult) {
  return result.cleaned_content || result.raw_content || result.snippet || result.title || result.url;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-graphite">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function buildRequestCopyPack(
  tasks: SearchTaskRow[],
  resultsByTask: Map<string, SearchResult[]>,
  reportsByTask: Map<string, FinalReport>
) {
  return tasks.map((task, index) => buildTaskCopyPack(task, resultsByTask.get(task.id) ?? [], reportsByTask.get(task.id) ?? null, index)).join("\n\n---\n\n");
}

function buildTaskCopyPack(task: SearchTaskRow, results: SearchResult[], report: FinalReport | null, index?: number) {
  return [
    typeof index === "number" ? `PESQUISA ${index + 1}` : "PESQUISA",
    `Consulta: ${task.query}`,
    `Tipo: ${formatSearchType(task.search_type)}`,
    "",
    report?.final_answer ? `Resumo:\n${report.final_answer}` : "Resumo: ainda não disponível.",
    "",
    buildSourcesText(results) || "Fontes: ainda não disponíveis."
  ].join("\n");
}

function buildSourcesText(results: SearchResult[]) {
  return results
    .map((result, index) =>
      [
        `${index + 1}. ${result.title ?? result.domain ?? result.url}`,
        result.url,
        result.snippet ? `Trecho: ${result.snippet}` : null
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}
