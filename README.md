# FieldOps — Aplicativo

Aplicativo mobile de inspeções em campo do projeto FieldOps. Expo + React Native +
TypeScript, com Expo Router e estrutura por features.

Este repositório contém a fundação técnica do produto (EP-01 / PBI-002): rotas, camadas,
design system, lint, verificação de tipos e configuração por ambiente. Autenticação real
(EP-02) e persistência com SQLite e sincronização (EP-08) entram em cards próprios.

## Pré-requisitos

| Ferramenta     | Versão              | Observação                                          |
| -------------- | ------------------- | --------------------------------------------------- |
| Node.js        | 20 LTS ou superior  | Verifique com `node -v`                             |
| npm            | 10 ou superior      | Instalado junto com o Node                          |
| Android Studio | Ladybug ou superior | Plataforma de validação obrigatória (documento 1.8) |
| JDK            | 17                  | Exigido pelo build Android                          |
| Xcode          | 16 ou superior      | Apenas para o simulador iOS, que é opcional         |

Para Android, o emulador precisa de um dispositivo virtual (AVD) criado no
**Device Manager** do Android Studio, com imagem de sistema Android 13 (API 33) ou
superior. `adb devices` deve listar o aparelho antes de iniciar o aplicativo.

## Como rodar

```bash
npm install
cp .env.example .env    # ajuste EXPO_PUBLIC_API_URL
npx expo start
```

Com o Metro no ar, pressione `a` para abrir no Android ou `i` para abrir no simulador iOS.
Também funcionam os atalhos diretos:

```bash
npm run android
npm run ios
```

Na primeira execução o Expo instala o aplicativo Expo Go no emulador. O projeto usa apenas
módulos nativos incluídos no Expo Go, então não é necessário gerar build nativa nesta fase.

## Variáveis de ambiente

As variáveis ficam em um arquivo `.env` na raiz, criado a partir de `.env.example`. O
arquivo `.env` **não é versionado**.

| Variável              | Obrigatória | Descrição                                         |
| --------------------- | ----------- | ------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Sim         | URL base da API REST, sem barra no final          |
| `EXPO_PUBLIC_APP_ENV` | Não         | `development` (padrão), `staging` ou `production` |

> **Tudo que começa com `EXPO_PUBLIC_` é embutido no bundle** e fica legível para qualquer
> pessoa que tenha o aplicativo instalado. Nunca coloque senha, chave de API, token ou
> credencial de banco nessas variáveis. O aplicativo não guarda segredo de servidor: o que
> for sensível e por dispositivo (token de sessão) vai para `expo-secure-store` quando a
> autenticação entrar, em EP-02.

A leitura é validada por Zod em [`src/config/env.ts`](src/config/env.ts). Se a URL estiver
ausente ou malformada, o aplicativo falha na inicialização com uma mensagem explicando o
que corrigir, em vez de quebrar depois com um erro de rede confuso.

Variáveis `EXPO_PUBLIC_` são resolvidas no momento do bundle. Depois de editar o `.env`,
reinicie com `npx expo start --clear` — alterar o arquivo com o Metro em execução não tem
efeito.

## Apontar para a API na rede local

O endereço que funciona depende de onde o aplicativo está rodando, porque `localhost`,
dentro do emulador, é o próprio emulador — não a sua máquina.

| Onde o aplicativo roda        | Valor de `EXPO_PUBLIC_API_URL` |
| ----------------------------- | ------------------------------ |
| Emulador Android              | `http://10.0.2.2:8080`         |
| Simulador iOS                 | `http://localhost:8080`        |
| Aparelho físico (mesmo Wi-Fi) | `http://<SEU-IP-LOCAL>:8080`   |

Para descobrir o IP da máquina:

```bash
# macOS / Linux
ipconfig getifaddr en0 || hostname -I
# Windows
ipconfig
```

Checklist quando o aplicativo não alcança a API:

1. A API responde na própria máquina? `curl http://localhost:8080/actuator/health`
2. O aparelho está na **mesma rede Wi-Fi** da máquina?
3. A API está ouvindo em todas as interfaces (`0.0.0.0`) e não só em `localhost`?
4. O firewall da máquina libera a porta 8080?
5. Em Android, tráfego HTTP em texto puro só é aceito em build de desenvolvimento. Em
   produção a API precisa ser HTTPS.

A primeira tela do aplicativo mostra a URL configurada e o resultado de uma consulta ao
endpoint de saúde da API, o que serve como diagnóstico rápido dessa configuração.

## Comunicação com a API

Toda chamada passa por uma única função `request` em
[`src/infrastructure/api`](src/infrastructure/api), sobre uma única instância do Axios com
**tempo limite explícito** (15 s). Em campo a rede trava; sem prazo, a requisição fica
pendurada e a tela presa em carregamento. O `request` devolve
[`Result`](src/domain/result.ts) — sucesso ou falha no tipo — em vez de lançar exceção, para
que a tela seja obrigada a tratar a falha para compilar.

### Taxonomia de falha

A falha é traduzida para `ApiFailure`
([`api-failure.ts`](src/infrastructure/api/api-failure.ts)), o vocabulário que o resto do
aplicativo consome. Nenhuma tela olha status HTTP cru:

| `kind`         | Origem                                   | O que a tela faz                              |
| -------------- | ---------------------------------------- | --------------------------------------------- |
| `network`      | Sem conexão/timeout                      | **Modo offline, nunca erro** (documento 13.8) |
| `unauthorized` | 401                                      | Pede novo login                               |
| `forbidden`    | 403                                      | Informa falta de permissão                    |
| `notFound`     | 404                                      | Registro inexistente                          |
| `conflict`     | 409 (+ `code`)                           | Recarrega o dado e reapresenta                |
| `business`     | 422 (+ `code`, `message`, `fieldErrors`) | Mostra a mensagem/erros de campo              |
| `server`       | 5xx                                      | Falha do servidor; oferece tentar de novo     |

**`network` nunca vira erro na tela.** Em um aplicativo offline-first a ausência de rede é
estado normal de operação: a interface mostra o modo offline. Por isso `describeApiFailure`
recusa `network` em tempo de compilação — quem chama precisa descartá-lo antes com
`isNetworkFailure`.

**Erro de negócio** (409/422) é lido do envelope padronizado da API (documento 12.2 e o
record `ApiError` do backend) em
[`api-error.ts`](src/infrastructure/api/api-error.ts), que confia no contrato e só confere o
par `code`/`message`. Falha de rede e erro de negócio ficam, assim, distinguidos desde a
primeira chamada.

**Sem log de dado sensível.** A `ApiFailure` carrega apenas `kind` e, quando existe, os
campos seguros do envelope do servidor. Nada da requisição (cabeçalhos, corpo, token) é
copiado para a falha, então nada sensível chega a um log, nem em desenvolvimento (RN-007).

### Tipos gerados do OpenAPI — pendência

Os tipos do contrato devem ser **gerados**, não escritos à mão, a partir do OpenAPI da API
(`npm run types:api` → [`generated/`](src/infrastructure/api/generated/README.md)). O
contrato depende de `backend#3`, ainda aberto: sem `/v3/api-docs` publicado, não há de onde
gerar. Até lá, apenas o formato de erro — a única parte que este card consome — é espelhado
à mão em `api-error.ts`, para ser reconciliado com os tipos gerados quando o backend#3
fechar. Pendência aceita de forma explícita, como o próprio card autoriza.

### Chaves de consulta

O TanStack Query usa chaves padronizadas em
[`query-keys.ts`](src/infrastructure/api/query-keys.ts), declaradas de forma hierárquica para
que uma invalidação em `queryKeys.inspections.all()` alcance listas e detalhes aninhados.
Concentrá-las em um arquivo evita chaves divergentes entre telas e deixa claro, a partir da
sprint 6 (documento 13.6), o que ainda é de fato remoto quando o SQLite passa a ser a fonte
operacional.

## Scripts

| Comando                | O que faz                                              |
| ---------------------- | ------------------------------------------------------ |
| `npm start`            | Inicia o Metro                                         |
| `npm run android`      | Inicia e abre no Android                               |
| `npm run ios`          | Inicia e abre no simulador iOS                         |
| `npm run typecheck`    | `tsc --noEmit` em modo estrito                         |
| `npm run lint`         | ESLint, incluindo as regras de fronteira entre camadas |
| `npm run format`       | Aplica o Prettier                                      |
| `npm run format:check` | Verifica formatação sem alterar arquivos               |
| `npm run types:api`    | Gera os tipos TypeScript a partir do OpenAPI da API    |
| `npm run verify`       | Tipos + lint + formatação. Rode antes de abrir um PR   |

## Estrutura

A estrutura segue o documento
[11 - Arquitetura](https://github.com/FieldOps-Project/docs/blob/main/notion/11-arquitetura.md),
seção 11.4. O detalhamento de cada camada e das regras de dependência está em
[`src/README.md`](src/README.md).

```text
src/
├── app/                      # Rotas do Expo Router
├── features/                 # auth, home, inspections, checklist,
│                             # evidence, scanner, location, synchronization
├── components/               # Componentes compartilhados
├── design-system/            # Tokens, tema e componentes visuais
├── application/              # Casos de uso e orquestração
├── domain/                   # Tipos e regras independentes da interface
├── infrastructure/           # api, database, repositories, storage, sync
├── hooks/  schemas/  utils/  config/
```

## Navegação

A árvore de rotas segue o documento
[13 - Aplicativo Mobile](https://github.com/FieldOps-Project/docs/blob/main/notion/13-aplicativo-mobile.md),
seção 13.3, com dois grupos no topo:

```text
src/app/
├── _layout.tsx                 # provedores e grupos
├── (public)/login.tsx          # área pública
└── (protected)/                # exige sessão
    ├── (tabs)/                 # Início · Inspeções · Sincronização · Perfil
    ├── inspections/[inspectionId]/{index,start,checklist,summary,non-conformities}.tsx
    ├── scanner.tsx
    ├── evidence/{capture,preview}.tsx
    └── sync/details.tsx
```

**Proteção de rota.** O layout de `(protected)` verifica a sessão: sem sessão, redireciona
para `/login`. O `Redirect` substitui a entrada em vez de empilhar, então o botão voltar do
Android nunca retorna a uma tela protegida depois da saída. O layout de `(public)` faz o
inverso: com sessão ativa, manda para a área protegida. O redirecionamento espera a leitura
do armazenamento seguro terminar, senão quem já entrou seria mandado ao login a cada
abertura do aplicativo.

**Sessão simulada.** Nesta sprint a sessão é criada escolhendo um perfil na tela de login e
guardada no `expo-secure-store`, sobrevivendo ao reinício do aplicativo. EP-02 substitui
apenas a origem da sessão, em
[`src/application/session/session-context.tsx`](src/application/session/session-context.tsx);
o guarda e as telas não mudam.

**Sincronização é aba, não tela escondida.** O documento 13.8 exige que o estado de envio
permaneça visível, e alcance em um toque faz parte disso.

**Contexto preservado entre checklist e câmera.** As rotas de evidência são empilhadas sobre
o checklist e desfeitas com `dismissTo`, de modo que a tela do checklist nunca é
desmontada — a posição de rolagem e o item em foco continuam onde estavam. Dentro do ciclo,
captura e conferência trocam de lugar com `replace` e ocupam uma única entrada da pilha.
Abrir e fechar a câmera várias vezes mantém a profundidade constante. Em build de
desenvolvimento, um indicador na tela mostra o tamanho da pilha para tornar isso
verificável.

## Decisões técnicas

**Expo Router com pasta `src/app`.** Rota é arquivo, o que mantém a navegação previsível e
elimina o arquivo central de rotas que costuma virar ponto de conflito. Os arquivos em
`src/app` são finos de propósito: escolhem e montam a tela, que vive na feature
correspondente. Isso evita que a árvore de rotas acumule regra de negócio.

**Estrutura por features com camadas.** A direção das dependências — interface depende de
aplicação, que depende de domínio; infraestrutura também depende de domínio, e nunca o
contrário — é o que permite, na sprint 6, trocar a fonte de dados de rede para SQLite sem
reescrever as telas. As três regras não ficam só na documentação: estão codificadas em
[`eslint.config.js`](eslint.config.js) e quebram o lint quando violadas.

**Alias `@/` obrigatório.** Configurado em `tsconfig.json` e resolvido pelo bundler via
`experiments.tsconfigPaths`, ligado por padrão. O lint bloqueia caminhos relativos que
sobem dois ou mais níveis (`../../`), que são o sinal mais comum de atravessar fronteira de
camada sem perceber.

**TypeScript estrito com `noUncheckedIndexedAccess`.** Acesso por índice passa a devolver
`T | undefined`. Custa algumas verificações a mais, e evita a classe de erro mais comum ao
percorrer lista de itens de checklist e de evidências vinda da API.

**NativeWind para estilo.** Classes utilitárias do Tailwind compiladas para estilo nativo
em tempo de build, sem custo de runtime. Os tokens ficam em um único arquivo
([`src/design-system/tokens/design-tokens.js`](src/design-system/tokens/design-tokens.js))
consumido tanto pelo `tailwind.config.js` quanto pelo tema de navegação, o que impede a
paleta das classes e a paleta das transições de tela divergirem.

**Axios como cliente HTTP.** Uma única instância em
[`src/infrastructure/api/http-client.ts`](src/infrastructure/api/http-client.ts) concentra a
URL base, o tempo limite e a tradução de erro. Os interceptors de sessão entram nesse mesmo
ponto em EP-02, sem tocar nas telas.

**`Result` em vez de exceção para falha esperada.** O aplicativo roda em campo, com rede
intermitente. Sem conexão, credencial inválida e conflito de sincronização são situações
previstas que precisam virar mensagem na tela. Devolver
[`Result`](src/domain/result.ts) obriga quem chama a tratar o erro para conseguir compilar;
`throw` fica para o que é realmente inesperado.

**Comentários apenas em JSDoc, escritos em inglês.** Código sem comentário solto em linha; o
que precisa de explicação ganha um bloco JSDoc objetivo. Texto de interface e mensagem de
erro exibida à pessoa usuária continuam em português.

**TanStack Query com padrões para uso em campo.** Dado já carregado continua válido por
alguns minutos e a repetição automática é limitada — insistir em uma requisição sem rede só
gasta bateria. A repetição de operações de escrita fica a cargo da outbox de sincronização
(EP-08), não do cache.

## Contribuição

Fluxo de trabalho, padrão de branch, mensagem de commit e template de PR estão definidos no
`CONTRIBUTING.md` do repositório
[docs](https://github.com/FieldOps-Project/docs) (card
[docs#1](https://github.com/FieldOps-Project/docs/issues/1), em aberto no momento desta
entrega).

Antes de abrir um PR:

```bash
npm run verify
```
