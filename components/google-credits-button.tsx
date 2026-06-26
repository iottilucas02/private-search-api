"use client";

import { Check, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { createGoogleCreditsDocAction } from "@/app/dashboard/credits/actions";

type GoogleCreditsButtonProps = {
  requestId: string;
};

type GeneratedDoc = {
  url: string;
  sourceCount: number;
};

export function GoogleCreditsButton({ requestId }: GoogleCreditsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generateDoc() {
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await createGoogleCreditsDocAction(requestId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setGeneratedDoc({
        url: result.url,
        sourceCount: result.sourceCount
      });

      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generateDoc}
          disabled={isPending}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-graphite hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {isPending ? "Gerando..." : generatedDoc ? "Gerar novo Docs" : "Gerar Google Docs"}
        </button>

        {generatedDoc ? (
          <a
            href={generatedDoc.url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-graphite hover:bg-panel"
          >
            {copied ? <Check className="h-4 w-4 text-teal" /> : <ExternalLink className="h-4 w-4" />}
            {copied ? "Link copiado" : "Abrir Docs"}
          </a>
        ) : null}
      </div>

      {error ? <p className="max-w-xl text-xs leading-5 text-rose">{error}</p> : null}
      {generatedDoc ? (
        <p className="max-w-xl text-xs leading-5 text-graphite">
          Link Google Docs copiado com {generatedDoc.sourceCount} fonte(s).
        </p>
      ) : null}
    </div>
  );
}
