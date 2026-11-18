# Auditoria de estados de interface

Uma linha por tela e uma coluna por estado (card #32). Célula vazia é trabalho pendente. A
auditoria vale para o estado do código em `develop` e foi feita lendo cada tela.

Os dados das inspeções vivem no SQLite do aparelho, então "offline" nas telas de execução não é
uma falha: a tela funciona e diz isso. O estado offline aparece onde há chamada ao servidor.

| Tela                 | Carregando                         | Vazio                                   | Erro                                        | Offline                                          |
| -------------------- | ---------------------------------- | --------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| Login                | botão com indicador de carga       | não se aplica                           | credencial inválida e falha do servidor     | aviso "Sem conexão com o servidor"               |
| Início               | "Carregando inspeções do aparelho" | bloco de cada filtro diz que está livre | falha ao ler o aparelho, com nova tentativa | `DownloadStatus` e botão Sincronizar             |
| Lista de inspeções   | "Carregando inspeções do aparelho" | sem inspeções e sem resultado de filtro | falha ao ler o aparelho, com nova tentativa | `DownloadStatus` mostra o que está salvo         |
| Detalhe da inspeção  | "Abrindo inspeção"                 | inspeção não encontrada                 | falha ao abrir, com nova tentativa          | funciona offline; estado de envio no cabeçalho   |
| Iniciar inspeção     | "Abrindo inspeção"                 | inspeção não encontrada                 | falha ao abrir e ao gravar o início         | diz que funciona sem internet                    |
| Checklist            | "Montando o checklist"             | inspeção não encontrada                 | falha ao abrir e ao salvar a resposta       | funciona offline; envio na próxima sincronização |
| Resumo e conclusão   | carregando a inspeção              | inspeção não encontrada                 | falha ao abrir e ao concluir                | diz que concluir não é enviar; botão Sincronizar |
| Captura de evidência | aguarda a permissão da câmera      | não se aplica                           | permissão negada, com caminho de volta      | fotos ficam no aparelho até o envio              |
| Conferir evidência   | não se aplica                      | volta ao checklist se não há foto       | falha ao guardar, mantém a foto             | grava no aparelho                                |
| Ver evidência        | "Carregando"                       | evidência não encontrada                | falha ao abrir e ao excluir                 | arquivo local                                    |
| Leitor de QR Code    | "Carregando"                       | código não localizado                   | falha da busca, com nova tentativa          | diz que o servidor não pôde ser consultado       |
| Sincronização        | "Contando registros"               | "Tudo enviado"                          | falha ao contar e ao ler                    | resultado do botão Sincronizar sem conexão       |
| Fila de envio        | "Contando registros"               | "Nenhum registro pendente"              | falha ao contar                             | resultado do botão Sincronizar sem conexão       |
| Não conformidades    | não se aplica                      | "Registro em breve", com saída          | não se aplica                               | não se aplica                                    |
| Perfil               | não se aplica                      | não se aplica                           | não se aplica                               | saída explica que entrar de novo exige internet  |

A auditoria descreve o comportamento que já existia. Só as telas de sincronização, fila de envio e
não conformidades mudaram neste card.

## Linguagem de negócio

- Recusa de negócio do servidor (400 e 422) é descrita por um mapa de código para frase em
  [`api-failure.ts`](../src/infrastructure/api/api-failure.ts), com uma frase genérica para código
  desconhecido. O texto que o servidor envia nunca chega à tela.
- Telas provisórias deixaram de citar épicos e de mostrar o identificador da inspeção.

## Acessibilidade

Verificado lendo os componentes e as telas; nenhuma correção foi necessária além das citadas acima.

- Todo elemento interativo do design system (`Button`, `OptionButton`, `Chip`) tem papel, rótulo e
  estado acessíveis e altura mínima de 48 pt (`minTouchTarget`); as miniaturas têm 64 pt e as
  abas de seção e a lista de pendências, 48 pt.
- Os cartões tocáveis da lista e do início declaram papel de botão e dica; o início também compõe
  o rótulo com a contagem.
- Estado nunca depende só de cor: `Badge` leva texto e ícone, `OptionButton` troca o ícone ao
  selecionar, `Chip` mostra um visto, a barra de progresso tem rótulo e as seções do checklist
  dizem "Seção completa".
- Avisos e erros usam `accessibilityRole="alert"`, e os textos de carregamento das telas de
  sincronização usam região viva educada.

## Desempenho

- Listas de inspeções, do checklist e das não enviadas usam `FlatList`.
- Fotos aparecem como miniatura de 64 px; o arquivo original só é aberto na tela de evidência.
- `checklist-rendering.test.tsx` mede quantas linhas renderizam: digitar em um item não renderiza
  as vizinhas, e salvar uma resposta renderiza só a linha dela.

## Pendente

- Medir rolagem com 200 inspeções e digitação com 100 itens em um Android físico modesto (o
  critério do card pede o aparelho; este ambiente não tem emulador Android).
- Contraste de cor medido em tela, nos modos claro e escuro.
