import { Check, ChevronDown, ExternalLink, ImageOff, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";

import {
  createMediaTask,
  deleteMediaTask,
  toggleMediaResultSelected
} from "@/app/dashboard/media/actions";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";
import { formatDateTime, truncate } from "@/lib/format";
import { isMediaSearchEnabled } from "@/lib/env";
import type { Database } from "@/types/database";

type MediaTask = Database["public"]["Tables"]["media_tasks"]["Row"];
type MediaResult = Database["public"]["Tables"]["media_results"]["Row"];

type MediaPageProps = {
  searchParams?: Promise<{
    error?: string;
    open?: string;
  }>;
};

export default async function MediaSearchPage({ searchParams }: MediaPageProps) {
  if (!isMediaSearchEnabled()) {
    notFound();
  }

  await requireUser();
  const params = searchParams ? await searchParams : {};
  const { tasks, resultsByTask } = await getMediaTaskHistory();

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-semibold text-ink">Mídia de acontecimentos</h1>
      </section>

      <form action={createMediaTask} className="rounded-lg border border-line bg-white p-5 shadow-surface">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-graphite">Acontecimento</span>
            <input
              name="event_name"
              required
              placeholder="Ex: ataque de drone em base aérea"
              className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-graphite">Data</span>
              <input
                name="event_date"
                type="date"
                className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-graphite">Local</span>
              <input
                name="location"
                placeholder="Cidade, país ou região"
                className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
              />
            </label>
          </div>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-graphite">Descrição do acontecimento</span>
            <textarea
              name="event_description"
              required
              rows={3}
              placeholder="Descreva o que aconteceu, alvos, envolvidos, nomes citados, horário aproximado e qualquer detalhe visual esperado."
              className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-graphite">Mídia desejada</span>
            <input
              name="desired_media"
              placeholder="Ex: vídeos reais do impacto, fotos do local, imagens de testemunhas, reportagens com preview"
              className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-graphite">Tipo</span>
              <select
                name="media_kind"
                defaultValue="both"
                className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
              >
                <option value="both">Imagens e vídeos</option>
                <option value="videos">Só vídeos</option>
                <option value="images">Só imagens</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-graphite">Fonte principal</span>
              <select
                name="source_preference"
                defaultValue="all"
                className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
              >
                <option value="all">Web ampla</option>
                <option value="news">Notícias</option>
                <option value="youtube">YouTube</option>
                <option value="x">X/Twitter</option>
                <option value="official">Fontes oficiais</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-graphite">Resultados</span>
              <input
                name="requested_results"
                type="number"
                min={1}
                max={30}
                defaultValue={10}
                className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
              />
            </label>
          </div>
        </div>

        {params.error ? (
          <div className="mt-4 rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {params.error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            className="focus-ring inline-flex h-10 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white"
          >
            Solicitar busca de mídia
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Solicitações</h2>
          <p className="text-sm text-graphite">{tasks.length} item(ns)</p>
        </div>

        <div className="space-y-3">
          {tasks.map((task, index) => (
            <MediaTaskPanel
              key={task.id}
              task={task}
              results={resultsByTask.get(task.id) ?? []}
              defaultOpen={params.open === task.id || index === 0}
            />
          ))}

          {tasks.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-graphite shadow-surface">
              Nenhuma solicitação de mídia criada.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

async function getMediaTaskHistory() {
  const supabase = await createSupabaseServerClient();
  const { data: tasks, error: tasksError } = await supabase
    .from("media_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (tasksError) throw tasksError;

  const taskIds = (tasks ?? []).map((task) => task.id);
  const resultsByTask = new Map<string, MediaResult[]>();

  if (taskIds.length > 0) {
    const { data: results, error: resultsError } = await supabase
      .from("media_results")
      .select("*")
      .in("media_task_id", taskIds)
      .order("position", { ascending: true });

    if (resultsError) throw resultsError;

    for (const result of results ?? []) {
      const bucket = resultsByTask.get(result.media_task_id) ?? [];
      bucket.push(result);
      resultsByTask.set(result.media_task_id, bucket);
    }
  }

  return { tasks: tasks ?? [], resultsByTask };
}

function MediaTaskPanel({
  task,
  results,
  defaultOpen
}: {
  task: MediaTask;
  results: MediaResult[];
  defaultOpen: boolean;
}) {
  const selectedCount = results.filter((result) => result.selected_for_video).length;

  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-line bg-white shadow-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold text-graphite">
              {kindLabel(task.media_kind)}
            </span>
            <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold text-graphite">
              {sourceLabel(task.source_preference)}
            </span>
          </div>
          <h3 className="truncate text-base font-semibold text-ink">{task.event_name ?? task.query}</h3>
          <p className="mt-1 text-sm text-graphite">
            {formatDateTime(task.created_at)} · {results.length} resultado(s) · {selectedCount} selecionado(s)
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <form action={deleteMediaTask}>
            <input type="hidden" name="task_id" value={task.id} />
            <button
              type="submit"
              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-rose hover:bg-panel"
              aria-label="Excluir solicitação"
              title="Excluir solicitação"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
          <ChevronDown className="h-5 w-5 text-graphite transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-line p-4">
        <dl className="mb-4 grid gap-3 md:grid-cols-3">
          <Info label="Data do evento" value={task.event_date ?? "-"} />
          <Info label="Local" value={task.location ?? "-"} />
          <Info label="Concluída em" value={formatDateTime(task.completed_at)} />
        </dl>

        <div className="mb-4 rounded-md border border-line bg-panel p-3 text-sm leading-6 text-graphite">
          {task.event_description}
          {task.desired_media ? <p className="mt-2 font-medium text-ink">{task.desired_media}</p> : null}
          {task.error_message ? <p className="mt-2 text-rose">{task.error_message}</p> : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {results.map((result) => (
            <MediaResultCard key={result.id} result={result} />
          ))}
        </div>

        {results.length === 0 ? (
          <div className="rounded-md border border-line bg-panel p-5 text-center text-sm text-graphite">
            Sem resultados salvos ainda.
          </div>
        ) : null}
      </div>
    </details>
  );
}

function MediaResultCard({ result }: { result: MediaResult }) {
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex aspect-video items-center justify-center bg-panel">
        {result.thumbnail_url ? (
          <img
            src={result.thumbnail_url}
            alt={result.title ?? "Preview de mídia"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageOff className="h-8 w-8 text-graphite" />
        )}
      </div>

      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold text-graphite">
            {result.media_kind}
          </span>
          <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold text-graphite">
            {result.source_type}
          </span>
          {result.selected_for_video ? (
            <span className="rounded-md border border-teal/30 bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">
              Selecionado
            </span>
          ) : null}
        </div>

        <h4 className="text-sm font-semibold leading-5 text-ink">{truncate(result.title, 110)}</h4>
        {result.description ? (
          <p className="text-sm leading-5 text-graphite">{truncate(result.description, 150)}</p>
        ) : null}

        <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
          {result.license_note ?? "Verificar licenca e permissao de uso na fonte original."}
        </p>

        <div className="flex flex-wrap gap-2">
          <a
            href={result.source_url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-graphite hover:bg-panel"
          >
            <ExternalLink className="h-4 w-4" />
            Fonte
          </a>
          {result.media_url ? (
            <a
              href={result.media_url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-graphite hover:bg-panel"
            >
              Preview
            </a>
          ) : null}
          <form action={toggleMediaResultSelected}>
            <input type="hidden" name="result_id" value={result.id} />
            <input type="hidden" name="selected" value={String(result.selected_for_video)} />
            <button
              type="submit"
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-graphite hover:bg-panel"
            >
              <Check className="h-4 w-4" />
              {result.selected_for_video ? "Remover" : "Selecionar"}
            </button>
          </form>
        </div>
      </div>
    </article>
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

function kindLabel(value: string) {
  if (value === "videos") return "Vídeos";
  if (value === "images") return "Imagens";
  return "Imagens e vídeos";
}

function sourceLabel(value: string) {
  if (value === "news") return "Notícias";
  if (value === "youtube") return "YouTube";
  if (value === "x") return "X/Twitter";
  if (value === "official") return "Oficiais";
  return "Web ampla";
}
