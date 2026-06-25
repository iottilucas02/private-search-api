import { AlertTriangle, CheckCircle2, Clock, Hourglass, ListChecks, XCircle } from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import { SearchTaskForm } from "@/components/search-task-form";
import { VideoRequestHistory } from "@/components/video-request-history";
import { getRecentTasks, getTaskCounts } from "@/lib/dashboard-data";

export default async function DashboardPage() {
  const [counts, tasks] = await Promise.all([getTaskCounts(), getRecentTasks(80)]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-ink">Pesquisa para vídeos</h1>
      </section>

      <SearchTaskForm />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard label="Pesquisas" value={counts.total} icon={<ListChecks className="h-5 w-5" />} />
        <MetricCard label="Na fila" value={counts.queued} icon={<Hourglass className="h-5 w-5" />} />
        <MetricCard label="Processando" value={counts.processing} icon={<Clock className="h-5 w-5" />} />
        <MetricCard label="Concluidas" value={counts.completed} icon={<CheckCircle2 className="h-5 w-5" />} />
        <MetricCard label="Com erro" value={counts.failed} icon={<XCircle className="h-5 w-5" />} />
        <MetricCard label="Expiradas" value={counts.expired} icon={<AlertTriangle className="h-5 w-5" />} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Solicitações recentes</h2>
        </div>
        <VideoRequestHistory tasks={tasks} />
      </section>
    </div>
  );
}
