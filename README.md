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
