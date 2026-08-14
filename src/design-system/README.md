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

| Componente      | Papel                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `Screen`        | Área segura + padding padrão; opção `scrollable`.                          |
| `Text`          | Tipografia por `variant` e cor por `tone`.                                 |
| `Button`        | Ação primária/secundária/perigo; altura mínima de toque; estado `loading`. |
| `Input`         | Campo de texto com rótulo, dica e **erro ao lado do campo**.               |
| `Card`          | Superfície de conteúdo com título opcional.                                |
| `Badge`         | Selo de estado: **cor + ícone + texto**.                                   |
| `List`          | Lista mapeada (compõe dentro do `Screen`) com estado vazio embutido.       |
| `Loading`       | Estado de carregamento em tela cheia.                                      |
| `EmptyState`    | Estado vazio com ícone, texto de negócio e ação opcional.                  |
| `ErrorState`    | Estado de erro com ícone, mensagem de negócio e tentar novamente.          |
| `OfflineNotice` | Aviso de ausência de conexão, reutilizável em qualquer tela.               |

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

## Tema

MVP em **tema claro**. O tema escuro é P1: os componentes já trazem variantes
`dark:`, e os tokens viabilizam a troca sem reescrever componente. Os ícones de
selo usam o tom médio da paleta, legível tanto no fundo claro quanto no escuro.
