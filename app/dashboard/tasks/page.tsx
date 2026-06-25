import { SearchTaskForm } from "@/components/search-task-form";
import { TaskTable } from "@/components/task-table";
import { getRecentTasks } from "@/lib/dashboard-data";

export default async function TasksPage() {
  const tasks = await getRecentTasks(50);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Tarefas</h1>
      </div>
      <SearchTaskForm />
      <TaskTable tasks={tasks} />
    </div>
  );
}
