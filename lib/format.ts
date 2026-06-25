export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDuration(startedAt?: string | null, completedAt?: string | null) {
  if (!startedAt) return "-";

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function truncate(value: string | null | undefined, length = 120) {
  if (!value) return "";
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}...`;
}
