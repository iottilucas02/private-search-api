import { Ban, CheckCircle2 } from "lucide-react";

import { revokeApiKey } from "@/app/dashboard/api-keys/actions";
import { ApiKeyForm } from "@/components/api-key-form";
import { formatDateTime } from "@/lib/format";
import { getApiKeys } from "@/lib/dashboard-data";

export default async function ApiKeysPage() {
  const apiKeys = await getApiKeys();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">API keys</h1>
      </div>

      <ApiKeyForm />

      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-panel text-left text-xs uppercase tracking-wide text-graphite">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Prefixo</th>
              <th className="px-4 py-3 font-semibold">Limites</th>
              <th className="px-4 py-3 font-semibold">Scraping</th>
              <th className="px-4 py-3 font-semibold">Ultimo uso</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Revogar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {apiKeys.map((apiKey) => (
              <tr key={apiKey.id}>
                <td className="px-4 py-3 font-medium text-ink">{apiKey.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-graphite">{apiKey.prefix}</td>
                <td className="px-4 py-3 text-graphite">
                  {apiKey.requests_per_minute}/min · {apiKey.daily_limit}/dia ·{" "}
                  {apiKey.monthly_limit}/mes · max {apiKey.max_results_per_task}
                </td>
                <td className="px-4 py-3 text-graphite">
                  {apiKey.scraping_enabled ? "Habilitado" : "Desabilitado"}
                </td>
                <td className="px-4 py-3 text-graphite">{formatDateTime(apiKey.last_used_at)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-graphite">
                    {apiKey.active ? (
                      <CheckCircle2 className="h-4 w-4 text-teal" />
                    ) : (
                      <Ban className="h-4 w-4 text-rose" />
                    )}
                    {apiKey.active ? "Ativa" : "Revogada"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {apiKey.active ? (
                    <form action={revokeApiKey}>
                      <input type="hidden" name="key_id" value={apiKey.id} />
                      <button
                        type="submit"
                        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-rose hover:bg-panel"
                        aria-label="Revogar API key"
                        title="Revogar API key"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {apiKeys.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-graphite" colSpan={7}>
                  Nenhuma chave criada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
