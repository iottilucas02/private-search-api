"use server";

import { requireUser } from "@/lib/auth";
import { buildCreditsPlainText, getCreditsDocument } from "@/lib/credits";

type GetCreditsTextResult =
  | {
      ok: true;
      text: string;
      sourceCount: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function getCreditsTextAction(requestId: string): Promise<GetCreditsTextResult> {
  const user = await requireUser();

  try {
    const document = await getCreditsDocument(requestId);

    if (!document) {
      return {
        ok: false,
        error: "Solicitação não encontrada."
      };
    }

    if (!document.request.tasks.some((task) => task.user_id === user.id)) {
      return {
        ok: false,
        error: "Você não tem acesso a esta solicitação."
      };
    }

    return {
      ok: true,
      text: buildCreditsPlainText(document),
      sourceCount: document.sources.length
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível montar os créditos."
    };
  }
}
