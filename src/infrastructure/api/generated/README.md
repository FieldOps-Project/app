# Tipos gerados a partir do OpenAPI

Esta pasta guarda os tipos TypeScript **gerados** a partir do contrato OpenAPI da
API (`schema.d.ts`). Eles não são escritos à mão: a fonte da verdade é o
documento OpenAPI publicado pelo backend.

## Estado atual

`FieldOps-Project/backend#3` (OpenAPI/Swagger versionado) foi concluído: o
contrato vive em `backend/openapi/openapi.json` e `schema.d.ts` aqui é gerado a
partir dele. O card #6 (login) já consome os tipos gerados (`LoginRequest`,
`LoginResponse`, `AuthUser`) em `src/features/auth/api/auth-api.ts`.

O formato de erro segue espelhado à mão em [`../api-error.ts`](../api-error.ts)
em vez de usar `components["schemas"]["ApiError"]` diretamente — essa
reconciliação é o escopo do card #4, não deste card.

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
