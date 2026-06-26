import { createSign } from "crypto";

import { buildCreditsPlainText, getCreditsDocument } from "@/lib/credits";
import { getOptionalEnv } from "@/lib/env";

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleDocumentResponse = {
  documentId?: string;
};

type GoogleApiError = {
  error?: {
    message?: string;
    status?: string;
  };
};

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

const googleScopes = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file"
].join(" ");

export async function createGoogleCreditsDocument(requestId: string, options?: { userId?: string }) {
  const document = await getCreditsDocument(requestId);

  if (!document) {
    throw new Error("Solicitação não encontrada.");
  }

  if (options?.userId && !document.request.tasks.some((task) => task.user_id === options.userId)) {
    throw new Error("Você não tem acesso a esta solicitação.");
  }

  const accessToken = await getGoogleAccessToken();
  const title = buildDocumentTitle(document.request.title);
  const body = buildCreditsPlainText(document);
  const documentId = await createDocument(accessToken, title);

  await insertDocumentText(accessToken, documentId, body);
  await moveDocumentToFolderIfNeeded(accessToken, documentId);
  await publishDocument(accessToken, documentId);

  return {
    documentId,
    previewUrl: `https://docs.google.com/document/d/${documentId}/preview?tab=t.0`,
    editUrl: `https://docs.google.com/document/d/${documentId}/edit?usp=sharing`,
    sourceCount: document.sources.length
  };
}

async function getGoogleAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const serviceAccount = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: "RS256",
      typ: "JWT"
    },
    {
      iss: serviceAccount.client_email,
      scope: googleScopes,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    },
    serviceAccount.private_key
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const payload = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "Não foi possível autenticar no Google.");
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000
  };

  return tokenCache.accessToken;
}

function getServiceAccount(): GoogleServiceAccount {
  const json = getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (json) {
    const parsed = JSON.parse(json) as Partial<GoogleServiceAccount>;
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: normalizePrivateKey(parsed.private_key)
      };
    }
  }

  const clientEmail = getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

  if (!clientEmail || !privateKey) {
    throw new Error("Configure GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY no Vercel.");
  }

  return {
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey)
  };
}

function signJwt(header: object, claimSet: object, privateKey: string) {
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claimSet))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64Url(signer.sign(privateKey))}`;
}

async function createDocument(accessToken: string, title: string) {
  const response = await googleFetch<GoogleDocumentResponse>("https://docs.googleapis.com/v1/documents", accessToken, {
    method: "POST",
    body: JSON.stringify({ title })
  });

  if (!response.documentId) {
    throw new Error("Google não retornou o ID do documento.");
  }

  return response.documentId;
}

async function insertDocumentText(accessToken: string, documentId: string, text: string) {
  await googleFetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text
          }
        }
      ]
    })
  });
}

async function moveDocumentToFolderIfNeeded(accessToken: string, documentId: string) {
  const folderId = getOptionalEnv("GOOGLE_DRIVE_FOLDER_ID");

  if (!folderId) {
    return;
  }

  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${encodeURIComponent(
      folderId
    )}&fields=id,parents&supportsAllDrives=true`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify({})
    }
  );
}

async function publishDocument(accessToken: string, documentId: string) {
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}/permissions?supportsAllDrives=true`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        type: "anyone",
        role: "reader"
      })
    }
  );
}

async function googleFetch<T = unknown>(url: string, accessToken: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & GoogleApiError) : ({} as T & GoogleApiError);

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Erro ao chamar a API do Google.");
  }

  return payload;
}

function buildDocumentTitle(title: string) {
  return `Créditos - ${title}`.slice(0, 140);
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
