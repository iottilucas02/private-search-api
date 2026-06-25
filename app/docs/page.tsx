import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-teal">Private Search API</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Docs</h1>
        </div>
        <Link
          href="/dashboard"
          className="focus-ring rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-graphite"
        >
          Dashboard
        </Link>
      </div>

      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
          <h2 className="text-lg font-semibold text-ink">Criar pesquisa</h2>
          <pre className="mt-4 rounded-md bg-panel p-4 text-sm text-ink">{`POST /api/v1/search
Authorization: Bearer sk_search_xxx
Content-Type: application/json

{
  "query": "principais noticias sobre IA no Brasil",
  "search_type": "news",
  "max_results": 5,
  "callback_url": "https://n8n.example.com/webhook/search-completed",
  "callback_secret": "troque-por-um-segredo-longo",
  "metadata": {
    "workflow": "pesquisa-diaria"
  }
}`}</pre>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
          <h2 className="text-lg font-semibold text-ink">Resposta imediata</h2>
          <pre className="mt-4 rounded-md bg-panel p-4 text-sm text-ink">{`202 Accepted

{
  "task_id": "uuid",
  "status": "queued",
  "result_url": "https://app.example.com/api/v1/search/uuid"
}`}</pre>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
          <h2 className="text-lg font-semibold text-ink">Consultar resultado</h2>
          <pre className="mt-4 rounded-md bg-panel p-4 text-sm text-ink">{`GET /api/v1/search/{task_id}
Authorization: Bearer sk_search_xxx`}</pre>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
          <h2 className="text-lg font-semibold text-ink">Callback n8n</h2>
          <pre className="mt-4 rounded-md bg-panel p-4 text-sm text-ink">{`Headers:
x-search-task-id: uuid
x-search-signature: hmac_sha256(json_body, callback_secret)

Body:
{
  "task": { "status": "completed" },
  "results": [],
  "final_report": {
    "final_answer": "Resposta com links das fontes usadas"
  }
}`}</pre>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-surface">
          <h2 className="text-lg font-semibold text-ink">Estados</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-graphite">
            {["queued", "processing", "completed", "failed", "expired"].map((status) => (
              <span key={status} className="rounded-md border border-line bg-panel px-3 py-2">
                {status}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
