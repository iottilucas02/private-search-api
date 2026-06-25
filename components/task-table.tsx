import { Eye } from "lucide-react";
import Link from "next/link";

import { formatDateTime, formatDuration, truncate } from "@/lib/format";
import type { Database } from "@/types/database";

import { StatusBadge } from "./status-badge";

type Task = Database["public"]["Tables"]["search_tasks"]["Row"];

export function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-surface">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-panel text-left text-xs uppercase tracking-wide text-graphite">
          <tr>
            <th className="px-4 py-3 font-semibold">Data e hora</th>
            <th className="px-4 py-3 font-semibold">Consulta</th>
            <th className="px-4 py-3 font-semibold">Solicitados</th>
            <th className="px-4 py-3 font-semibold">Sucesso</th>
            <th className="px-4 py-3 font-semibold">Duracao</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Resultados</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tasks.map((task) => (
            <tr key={task.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-graphite">
                {formatDateTime(task.created_at)}
              </td>
              <td className="min-w-72 px-4 py-3 font-medium text-ink">
                {truncate(task.query, 96)}
              </td>
              <td className="px-4 py-3 text-graphite">{task.requested_results}</td>
              <td className="px-4 py-3 text-graphite">{task.successful_results}</td>
              <td className="px-4 py-3 text-graphite">
                {formatDuration(task.started_at, task.completed_at)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={task.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/dashboard/tasks/${task.id}`}
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-graphite hover:bg-panel"
                  aria-label="Visualizar resultados"
                  title="Visualizar resultados"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
          {tasks.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-graphite" colSpan={7}>
                Nenhuma tarefa encontrada.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
