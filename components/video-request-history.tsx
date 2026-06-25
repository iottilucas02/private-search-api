import { Clock } from "lucide-react";
import Link from "next/link";

import { formatDateTime, truncate } from "@/lib/format";
import { getRequestStats, groupTasksByVideoRequest, type SearchTaskRow, type VideoRequest } from "@/lib/video-requests";

export function VideoRequestHistory({ tasks }: { tasks: SearchTaskRow[] }) {
  const requests = groupTasksByVideoRequest(tasks);

  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-graphite shadow-surface">
        Nenhuma solicitação encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <VideoRequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}

function VideoRequestCard({ request }: { request: VideoRequest }) {
  const stats = getRequestStats(request);

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-surface">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-graphite">
            <span className="rounded-md border border-line bg-panel px-2 py-1">
              {request.tasks.length} pesquisa(s)
            </span>
            <span className="rounded-md border border-line bg-panel px-2 py-1">
              {stats.successfulResults}/{stats.requestedResults} resultado(s)
            </span>
            {stats.processing > 0 ? (
              <span className="rounded-md border border-line bg-panel px-2 py-1">Processando</span>
            ) : null}
            {stats.queued > 0 ? <span className="rounded-md border border-line bg-panel px-2 py-1">Na fila</span> : null}
            {stats.failed > 0 ? (
              <span className="rounded-md border border-rose/30 bg-rose/10 px-2 py-1 text-rose">Erro</span>
            ) : null}
            {stats.allCompleted ? (
              <span className="rounded-md border border-teal/30 bg-teal/10 px-2 py-1 text-teal">Concluída</span>
            ) : null}
          </div>

          <h3 className="truncate text-base font-semibold text-ink">{request.title}</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-graphite">
            <Clock className="h-4 w-4" />
            {formatDateTime(request.createdAt)}
          </p>
          {request.context ? <p className="mt-2 text-sm text-graphite">{truncate(request.context, 180)}</p> : null}
        </div>

        <Link
          href={`/dashboard/requests/${request.id}`}
          className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-teal hover:bg-panel"
        >
          Abrir
        </Link>
      </div>
    </article>
  );
}
