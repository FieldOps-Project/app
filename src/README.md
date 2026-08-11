# Arquitetura do código

Estrutura definida no documento [11 - Arquitetura](https://github.com/FieldOps-Project/docs/blob/main/notion/11-arquitetura.md),
seção 11.4.

```text
src/
├── app/                      # Rotas do Expo Router
├── features/                 # auth, home, inspections, checklist,
│                             # evidence, scanner, location, synchronization
├── components/               # Componentes compartilhados entre features
├── design-system/            # Tokens, tema e componentes visuais
├── application/              # Casos de uso e orquestração
├── domain/                   # Tipos e regras independentes da interface
├── infrastructure/           # api, database, repositories, storage, sync
├── hooks/                    # Hooks reutilizáveis, sem regra de negócio
├── schemas/                  # Schemas Zod de formulários e respostas da API
├── utils/                    # Funções puras auxiliares
└── config/                   # Leitura e validação de configuração de ambiente
```

## Responsabilidade de cada camada

| Pasta            | Responsabilidade                                                              |
| ---------------- | ----------------------------------------------------------------------------- |
| `app`            | Navegação e composição de tela. Arquivo de rota só escolhe e monta a tela.    |
| `features`       | Organização por capacidade de negócio: telas, hooks e componentes da feature. |
| `components`     | Componentes compartilhados que não pertencem a uma feature só.                |
| `design-system`  | Tokens, tema e componentes visuais. Sem regra de negócio, sem acesso a dado.  |
| `application`    | Coordena ações: iniciar, salvar, concluir, sincronizar.                       |
| `domain`         | Tipos, estados e validações independentes de plataforma.                      |
| `infrastructure` | API, SQLite, arquivos e conectividade.                                        |

## Direção das dependências

A regra que sustenta a estrutura:

```text
app → features → application → domain
                      ↓
               infrastructure → domain
```

- `domain/` **não importa** de `app/`, `features/`, `application/`,
  `infrastructure/` nem de bibliotecas de plataforma (React, React Native, Expo, Axios).
- `application/` e `infrastructure/` **não importam** da camada de interface
  (`app/`, `features/`, `components/`, `design-system/`).
- `design-system/` **não importa** de rota, feature, aplicação ou infraestrutura.

Isso é o que torna possível, na sprint 6 (EP-08), trocar a fonte de dados de
rede para SQLite sem reescrever as telas: a tela conversa com a aplicação, que
conversa com um repositório; quem implementa o repositório pode mudar.

As três regras são verificadas pelo ESLint (`npm run lint`), em
[`eslint.config.js`](../eslint.config.js). Violação quebra o lint, não depende
de revisão manual.

## Importações

Sempre pelo alias `@/`, configurado em `tsconfig.json`:

```ts
import { Button } from '@/design-system/components/button';
```

Caminho relativo que sobe dois ou mais níveis (`../../`) é bloqueado pelo lint —
é o sinal mais comum de atravessar fronteira de camada sem perceber.
