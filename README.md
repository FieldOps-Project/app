# FieldOps — Aplicativo

Aplicativo mobile de inspeções em campo do projeto FieldOps. Expo + React Native +
TypeScript, com Expo Router e estrutura por features.

Este repositório contém a fundação técnica do produto (EP-01 / PBI-002): rotas, camadas,
design system, lint, verificação de tipos e configuração por ambiente, além da autenticação
(EP-02) e da execução de campo (EP-06). As inspeções do técnico ficam em SQLite no aparelho;
o motor completo de sincronização (EP-08) entra em cards próprios.

## Pré-requisitos

| Ferramenta     | Versão              | Observação                                          |
| -------------- | ------------------- | --------------------------------------------------- |
| Node.js        | 22 LTS ou superior  | Verifique com `node -v`                             |
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

| Variável              | Obrigatória | Descrição                                               |
| --------------------- | ----------- | ------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Sim         | URL base da API REST, sem barra no final                |
| `EXPO_PUBLIC_APP_ENV` | Não         | `local` (padrão), `integration`, `demo` ou `production` |

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

## Identidade, versão e ambientes

**Identidade.** Nome `FieldOps`, identificador `com.fieldops.app` (Android e iOS), orientação
retrato. O ícone e a tela de abertura usam o braço robótico, a mesma marca do painel web, em
branco sobre o azul primário `#1d5fd0`. O Android recebe o ícone adaptativo (primeiro plano,
fundo e monocromático) e o `expo prebuild` gera todas as densidades (`mipmap-mdpi` a
`mipmap-xxxhdpi`).

**Permissões.** Só câmera, localização (precisa e aproximada), internet e estado da rede (`ACCESS_NETWORK_STATE`, que o NetInfo acrescenta na montagem do Gradle e o aplicativo usa para saber se está offline). O `app.json` bloqueia
`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW` e `VIBRATE`, que o Expo
acrescenta por padrão, e `ACCESS_WIFI_STATE`, que o NetInfo traz e o aplicativo não usa. O manifesto gerado por `expo prebuild --platform
android` ficou assim na verificação de 18/11/2026 (feita à mão, fora do CI):

```text
ACCESS_COARSE_LOCATION  ACCESS_FINE_LOCATION  CAMERA  INTERNET
READ/WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW, VIBRATE  -> tools:node="remove"
```

**Versão.** `version` (`1.0.0`) é a versão legível, definida no `app.json`. O número de build é
incrementado pelo EAS a cada build distribuível (`appVersionSource: remote` e `autoIncrement` no
[`eas.json`](eas.json)); `android.versionCode` e `ios.buildNumber` do `app.json` são só o ponto de
partida. O aplicativo lê a versão e o build reais do binário (`expo-application`), mostra os dois
na tela de perfil e os envia em todas as requisições, nos cabeçalhos `X-App-Version` e
`X-App-Build`, para o suporte e a API saberem quem está chamando (documento 12.18).

**Ambientes** (documento 11.12). Cada perfil de build do `eas.json` fixa o ambiente e a URL da
API, então trocar de ambiente é escolher o perfil, sem alterar código:

| Perfil        | `EXPO_PUBLIC_APP_ENV` | API                                                   |
| ------------- | --------------------- | ----------------------------------------------------- |
| `local`       | `local`               | `http://10.0.2.2:8080` (emulador Android)             |
| `integration` | `integration`         | `https://api.integracao.fieldops.example` (a definir) |
| `demo`        | `demo`                | `https://api.demo.fieldops.example` (a definir)       |
| `production`  | `production`          | `https://api.fieldops.example` (a definir)            |

As URLs de integração, demonstração e produção são endereços reservados (`.example`) até existir
um servidor publicado; troque-as no `eas.json` quando o ambiente existir. Em desenvolvimento, o
`.env` continua valendo. Fora de `production`, o início, o login e o perfil mostram o ambiente,
para ninguém confundir dado de teste com dado real. A tela de perfil também mostra o
identificador do aparelho, um UUID gerado na primeira abertura e guardado no `expo-secure-store`,
que o suporte pode pedir.

Nada sensível vai para o bundle: os perfis só definem variáveis `EXPO_PUBLIC_`, e um teste
([`app-config.test.ts`](src/config/app-config.test.ts)) falha se aparecer outra coisa.

## Dados no aparelho (SQLite)

O aplicativo é offline-first: as telas leem as inspeções do SQLite, não da rede
(documento 13.6). A API alimenta o banco local e recebe o que foi feito em campo.

```text
API --(download)--> SQLite <--(leitura)-- telas
                      |
               sync_operations (outbox) --(Sincronizar)--> API
```

- Esquema versionado em [`src/infrastructure/database/migrations.ts`](src/infrastructure/database/migrations.ts).
  Migrações só avançam; nunca edite uma entrada publicada, acrescente outra. A versão
  (`schema_version` do documento 10.13.4) fica em `PRAGMA user_version` e é gravada na
  mesma transação da migração.
- Tabelas: `inspections` (com cliente, local e equipamento da inspeção), `inspection_items`
  (snapshot), `inspection_responses`, `evidences`, `non_conformities`, `sync_operations`
  (outbox) e `sync_metadata`. As entidades sincronizáveis têm os metadados locais do
  documento 10.13.2, e o estado de negócio fica separado do estado de sincronização.
- Iniciar, responder, anexar evidência e concluir gravam o registro e a operação de envio
  na mesma transação. Nada espera a rede para considerar o dado salvo. As telas nunca
  executam SQL; tudo passa pelos repositórios em `src/infrastructure/repositories`.
- Um download nunca sobrescreve trabalho local ainda não enviado.

### Outbox

- Editar o mesmo registro várias vezes gera uma operação só, que mantém o `operation_id`
  original em todas as tentativas. Uma operação em `PROCESSING` não é consolidada: a próxima
  edição abre outra.
- O upload de uma evidência espera as operações da resposta que ela comprova. Se a foto vier
  antes da resposta, o upload passa a esperar a resposta quando ela for criada. A conclusão
  espera tudo o que ainda é devido para a inspeção.
- Remover uma evidência cancela o upload que nunca foi tentado ou que o servidor recusou. Se
  o upload pode ter chegado ao servidor (em envio, ou cortado pela rede), a remoção entra na
  fila depois dele e o arquivo fica no aparelho.
- Uma falha marca só a própria operação. O `last_error` passa por `sanitizeSyncError`, que
  remove tokens e senhas e limita o tamanho.
- **O que o motor envia.** Início, respostas, não conformidades, fotos, remoção de foto,
  reabertura para correção e conclusão, nessa ordem de dependência, e a conclusão sempre por
  último. A foto vai como `multipart/form-data` (`file` como `{ uri, name, type }` e `metadata`
  como `{ string, type: 'application/json' }`, que é como o React Native serializa as partes,
  com o id gerado no aparelho para o reenvio ser seguro) para `POST /inspections/{id}/evidence`;
  a não conformidade vai para `POST /inspections/{id}/non-conformities`; a remoção, para
  `DELETE /evidence/{id}`; a reabertura, para `POST /inspections/{id}/reopen`. Esses formatos
  foram conferidos contra o backend `develop` (início, respostas, não conformidade, foto,
  remoção e conclusão aceitos com os payloads do app).
- O motor processa em passadas: uma operação que espera outra (por exemplo, a foto tirada antes
  de o item ser respondido) fica para a passada seguinte em vez de travar a inspeção.
- Uma foto que o servidor recusa de forma definitiva (413, 415 ou arquivo ausente do aparelho)
  falha só a própria operação, não trava as outras inspeções e **reabre a inspeção concluída**
  para correção, com o motivo na tela, para o técnico poder descartar a foto e concluir de novo.
  A remoção de uma foto que o servidor já não conhece (404) conta como feita. Os arquivos de uma foto só são
  apagados do aparelho depois que o servidor confirma a remoção. Fotos têm 60 s de tempo limite
  em vez de 15 s, e 413 e 415 viram mensagens próprias.

### Regras aplicadas no repositório, não só na tela

O repositório é a última barreira antes do SQLite, então as regras que protegem o dado não
dependem de a tela estar certa:

- **Conclusão (RN-037, RN-038, RN-039).** `completeInspection` recalcula o progresso dentro da
  transação e recusa se houver item obrigatório sem resposta, observação exigida na não
  conformidade ou evidência exigida pelo item. A regra das não conformidades críticas (RN-055)
  continua ao lado.
- **Resposta (RN-035, RN-036).** `saveResponse` recusa uma resposta a um item de outra inspeção,
  um valor que não combina com o tipo do item, número fora do intervalo, opção que não existe,
  data impossível e texto acima do limite (`schemas/response-integrity.ts`).
- **Evidência (RN-049).** Incluir ou remover foto só é aceito com a inspeção em andamento.
- **Servidor que já aprovou (RN-076).** Se o servidor aprovou uma inspeção que tem registro local
  não enviado, o app trava a inspeção, marca conflito e explica; o dado local fica guardado.
- **Aparelho compartilhado (RN-004).** O trabalho não enviado de um técnico nunca é sobrescrito
  pelo download de outro. Uma inspeção sem pendência passa ao técnico para quem foi reatribuída.
- **Usuário inativo (RN-001).** O 401 com `AUTH_USER_INACTIVE` vira "Seu acesso está desativado
  ou bloqueado", e não "E-mail ou senha inválidos".
- **Última sincronização (RN-072).** A tela de sincronização mostra data e resultado da última
  tentativa (tudo sincronizado, parcial ou não concluída) e, se ela não foi completa, a data da
  última que foi.

### Correção após reprovação

O fluxo do documento 7.8 funciona sem conexão, porque cada passo grava no aparelho e entra na
outbox:

- A reprovação chega pela sincronização (`review` no detalhe mobile) e a lista destaca a inspeção
  como **Requer correção**. O motivo aparece em primeiro plano no detalhe e no topo do checklist,
  e os itens apontados ficam marcados como "A corrigir".
- A inspeção reprovada fica só para consulta até o técnico tocar em **Reabrir para correção**
  (`reopenInspection`): a reabertura nunca é automática. Ela muda o estado local para
  `IN_PROGRESS` e enfileira `REOPEN`, que o motor envia para `POST /inspections/{id}/reopen`
  antes das respostas corrigidas e da nova conclusão.
- **Escopo da edição.** Com `itemsToCorrect`, só esses itens aceitam resposta; sem a lista, o
  checklist inteiro reabre. A regra está em `saveResponse` (`ItemNotCorrectableError`), não só
  na tela, e o servidor também a aplica.
- **Reenvio.** A conclusão passa pela mesma validação de sempre (`completeInspection`) e gera uma
  operação nova.
- **Histórico (RN-083).** O endpoint de revisões do backend é restrito ao supervisor, e o detalhe
  mobile traz só a reprovação mais recente. Por isso, ao reabrir, o app guarda a reprovação
  atual em `review_history_json` (migração 5), e o detalhe mostra "Reprovações anteriores" mesmo
  depois de uma segunda reprovação.
- Limite conhecido: o aparelho que baixa a inspeção pela primeira vez já reprovada não recebe as
  reprovações anteriores, só a última.

### Download incremental e conflitos

Depois de enviar a fila e baixar as inspeções, o motor chama `GET /api/v1/mobile/sync/pull` e
aplica o que o servidor devolve. Hoje o aplicativo só usa as **respostas** (`INSPECTION_RESPONSE`),
que é o que o detalhe `GET /mobile/inspections/{id}` ainda não traz (`responses` vem vazio, issue
backend#74): o pull devolve o `id` e a `version` de cada resposta, e é com essa versão que a
próxima edição vai no `baseVersion` do `PUT`.

- **O cursor é opaco e só avança depois de gravar.** Cada página é aplicada em uma transação do
  SQLite e o `pull_cursor` (em `sync_metadata`) é gravado na mesma transação. Se a gravação falha,
  o cursor fica onde estava e a página volta na próxima sincronização.
- **O cursor também fica parado** quando a página traz uma resposta de uma inspeção que ainda não
  está no aparelho: avançar perderia essa resposta para sempre. A execução vira "parcial" e a
  próxima tentativa recomeça nessa página.
- **O pull nunca sobrescreve uma resposta com envio pendente.** Se a resposta local está
  pendente e o servidor já está em uma versão maior que a conhecida (ou tem outra resposta para o
  mesmo item), a operação vira `CONFLICT`, o servidor é guardado em `sync_operations.server_state_json`
  e o valor local continua intacto. Operações em conflito não são reenviadas.
- **Conflito aparece nos três lugares do card #28:** o selo "Conflito" na lista, o cartão
  "Conflito de sincronização" no detalhe (valor deste aparelho ao lado do valor do servidor) e a
  tela de sincronização, que leva à inspeção afetada. O texto diz que não há botão de resolver: a
  saída é ação administrativa ou nova inspeção (a resolução colaborativa está fora do MVP).
- A resposta ao `PUT` já devolve 409 quando a versão está velha. O pull logo em seguida na mesma
  execução é o que traz o valor do servidor para mostrar os dois lados.

**Limites conhecidos.** O pull ainda não trata `NON_CONFORMITY` nem `INSPECTION_EVIDENCE` (só as
respostas), e não usa `POST /mobile/sync/push`: o envio continua pelos endpoints individuais
porque o push não aceita as transições (início, conclusão e reabertura). Uma resposta local
sem envio pendente cujo `id` difere do `id` do servidor (outro aparelho) mantém o `id` local.

### Conectividade e envio automático

- **Offline é modo de operação, não erro.** O `ConnectivityProvider` escuta o NetInfo e um aviso
  global ("Sem conexão com a internet" ou "Sem acesso ao servidor") aparece no topo de toda tela
  pelo `Screen`, com ícone, texto e a quantidade de registros aguardando envio (RN-071). Ele só
  informa: nada é bloqueado e o preenchimento segue, salvo no SQLite.
- **Conexão não é internet.** Wi-fi sem saída (portal cativo) chega como `isInternetReachable:
false` e vale como offline. Quando o NetInfo diz que há rede mas uma sincronização ou o download
  da lista falha por falta de rede, o aplicativo marca o servidor como inacessível; a próxima
  requisição que passar, ou qualquer mudança de rede, limpa a marca.
- **Envio automático ao voltar a conexão**, sem repetir a cada oscilação: só dispara depois de 3 s
  seguidos online, uma vez por retorno, e nunca na abertura do aplicativo nem sem sessão
  (`AutoSync`, `RECONNECT_STABLE_MS`).
- **Estado permanente por inspeção**: o selo com os cinco estados do documento 13.8 (salvo no
  dispositivo, aguardando envio, enviado, falha e conflito, cada um com ícone e texto) fica no
  cartão da lista, no detalhe, no resumo e agora também no topo do checklist, ao lado de "Cada
  resposta é salva neste aparelho na hora".
- O envio em si continua o descrito em "Outbox"; a data e o resultado da última sincronização
  (RN-072) ficam na tela de sincronização.

### Evidências fotográficas

- A permissão da câmera é explicada antes do pedido do sistema. Recusar não trava a inspeção:
  o técnico volta ao checklist e, se o Android não perguntar de novo, recebe o atalho para as
  configurações.
- A foto é redimensionada para no máximo 1600 px no lado maior e comprimida em JPEG. Ao lado
  dela fica uma miniatura de 320 px, feita a partir da cópia reduzida. As duas vão para
  `Paths.document/evidences/<inspeção>/`, que o sistema não limpa (RN-047). O banco guarda o
  caminho relativo a esse diretório, porque o iOS muda o caminho absoluto do app a cada
  atualização. O arquivo da câmera, que fica no cache, só é apagado depois que a evidência foi
  salva.
- Formato e tamanho são conferidos antes de salvar (RN-046): JPEG ou PNG, até 5 MB.
- O checklist mostra só as miniaturas, com a marca de envio pendente ou de falha. A foto em resolução integral abre apenas na tela da
  evidência, onde também dá para removê-la enquanto a inspeção está em andamento.
- Bibliotecas: `expo-camera`, `expo-image-manipulator` e `expo-file-system`. O plugin da
  câmera no `app.json` não pede microfone.

### Não conformidades

- O registro nasce de um item do checklist: quando a resposta é "Não conforme" (e a inspeção está
  em andamento), a linha do item **sugere** "Registrar não conformidade", sem obrigar. O item, a
  resposta e a inspeção ficam vinculados sozinhos (RN-052, RN-053); o técnico informa título,
  descrição e criticidade (baixa, média, alta ou crítica, sempre com rótulo em texto).
- O identificador é gerado no aparelho e o registro funciona por inteiro offline, fotos incluídas.
  Gravar a não conformidade enfileira uma operação `CREATE` que espera a da resposta; a foto de
  evidência enfileira um upload que espera a da resposta e a da não conformidade.
- **Criticidade crítica exige descrição e ao menos uma evidência (RN-055).** O registro pode ser
  salvo sem a foto, para o técnico fotografar em seguida, mas o resumo bloqueia a conclusão
  enquanto houver uma não conformidade crítica sem evidência.
- A foto de uma não conformidade usa a mesma captura da evidência do item (`nonConformityId` na
  rota) e volta para a lista de não conformidades. Ela também conta como evidência do item.
- Excluir só é possível enquanto nada foi enviado: a exclusão cancela as operações pendentes e
  remove as fotos do aparelho. Depois do envio não há exclusão (RN-056); a tela avisa.
- Limites de texto (título 120, descrição 2000 caracteres) são do app; reconciliar com o contrato
  do backend#23 quando ele sair.
- O envio segue a ordem do "Outbox": a não conformidade vai depois da resposta, a foto depois
  dela, e a conclusão só depois de tudo.

### Leitura de QR Code

- Dá para ler o QR de dois lugares: a ação rápida da tela inicial, que mostra o equipamento e as
  inspeções dele, e o detalhe da inspeção, que compara o equipamento lido com o previsto.
- Cada código é processado uma única vez por ciclo de leitura. Para ler de novo, o técnico toca em
  "Ler novamente". A câmera só fica ligada enquanto a tela está em foco.
- Todo código lido recebe uma resposta. Um QR vazio ou com mais de 255 caracteres (o limite do
  campo no backend) aparece como equipamento não localizado, sem consultar o servidor. O código é
  comparado exatamente como foi lido ou digitado, com maiúsculas e minúsculas.
- A busca acontece primeiro nas inspeções baixadas no aparelho, pelo código do QR. Na digitação
  manual também vale o número de patrimônio. Se não achar, o app consulta
  `GET /api/v1/equipment/by-qr/{código}`. Sem conexão ou com erro do servidor, a mensagem diz isso,
  em vez de dar o código como desconhecido.
- **Escopo (RN-063)**: o endpoint devolve qualquer equipamento a qualquer usuário autenticado. Por
  isso o app só mostra o resultado se o equipamento pertence a uma inspeção do técnico. Fora disso,
  aparece a mesma mensagem de equipamento não localizado.
- **Divergência (RN-064)**: o app mostra o equipamento previsto e o lido lado a lado. Sair da tela
  com o previsto, pelo botão, pela seta de voltar ou pelo voltar do Android, exige uma confirmação
  explícita. Abrir uma inspeção do equipamento lido não pede essa confirmação. A leitura é opcional
  no fluxo da inspeção, e a confirmação não é gravada, porque o backend ainda não tem onde guardá-la.
- Com a permissão da câmera negada, o técnico pode digitar o código ou o número de patrimônio.

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

Se o login falhar com aviso de falta de conexão mesmo com internet, o endereço configurado
em `EXPO_PUBLIC_API_URL` não é alcançável a partir do aparelho.

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
| `npm test`             | Jest com `jest-expo`, sem aparelho nem rede            |
| `npm run verify`       | Tipos + lint + formatação + testes. Rode antes do PR   |

## Testes

A suíte roda com `npm test`, sem aparelho e sem rede, e reprova o CI quando falha. Cada teste
parte de um banco limpo e não depende da ordem de execução.

- **Banco e outbox contra SQLite real.** Os testes abrem um banco em memória com as migrações
  de verdade ([`openTestDatabase`](src/infrastructure/database/testing/node-sqlite.ts)). Restrição
  de unicidade, transação e migração só aparecem com o banco real, por isso não há duplo do
  repositório nesses testes.
- **Rede simulada.** [`fakeAdapter`](src/infrastructure/api/testing/fake-api.ts) responde no
  lugar do servidor, com o cliente HTTP e o gateway reais: sem conexão, tempo limite, 401, 409
  e erro 5xx.
- **Fixtures compartilhadas** da inspeção baixada e da resposta ficam em
  [`inspection-fixtures.ts`](src/infrastructure/repositories/testing/inspection-fixtures.ts), e o
  helper de renderização dos testes de tela em [`src/testing/render.ts`](src/testing/render.ts).

Cobertura dos doze testes prioritários do documento
[13 - Aplicativo Mobile](https://github.com/FieldOps-Project/docs/blob/main/notion/13-aplicativo-mobile.md)
(13.11):

| #   | Fluxo                                 | Onde está                                                                                                       |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Proteção de rota                      | `features/auth/route-protection.test.tsx`                                                                       |
| 2   | Validação de login                    | `features/auth/screens/login-screen.test.tsx`                                                                   |
| 3   | Renderização de cada tipo de item     | `response-fields.test.tsx`, `checklist-screen.test.tsx`                                                         |
| 4   | Validação de obrigatoriedade          | `domain/checklist-progress.test.ts`, `schemas/checklist-response.test.ts`                                       |
| 5   | Cálculo de progresso                  | `domain/checklist-progress.test.ts`                                                                             |
| 6   | Persistência local de resposta        | `inspection-repository.test.ts` (fechar e reabrir o aplicativo)                                                 |
| 7   | Criação de operação na outbox         | `inspection-repository.test.ts`                                                                                 |
| 8   | Comportamento offline                 | `application/sync/synchronize-offline.test.ts`                                                                  |
| 9   | Redução de operações duplicadas       | `application/sync/synchronize-offline.test.ts` (conta os registros após repetir a mesma operação)               |
| 10  | Permissão negada                      | `evidence-screens.test.tsx`, `scanner-screen.test.tsx`, `location-consent.test.tsx`, `capture-location.test.ts` |
| 11  | Conclusão bloqueada por pendências    | `execution-screens.test.tsx`, `domain/checklist-progress.test.ts`                                               |
| 12  | Apresentação de erro de sincronização | `sync-now-button.test.tsx`, `download-status.test.tsx`, `application/sync/synchronize.test.ts`                  |

## Estrutura

A estrutura segue o documento
[11 - Arquitetura](https://github.com/FieldOps-Project/docs/blob/main/notion/11-arquitetura.md),
seção 11.4. O detalhamento de cada camada e das regras de dependência está em
[`src/README.md`](src/README.md).

```text
src/
├── app/                      # Rotas do Expo Router
├── features/                 # auth, home, inspections, checklist, evidence,
│                             # non-conformities, scanner, location, synchronization
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

**Sessão real.** A sessão nasce do login na API e vive em
[`src/application/session/session-context.tsx`](src/application/session/session-context.tsx).
Enquanto o armazenamento seguro é lido na abertura, os dois grupos mostram a tela de
carregamento, então a tela de login não pisca para quem já entrou.

**Sincronização é aba, não tela escondida.** O documento 13.8 exige que o estado de envio
permaneça visível, e alcance em um toque faz parte disso.

**Contexto preservado entre checklist e câmera.** As rotas de evidência são empilhadas sobre
o checklist e desfeitas com `dismissTo`, de modo que a tela do checklist nunca é
desmontada — a posição de rolagem e o item em foco continuam onde estavam. Dentro do ciclo,
captura e conferência trocam de lugar com `replace` e ocupam uma única entrada da pilha.
Abrir e fechar a câmera várias vezes mantém a profundidade constante. Em build de
desenvolvimento, um indicador na tela mostra o tamanho da pilha para tornar isso
verificável.

## Sessão

**Armazenamento.** `accessToken` e `refreshToken` ficam exclusivamente no
`expo-secure-store` (Keystore no Android), nunca em `AsyncStorage` ou arquivo comum. O
perfil (nome, e-mail, papel) também fica lá. Um perfil guardado sem os tokens é tratado como
sessão encerrada.

**Renovação.** O interceptor de resposta do
[`http-client.ts`](src/infrastructure/api/http-client.ts) trata o 401:

```text
401 -> POST /auth/refresh -> sucesso         -> grava os novos tokens -> repete a requisição 1x
                          -> recusa 401/403  -> encerra a sessão e avisa no login
                          -> falha de rede   -> mantém a sessão e devolve "sem conexão"
```

Requisições que expiram juntas compartilham uma única renovação
([`token-refresh.ts`](src/infrastructure/api/token-refresh.ts)): com refresh token rotativo,
renovações paralelas invalidariam umas às outras. Login, refresh e logout nunca disparam
renovação, e a requisição repetida não renova de novo, então não há laço.

**Sem rede não desloga.** Uma renovação que não alcança o servidor não diz nada sobre a
validade do refresh token. A sessão só termina quando o servidor recusa a renovação.

**Saída.** O perfil pede confirmação antes de sair. A saída apaga primeiro as credenciais
locais e o cache de consultas, e depois tenta revogar o refresh token em
`POST /api/v1/auth/logout`. Sem rede, a pessoa sai do mesmo jeito. Nem a saída nem a
expiração apagam o que foi registrado no aparelho. O comportamento com operações pendentes
na outbox está em
[ADR-001](docs/adr/ADR-001-logout-with-pending-sync.md).

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

**Axios como cliente HTTP.** A instância em
[`src/infrastructure/api/http-client.ts`](src/infrastructure/api/http-client.ts) concentra a
URL base, o tempo limite, a tradução de erro e os interceptors de sessão (token e
renovação), sem que as telas precisem saber deles. A única exceção é a própria renovação,
que usa um cliente sem interceptors para não renovar a si mesma.

**`Result` em vez de exceção para falha esperada.** O aplicativo roda em campo, com rede
intermitente. Sem conexão, credencial inválida e conflito de sincronização são situações
previstas que precisam virar mensagem na tela. Devolver
[`Result`](src/domain/result.ts) obriga quem chama a tratar o erro para conseguir compilar;
`throw` fica para o que é realmente inesperado.

**Sem comentários no código.** Nomes de funções, tipos e testes explicam o comportamento; o
porquê de cada decisão fica na descrição do PR, neste README ou numa ADR. Identificadores ficam
em inglês; texto de interface e mensagem de erro exibida à pessoa usuária continuam em português.

**TanStack Query com padrões para uso em campo.** Dado já carregado continua válido por
alguns minutos e a repetição automática é limitada — insistir em uma requisição sem rede só
gasta bateria. A repetição de operações de escrita fica a cargo da outbox de sincronização
(EP-08), não do cache.

## Contribuição

Fluxo de trabalho, padrão de branch, mensagem de commit e template de PR estão definidos no
[`CONTRIBUTING.md`](https://github.com/FieldOps-Project/docs/blob/main/CONTRIBUTING.md) do
repositório [docs](https://github.com/FieldOps-Project/docs). Em resumo: branch no formato
`<tipo>/<epico>-<slug-curto>` a partir de `develop`, commits em
[Conventional Commits](https://www.conventionalcommits.org/) no modo imperativo e em inglês,
e Pull Request para `develop` usando o template padrão, com CI passando e revisão de outra
pessoa da equipe antes do merge.

Antes de abrir um PR:

```bash
npm run verify
```
