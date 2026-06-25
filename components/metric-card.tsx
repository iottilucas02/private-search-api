import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  icon
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-surface">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-panel text-teal">
        {icon}
      </div>
      <p className="text-sm text-graphite">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
