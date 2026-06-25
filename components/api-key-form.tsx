"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { createApiKey, type CreateApiKeyState } from "@/app/dashboard/api-keys/actions";

const initialState: CreateApiKeyState = {};

export function ApiKeyForm() {
  const [state, formAction, pending] = useActionState(createApiKey, initialState);

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-surface">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-panel text-teal">
          <KeyRound className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-ink">Nova API key</h2>
      </div>

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-graphite">Nome</span>
          <input
            name="name"
            required
            defaultValue="n8n"
            className="focus-ring w-full rounded-md border border-line px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-graphite">Requisicoes por minuto</span>
          <input
            name="requests_per_minute"
            type="number"
            min={1}
            max={500}
            defaultValue={20}
            className="focus-ring w-full rounded-md border border-line px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-graphite">Limite diario</span>
          <input
            name="daily_limit"
            type="number"
            min={1}
            defaultValue={1000}
            className="focus-ring w-full rounded-md border border-line px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-graphite">Limite mensal</span>
          <input
            name="monthly_limit"
            type="number"
            min={1}
            defaultValue={10000}
            className="focus-ring w-full rounded-md border border-line px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-graphite">Maximo de resultados</span>
          <input
            name="max_results_per_task"
            type="number"
            min={1}
            max={20}
            defaultValue={10}
            className="focus-ring w-full rounded-md border border-line px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-3 pt-7 text-sm font-medium text-graphite">
          <input name="scraping_enabled" type="checkbox" defaultChecked className="h-4 w-4" />
          Scraping habilitado
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="focus-ring inline-flex h-10 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Criando..." : "Criar chave"}
          </button>
        </div>
      </form>

      {state.error ? (
        <div className="mt-4 rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
          {state.error}
        </div>
      ) : null}

      {state.key ? (
        <div className="mt-4 rounded-md border border-teal/30 bg-teal/10 p-3">
          <p className="mb-2 text-sm font-semibold text-teal">Chave gerada</p>
          <pre className="rounded-md bg-white p-3 text-sm text-ink">{state.key}</pre>
        </div>
      ) : null}
    </div>
  );
}
