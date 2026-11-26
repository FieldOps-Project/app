# Design system

Tokens, tema e componentes visuais do aplicativo. Camada **visual apenas**: não
importa de rota, feature, aplicação nem infraestrutura (regra verificada pelo
ESLint). Os requisitos vêm do documento
[13 - Aplicativo Mobile](https://github.com/FieldOps-Project/docs/blob/main/notion/13-aplicativo-mobile.md),
seções 13.8 (experiência offline) e 13.9 (usabilidade).

## Tokens

Fonte única em [`tokens/design-tokens.js`](./tokens/design-tokens.js), em
JavaScript porque o `tailwind.config.js` roda como CommonJS fora do bundler. O
mesmo arquivo alimenta as classes utilitárias (via `tailwind.config.js`) e o
tema de navegação, para que a paleta não divirja.

| Token         | Onde                                                                  |
| ------------- | --------------------------------------------------------------------- |
| Cor           | `colors` — `brand`, `neutral`, `success`, `warning`, `danger`, `info` |
| Espaçamento   | `spacing` — `screen`, `field-gap`                                     |
| Raio          | `borderRadius` — `field`, `card`                                      |
| Alvo de toque | `minTouchTarget` — 48 (Android, ≥ 44 dp)                              |
| Tipografia    | escala de `variant` no componente `Text`                              |

Regra: **nenhuma cor literal nos componentes ou telas.** A cor vem sempre de um
token, aplicado por classe utilitária (`bg-brand-600`) ou pelo `tone` do `Text`.
O componente `Text` recusa cor por `className` de propósito — a ordem de
resolução do Tailwind faria a cor perder para a classe de `tone`.

## Componentes

Importe pelo alias `@/`:

```ts
import { Button, Input, Badge, EmptyState } from '@/design-system/components';
```

| Componente      | Papel                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `Screen`        | Área segura + padding padrão; opção `scrollable`.                                   |
| `Text`          | Tipografia por `variant` e cor por `tone`.                                          |
| `Button`        | Ação primária/secundária/perigo; altura mínima de toque; estado `loading`.          |
| `Input`         | Campo de texto com rótulo, dica e **erro ao lado do campo**.                        |
| `Card`          | Superfície de conteúdo com título opcional.                                         |
| `Badge`         | Selo de estado: **cor + ícone + texto**.                                            |
| `Chip`          | Filtro alternável: seleção por preenchimento, ícone e estado anunciado.             |
| `Loading`       | Estado de carregamento em tela cheia.                                               |
| `EmptyState`    | Estado vazio com ícone, texto de negócio e ação opcional.                           |
| `ErrorState`    | Estado de erro com ícone, mensagem de negócio e tentar novamente.                   |
| `OfflineNotice` | Aviso de ausência de conexão, reutilizável em qualquer tela.                        |
| `OptionButton`  | Opção de escolha única, grande para uso com luva; marcada por borda, fundo e ícone. |
| `ProgressBar`   | Barra de progresso sempre acompanhada do valor em texto.                            |

Os selos de **estado de negócio** e de **sincronização** ficam em
[`src/components`](../components) (`InspectionStatusBadge`, `SyncStateBadge`),
porque mapeiam tipos do domínio para `tone`/ícone — o `Badge` em si não conhece
domínio.

### Estado nunca depende só de cor

Selos, avisos e estados combinam **cor, ícone e texto** (13.9). Sob sol forte ou
para quem não distingue matizes, o rótulo e o ícone carregam o significado; a cor
apenas reforça.

## Acessibilidade — verificação

**Alvo de toque.** `Button` e `Input` aplicam `minHeight: minTouchTarget` (48).
Medição: o token é 48 px ≥ 44 dp exigidos por 13.9. Para conferir em execução,
meça o componente renderizado (`onLayout` → `height`) ou inspecione no layout
inspector do React Native — o valor não deve ficar abaixo de 48.

**Contraste** (WCAG AA exige ≥ 4.5:1 para texto normal). Medido no tema claro:

| Par                                     | Contraste |
| --------------------------------------- | --------- |
| Texto padrão sobre fundo de tela        | 17.2:1    |
| Texto secundário (muted) sobre fundo    | 4.55:1    |
| Botão primário (branco sobre brand-600) | 5.83:1    |
| Botão perigo (branco sobre danger)      | 6.47:1    |
| Selo neutro                             | 16.0:1    |
| Selo info / sucesso / alerta / perigo   | 6.4–6.8:1 |
| Aviso offline                           | 6.37:1    |

Todos passam em AA. Recalcule a partir dos tokens sempre que alterar a paleta.

No tema escuro, texto e ícone de selo usam a variante `light` de cada tom (`success`,
`warning`, `danger`, `info`), porque o tom médio da paleta não chega a 4.5:1 sobre as
superfícies escuras. Medido sobre tela (`neutral-950`), cartão (`neutral-900`) e selo
(`neutral-800`):

| Tom     | Antes (tela / cartão / selo) | Agora (tela / cartão / selo) |
| ------- | ---------------------------- | ---------------------------- |
| perigo  | 3.0 / 2.8 / 2.4              | 7.1 / 6.6 / 5.6              |
| info    | 3.3 / 3.1 / 2.6              | 9.1 / 8.5 / 7.2              |
| sucesso | 3.9 / 3.6 / 3.1              | 11.2 / 10.5 / 8.8            |
| alerta  | 3.9 / 3.6 / 3.1              | 11.7 / 11.0 / 9.2            |

## Tema

Os componentes trazem variantes `dark:` e os tokens permitem a troca sem reescrever
componente. Os ícones de selo escolhem o tom pelo esquema de cor ativo.
