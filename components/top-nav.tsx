import { BookOpen, Database, KeyRound, ListChecks, LogOut } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/login/actions";

export function TopNav({ email }: { email?: string | null }) {
  const links = [
    { href: "/dashboard", label: "Dashboard", icon: Database },
    { href: "/dashboard/tasks", label: "Tarefas", icon: ListChecks },
    { href: "/dashboard/api-keys", label: "API keys", icon: KeyRound },
    { href: "/docs", label: "Docs", icon: BookOpen }
  ] as const;

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-sm font-semibold text-teal">Private Search API</p>
          <p className="text-sm text-graphite">{email}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-graphite hover:bg-panel"
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          <form action={signOut}>
            <button
              type="submit"
              className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-graphite hover:bg-panel"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
