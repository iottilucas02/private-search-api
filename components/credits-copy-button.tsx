"use client";

import { Check, ClipboardCopy, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { getCreditsTextAction } from "@/app/dashboard/credits/actions";

type CreditsCopyButtonProps = {
  requestId: string;
};

export function CreditsCopyButton({ requestId }: CreditsCopyButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sourceCount, setSourceCount] = useState<number | null>(null);

  function copyCredits() {
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await getCreditsTextAction(requestId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      try {
        await navigator.clipboard.writeText(result.text);
        setSourceCount(result.sourceCount);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        setError("Não consegui copiar automaticamente. Tente novamente pelo navegador.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyCredits}
          disabled={isPending}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-graphite hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : copied ? (
            <Check className="h-4 w-4 text-teal" />
          ) : (
            <ClipboardCopy className="h-4 w-4" />
          )}
          {isPending ? "Montando..." : copied ? "Créditos copiados" : "Copiar créditos"}
        </button>
      </div>

      {error ? <p className="max-w-xl text-xs leading-5 text-rose">{error}</p> : null}
      {sourceCount !== null ? (
        <p className="max-w-xl text-xs leading-5 text-graphite">
          Texto pronto para colar no Google Docs com {sourceCount} fonte(s).
        </p>
      ) : null}
    </div>
  );
}
