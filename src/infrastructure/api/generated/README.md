# Tipos gerados a partir do OpenAPI

Esta pasta guarda os tipos TypeScript **gerados** a partir do contrato OpenAPI da
API (`schema.d.ts`). Eles não são escritos à mão: a fonte da verdade é o
documento OpenAPI publicado pelo backend.

## Estado atual — pendência consciente

O card #4 depende de `FieldOps-Project/backend#3` (OpenAPI/Swagger versionado),
que ainda está **aberto**: nenhum `openapi.json` foi versionado e não há servidor
publicando `/v3/api-docs`. Sem contrato, não há de onde gerar.

Enquanto isso, o formato de erro — a única parte do contrato que este card
precisa consumir — está fixado em dois lugares equivalentes e é espelhado à mão
em [`../api-error.ts`](../api-error.ts):

- documento **12.2** (`docs/notion/12-api-rest.md`);
- o record `ApiError` do backend (`shared/presentation/dto/ApiError.java`).

Quando o backend#3 for concluído, gere os tipos e **reconcilie** `api-error.ts`
com o `schema.d.ts` resultante (removendo o espelhamento manual do envelope).

## Como gerar

Com a API rodando localmente (Springdoc publica em `/v3/api-docs`):

```bash
npm run types:api
```

O script aponta para `http://localhost:8080/v3/api-docs`. Ajuste a URL conforme o
alvo (por exemplo `http://10.0.2.2:8080` a partir de um emulador Android, ou o IP
da máquina a partir de um aparelho físico) ou passe um arquivo local:

```bash
npx --yes openapi-typescript@^7 ./openapi.json -o src/infrastructure/api/generated/schema.d.ts
```

> `openapi-typescript@7` exige TypeScript 5 como peer; o projeto está em
> TypeScript 6. Por isso o script roda via `npx` (isolado), sem instalá-lo como
> dependência e sem conflitar com a árvore do projeto.

O `schema.d.ts` gerado **deve ser versionado**, para que `typecheck` e CI rodem
sem depender de um servidor no ar.
