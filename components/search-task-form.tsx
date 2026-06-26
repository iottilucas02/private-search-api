"use client";

import { Plus, Search, Send, SlidersHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { createDashboardSearchTask } from "@/app/dashboard/tasks/actions";

type SearchRow = {
  id: number;
};

type SearchTaskFormProps = {
  requestGroupId?: string;
  videoTitle?: string;
  videoContext?: string | null;
  rowOffset?: number;
  redirectTo?: string;
  createError?: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  showVideoFields?: boolean;
  queryPlaceholder?: string;
};

export function SearchTaskForm({
  requestGroupId,
  videoTitle = "",
  videoContext = "",
  rowOffset,
  redirectTo,
  createError,
  title = "Nova solicitação",
  subtitle = "Pesquisa agrupada por vídeo",
  submitLabel = "Solicitar pesquisas",
  showVideoFields = true,
  queryPlaceholder = "Cole a busca gerada pelo Claude"
}: SearchTaskFormProps) {
  const nextId = useRef(2);
  const [rows, setRows] = useState<SearchRow[]>([{ id: 1 }]);

  function addRow() {
    setRows((currentRows) => {
      if (currentRows.length >= 8) return currentRows;

      const row = { id: nextId.current };
      nextId.current += 1;
      return [...currentRows, row];
    });
  }

  function removeRow(id: number) {
    setRows((currentRows) =>
      currentRows.length === 1 ? currentRows : currentRows.filter((row) => row.id !== id)
    );
  }

  return (
    <form action={createDashboardSearchTask} className="rounded-lg border border-line bg-white p-5 shadow-surface">
      {requestGroupId ? <input type="hidden" name="request_group_id" value={requestGroupId} /> : null}
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
      {typeof rowOffset === "number" ? <input type="hidden" name="row_offset" value={rowOffset} /> : null}
      {!showVideoFields ? (
        <>
          <input type="hidden" name="video_title" value={videoTitle} />
          <input type="hidden" name="video_context" value={videoContext ?? ""} />
        </>
      ) : null}

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-panel text-teal">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <p className="text-sm text-graphite">{subtitle}</p>
          </div>
        </div>

        <button
          type="submit"
          className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal px-4 text-sm font-semibold text-white"
        >
          <Send className="h-4 w-4" />
          {submitLabel}
        </button>
      </div>

      {createError ? (
        <div className="mb-5 rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
          {createError}
        </div>
      ) : null}

      {showVideoFields ? (
        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(260px,420px)_1fr]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-graphite">Vídeo ou tema</span>
            <input
              name="video_title"
              maxLength={120}
              defaultValue={videoTitle}
              placeholder="Ex: Ataque à ponte ferroviária na Ucrânia"
              className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-graphite">Contexto interno</span>
            <input
              name="video_context"
              maxLength={240}
              defaultValue={videoContext ?? ""}
              placeholder="Opcional"
              className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
            />
          </label>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-graphite">Pesquisas</h3>
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= 8}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-graphite hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Adicionar linha
          </button>
        </div>

        {rows.map((row, index) => (
          <div key={row.id} className="rounded-md border border-line bg-panel p-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_140px_120px_44px] lg:items-end">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-graphite">Consulta {index + 1}</span>
                <input
                  name="query"
                  required={index === 0}
                  minLength={3}
                  maxLength={500}
                  placeholder={queryPlaceholder}
                  className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-graphite">Tipo</span>
                <select
                  name="search_type"
                  defaultValue="web"
                  className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2"
                >
                  <option value="web">Web</option>
                  <option value="news">Notícias</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-graphite">Resultados</span>
                <input
                  name="max_results"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={5}
                  className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2"
                />
              </label>

              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-graphite hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Remover pesquisa"
                title="Remover pesquisa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <details className="mt-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-graphite">
                <SlidersHorizontal className="h-4 w-4" />
                Opções avançadas
              </summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-graphite">País ou região</span>
                  <input
                    name="country"
                    maxLength={80}
                    placeholder="Ex: Ukraine"
                    className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-graphite">Conteúdo</span>
                  <select
                    name="scraping_enabled"
                    defaultValue="true"
                    className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2"
                  >
                    <option value="true">Completo</option>
                    <option value="false">Rápido</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-graphite">Priorizar domínios</span>
                  <input
                    name="include_domains"
                    maxLength={500}
                    placeholder="reuters.com, apnews.com"
                    className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-graphite">Excluir domínios</span>
                  <input
                    name="exclude_domains"
                    maxLength={500}
                    placeholder="reddit.com, wikipedia.org"
                    className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2"
                  />
                </label>
              </div>
            </details>
          </div>
        ))}
      </div>
    </form>
  );
}
