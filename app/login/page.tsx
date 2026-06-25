import { redirect } from "next/navigation";

import { signIn } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : {};

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        action={signIn}
        className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-surface"
      >
        <div className="mb-6">
          <p className="text-sm font-semibold text-teal">Private Search API</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Acessar painel</h1>
        </div>

        {params?.error ? (
          <div className="mb-4 rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {params.error === "1" ? "E-mail ou senha invalidos." : params.error}
          </div>
        ) : null}

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-graphite">E-mail</span>
          <input
            name="email"
            type="email"
            required
            className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-medium text-graphite">Senha</span>
          <input
            name="password"
            type="password"
            required
            className="focus-ring w-full rounded-md border border-line bg-field px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="focus-ring w-full rounded-md bg-teal px-4 py-2 font-medium text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
