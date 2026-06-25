# Private Search API

Aplicacao privada de pesquisa para n8n, com API autenticada, fila assíncrona via Trigger.dev, busca Tavily, scraping Firecrawl, Supabase PostgreSQL e painel administrativo.

## Fluxo

1. O n8n envia `POST /api/v1/search` com uma API key.
2. A aplicacao valida a requisicao, aplica limites e cria uma tarefa `queued`.
3. O endpoint dispara o job `process-search-task` no Trigger.dev e responde com `task_id`.
4. O job pesquisa no Tavily, extrai paginas com Firecrawl, limpa conteudo e salva resultados.
5. A tarefa vira `completed` ou `failed`.
6. O n8n consulta `GET /api/v1/search/{task_id}` ou recebe `callback_url`.
7. O painel mostra tarefas, eventos, fontes, conteudo limpo e relatorio final.

## Configuracao

1. Crie um projeto Supabase.
2. Rode o SQL em `supabase/schema.sql`.
3. Copie `.env.example` para `.env.local` e preencha as chaves.
4. Instale dependencias com `npm install`.
5. Rode o painel com `npm run dev`.
6. Rode jobs localmente com `npm run trigger:dev`.

## Endpoints

### Criar pesquisa

```bash
curl -X POST "$APP_URL/api/v1/search" \
  -H "Authorization: Bearer sk_search_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "principais noticias sobre IA no Brasil",
    "search_type": "news",
    "max_results": 5,
    "callback_url": "https://n8n.example.com/webhook/search-completed",
    "callback_secret": "troque-por-um-segredo-longo",
    "metadata": { "workflow": "pesquisa-diaria" }
  }'
```

Resposta:

```json
{
  "task_id": "uuid",
  "status": "queued",
  "result_url": "https://app.example.com/api/v1/search/uuid"
}
```

### Consultar resultado

```bash
curl "$APP_URL/api/v1/search/{task_id}" \
  -H "Authorization: Bearer sk_search_xxx"
```

## Callback para n8n

Quando `callback_url` e `callback_secret` sao enviados, o sistema faz `POST` no callback com:

- `x-search-task-id`
- `x-search-signature`, HMAC SHA-256 do corpo JSON usando `callback_secret`

O n8n deve validar a assinatura antes de confiar no payload.
