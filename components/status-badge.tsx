import { clsx } from "clsx";

import type { TaskStatus } from "@/types/database";

const statusLabel: Record<TaskStatus, string> = {
  queued: "Na fila",
  processing: "Processando",
  completed: "Concluida",
  failed: "Erro",
  expired: "Expirada"
};

const statusClass: Record<TaskStatus, string> = {
  queued: "border-amber/30 bg-amber/10 text-amber",
  processing: "border-teal/30 bg-teal/10 text-teal",
  completed: "border-emerald-700/30 bg-emerald-700/10 text-emerald-700",
  failed: "border-rose/30 bg-rose/10 text-rose",
  expired: "border-slate-500/30 bg-slate-500/10 text-slate-600"
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex min-w-24 items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold",
        statusClass[status]
      )}
    >
      {statusLabel[status]}
    </span>
  );
}
