"use server";

import { requireUser } from "@/lib/auth";
import { createGoogleCreditsDocument } from "@/lib/google-docs";

type CreateGoogleCreditsDocResult =
  | {
      ok: true;
      url: string;
      editUrl: string;
      sourceCount: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function createGoogleCreditsDocAction(requestId: string): Promise<CreateGoogleCreditsDocResult> {
  const user = await requireUser();

  try {
    const document = await createGoogleCreditsDocument(requestId, { userId: user.id });
    return {
      ok: true,
      url: document.previewUrl,
      editUrl: document.editUrl,
      sourceCount: document.sourceCount
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível gerar o Google Docs."
    };
  }
}
