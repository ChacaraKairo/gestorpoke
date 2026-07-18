# Design system e experiência

## 1. Direção visual

A interface deve transmitir a sensação de um menu de jogo de batalha e coleção, sem copiar telas oficiais. Características:

- painéis translúcidos;
- fundos com gradientes e movimento discreto;
- cards grandes;
- cores dos tipos usadas como acentos;
- foco evidente para teclado e controle;
- transições curtas;
- área inferior com comandos disponíveis;
- tipografia legível em monitores e notebooks.

## 2. Identidade própria

Não utilizar:

- logotipos oficiais;
- fontes proprietárias extraídas de jogos;
- reprodução pixel a pixel de telas;
- ícones ou efeitos sonoros retirados dos jogos.

Criar componentes, símbolos, fundos e ícones próprios.

## 3. Estrutura da aplicação

### GameShell

Componente raiz contendo:

- barra superior de contexto;
- área principal;
- camadas de modal;
- barra inferior de comandos;
- sistema global de foco.

### Barra superior

Pode mostrar:

- título da área;
- regulamentação ativa;
- equipe selecionada;
- indicador de alterações não salvas;
- acesso às configurações.

### Barra inferior

Mostra ações conforme a tela:

```text
A Confirmar   B Voltar   X Opções   Y Pesquisa
```

No desktop, deve exibir os atalhos reais configurados.

## 4. Tokens

### Espaçamento

Escala sugerida: `4, 8, 12, 16, 24, 32, 48, 64`.

### Bordas

- pequenas: 8 px;
- cards: 16 px;
- painéis destacados: 24 px;
- pílulas e badges: 999 px.

### Camadas

- fundo;
- superfície base;
- painel translúcido;
- card;
- seleção;
- modal;
- notificação.

### Movimento

- foco: 100–160 ms;
- troca de painel: 180–240 ms;
- modal: 160–220 ms;
- respeitar `prefers-reduced-motion`.

## 5. Cores por tipo

As cores de tipo são detalhes semânticos, não o fundo integral da página. Criar tokens próprios:

```ts
export type PokemonTypeCode =
  | "normal" | "fire" | "water" | "electric" | "grass"
  | "ice" | "fighting" | "poison" | "ground" | "flying"
  | "psychic" | "bug" | "rock" | "ghost" | "dragon"
  | "dark" | "steel" | "fairy";
```

Cada tipo terá tokens de `surface`, `border`, `text` e `glow`, garantindo contraste.

## 6. Componentes

- `GameShell`;
- `TopStatusBar`;
- `BottomControlBar`;
- `GameMenuCard`;
- `PokemonGrid`;
- `PokemonSlot`;
- `PokemonSummaryPanel`;
- `TypeBadge`;
- `StatBar`;
- `MoveSlot`;
- `AbilityPanel`;
- `TeamSlot`;
- `BattleSelectionSlot`;
- `GameTabs`;
- `GameDialog`;
- `FilterDrawer`;
- `AnalysisAlert`;
- `ImportScanner`;
- `EmptyState`;
- `LoadingPanel`.

## 7. Box de Pokémon

Layout recomendado:

- grade à esquerda ou no centro;
- painel de detalhes à direita;
- filtros em gaveta;
- seleção mantém foco e atualiza o painel sem navegar imediatamente;
- duplo clique, Enter ou comando equivalente abre detalhes.

## 8. Resumo e editor

A tela deve usar três colunas:

1. atributos;
2. imagem ou modelo do Pokémon;
3. movimentos e habilidade.

Em telas menores, transformar em abas ou painéis empilhados.

## 9. Equipes

Exibir seis slots em duas linhas de três ou uma faixa adaptável. Cada slot mostra:

- imagem;
- nome ou apelido;
- tipos;
- build;
- estado de validade;
- posição.

## 10. Acessibilidade

- contraste mínimo adequado;
- foco nunca depender apenas de cor;
- textos alternativos para imagens;
- escala de interface;
- modo de movimento reduzido;
- ações essenciais por teclado;
- mensagens de erro próximas ao campo;
- sons sempre opcionais.

## 11. Responsividade

Larguras-alvo:

- compacto: 1024 px;
- padrão: 1280–1600 px;
- amplo: acima de 1600 px.

O MVP desktop não deve exigir tela 4K nem orientação específica.