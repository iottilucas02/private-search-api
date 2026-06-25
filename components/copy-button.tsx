"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyButtonProps = {
  text: string;
  label?: string;
};

export function CopyButton({ text, label = "Copiar" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copyText}
      className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-graphite hover:bg-panel"
    >
      {copied ? <Check className="h-4 w-4 text-teal" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado" : label}
    </button>
  );
}
