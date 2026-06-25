import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { getTaskDetail } from "@/lib/dashboard-data";
import { formatDateTime, formatDuration, truncate } from "@/lib/format";

type TaskDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  const detail = await getTaskDetail(id).catch(() => null);

  if (!detail?.task) {
    notFound();
  }

  const { task, results, events, finalReport } = detail;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal">Tarefa</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{task.query}</h1>
          </div>
          <StatusBadge status={task.status} />
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Criada em" value={formatDateTime(task.created_at)} />
          <Info label="Inicio" value={formatDateTime(task.started_at)} />
          <Info label="Conclusao" value={formatDateTime(task.completed_at)} />
          <Info label="Duracao" value={formatDuration(task.started_at, task.completed_at)} />
          <Info label="Solicitados" value={String(task.requested_results)} />
          <Info label="Sucesso" value={String(task.successful_results)} />
          <Info label="Falhas" value={String(task.failed_results)} />
          <Info label="Tipo" value={task.search_type} />
        </dl>

        {task.error_message ? (
          <div className="mt-5 rounded-md border border-rose/30 bg-rose/10 p-3 text-sm text-rose">
            {task.error_message}
          </div>
        ) : null}
      </section>

      {finalReport ? (
        <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
          <h2 className="text-lg font-semibold text-ink">Relatorio final</h2>
          <p className="mt-2 text-sm text-graphite">{finalReport.summary}</p>
          <pre className="mt-4 rounded-md border border-line bg-panel p-4 text-sm text-ink">
            {finalReport.final_answer}
          </pre>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Fontes coletadas</h2>
        <div className="space-y-3">
          {results.map((result) => (
            <article key={result.id} className="rounded-lg border border-line bg-white p-5 shadow-surface">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">
                      {result.title ?? result.domain ?? result.url}
                    </h3>
                    {result.selected_for_final_answer ? (
                      <span className="rounded-md border border-teal/30 bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">
                        Usada na resposta final
                      </span>
                    ) : null}
                  </div>
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
                <div className="text-sm text-graphite">
                  <p>Dominio: {result.domain ?? "-"}</p>
                  <p>Scraping: {result.scrape_status}</p>
                  <p>Relevancia: {result.relevance_score ?? "-"}</p>
                  <p>Publicado: {formatDateTime(result.published_at)}</p>
                </div>
              </div>

              {result.snippet ? (
                <p className="mt-4 text-sm leading-6 text-graphite">{result.snippet}</p>
              ) : null}

              {result.error_message ? (
                <div className="mt-4 rounded-md border border-rose/30 bg-rose/10 p-3 text-sm text-rose">
                  {result.error_message}
                </div>
              ) : null}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Conteudo limpo</summary>
                <p className="mt-3 text-sm leading-6 text-graphite">
                  {truncate(result.cleaned_content, 5000) || "Sem conteudo limpo disponivel."}
                </p>
              </details>
            </article>
          ))}

          {results.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-graphite shadow-surface">
              Nenhuma fonte coletada.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
        <h2 className="text-lg font-semibold text-ink">Eventos</h2>
        <div className="mt-4 divide-y divide-line">
          {events.map((event) => (
            <div key={event.id} className="py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-ink">{event.event_type}</p>
                <p className="text-graphite">{formatDateTime(event.created_at)}</p>
              </div>
              {event.message ? <p className="mt-1 text-graphite">{event.message}</p> : null}
            </div>
          ))}
          {events.length === 0 ? <p className="py-5 text-sm text-graphite">Sem eventos.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-graphite">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
