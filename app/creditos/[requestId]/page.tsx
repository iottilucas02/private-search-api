import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { getCreditsDocument } from "@/lib/credits";
import { formatDateTime } from "@/lib/format";

type CreditsPageProps = {
  params: Promise<{ requestId: string }>;
};

export const dynamic = "force-dynamic";

export default async function CreditsPage({ params }: CreditsPageProps) {
  const { requestId } = await params;
  const document = await getCreditsDocument(requestId).catch(() => null);

  if (!document) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f3f6fb] px-4 py-8 text-[#172033]">
      <article className="mx-auto max-w-3xl rounded-sm bg-[#ffffff] px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:px-10 sm:py-12">
        <header className="border-b border-[#d9e2ec] pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#52657a]">
            Créditos e referências
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#111827]">
            {document.request.title}
          </h1>
          <p className="mt-3 text-sm text-[#52657a]">
            Criado em {formatDateTime(document.request.createdAt)}
          </p>
          {document.request.context ? (
            <p className="mt-4 text-base leading-7 text-[#334155]">{document.request.context}</p>
          ) : null}
        </header>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-[#111827]">Fontes consultadas</h2>
          {document.sources.length > 0 ? (
            <ol className="mt-5 space-y-5">
              {document.sources.map((source, index) => (
                <li key={source.id} className="border-b border-[#e5edf5] pb-5 last:border-b-0">
                  <p className="text-sm font-semibold text-[#52657a]">Referência {index + 1}</p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-start gap-2 break-all text-base font-semibold text-[#0f7490]"
                  >
                    <span>{source.title}</span>
                    <ExternalLink className="mt-1 h-4 w-4 shrink-0" />
                  </a>
                  <p className="mt-1 break-all text-sm text-[#2563a8]">{source.url}</p>
                  <p className="mt-2 text-sm leading-6 text-[#52657a]">
                    Pesquisa {source.taskIndex + 1}: {source.query}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 rounded-md border border-[#d9e2ec] bg-[#f8fafc] px-4 py-3 text-sm text-[#52657a]">
              Nenhuma fonte coletada ainda.
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
