# Telas e navegação

## 1. Navegação principal

Menu inicial com aparência de jogo:

- Início;
- Pokédex;
- Meus Pokémon;
- Equipes;
- Preparar batalha;
- Análises;
- Importar e exportar;
- Histórico;
- Configurações.

Atalhos-base no desktop:

- setas ou WASD: mover foco;
- Enter: confirmar;
- Esc: voltar;
- E: editar ou detalhes;
- F: filtros;
- Tab: trocar de região.

## 2. Inventário de telas

### 2.1 Início

Dashboard com contadores, equipes favoritas, Pokémon recentes, última importação e ações rápidas.

### 2.2 Pokédex

Grade de espécies com pesquisa, filtros e painel lateral. Ações: abrir detalhes, cadastrar exemplar e comparar.

### 2.3 Detalhes da espécie

Exibe identificação, formas, tipos, atributos de referência, habilidades, movimentos e exemplares possuídos.

### 2.4 Meus Pokémon

Tela semelhante a uma box: grade de miniaturas e painel de resumo do item selecionado.

### 2.5 Cadastro de exemplar

Fluxo em etapas:

1. identificação;
2. origem e situação;
3. primeira build opcional;
4. revisão.

### 2.6 Detalhes do exemplar

Abas: Resumo, Builds, Equipes, Batalhas e Notas.

### 2.7 Editor de build

Tela inspirada em menus de treinamento, com três áreas:

- atributos;
- visualização do Pokémon;
- habilidade, Stat Alignment e movimentos.

### 2.8 Seletor de movimento

Catálogo filtrável com detalhes, categoria, alvo e alertas para batalhas em dupla.

### 2.9 Comparação de builds

Comparação lado a lado de atributos, movimentos, habilidade, função e formato.

### 2.10 Equipes

Lista de equipes com seis miniaturas, formato, regulamentação e validade.

### 2.11 Editor de equipe

Seis slots que referenciam builds. Permite reordenar, substituir, abrir build e validar regras.

### 2.12 Detalhes da equipe

Abas: Resumo, Integrantes, Planos, Análise, Histórico e Notas.

### 2.13 Preparar batalha

Fluxo:

1. escolher equipe;
2. escolher regra e formato;
3. registrar equipe adversária opcional;
4. selecionar participantes;
5. definir inicial ou dupla inicial;
6. revisar alertas;
7. salvar plano ou iniciar registro.

### 2.14 Analisador de equipe

Painéis de defesa, ataque, funções, velocidade, validade e sinergias.

### 2.15 Análise de dupla

Compara dois parceiros ativos e avalia interações ofensivas, defensivas e de campo.

### 2.16 Simulador de confronto

Pós-MVP. Recebe atacante, defensor, parceiros e condições de campo.

### 2.17 Histórico de batalhas

Lista filtrável com data, resultado, formato, equipe, regulamentação e adversário.

### 2.18 Detalhes da batalha

Exibe seleção, leads, resultado, notas, eventos e conclusões.

### 2.19 Importar JSON

Entrada por arquivo, arrastar e soltar ou colagem.

### 2.20 Revisão da importação

Lista todos os registros com estados: válido, revisar, inválido ou duplicidade.

### 2.21 Resolver referência

Associa texto recebido a espécie, forma, golpe, habilidade ou alinhamento do catálogo.

### 2.22 Resolver duplicidade

Opções: criar exemplar, atualizar, criar build, substituir build ou ignorar.

### 2.23 Resultado da importação

Resumo de criados, atualizados, ignorados e falhas.

### 2.24 Exportar e backup

Exportação por entidade e backup completo.

### 2.25 Catálogos administrativos

Listas de golpes, habilidades, tipos, Stat Alignments e regulamentações.

### 2.26 Configurações

Aparência, dados, importação, catálogo, atalhos, backup e informações do aplicativo.

## 3. Rotas propostas

```ts
export const routes = {
  home: "/",
  pokedex: "/pokedex",
  species: "/pokedex/:speciesId",
  ownedPokemon: "/pokemon",
  newPokemon: "/pokemon/new",
  pokemon: "/pokemon/:pokemonId",
  editPokemon: "/pokemon/:pokemonId/edit",
  newBuild: "/pokemon/:pokemonId/builds/new",
  build: "/builds/:buildId",
  editBuild: "/builds/:buildId/edit",
  teams: "/teams",
  newTeam: "/teams/new",
  team: "/teams/:teamId",
  editTeam: "/teams/:teamId/edit",
  prepareBattle: "/battle/prepare",
  battles: "/battles",
  battle: "/battles/:battleId",
  teamAnalysis: "/analysis/team/:teamId",
  pairAnalysis: "/analysis/pair",
  importJson: "/import",
  importReview: "/import/review/:batchId",
  exportData: "/export",
  settings: "/settings"
} as const;
```

## 4. MVP de telas

1. Início;
2. Pokédex;
3. Detalhes da espécie;
4. Meus Pokémon;
5. Cadastro e edição;
6. Detalhes do exemplar;
7. Editor de build;
8. Equipes;
9. Editor de equipe;
10. Analisador básico;
11. Importação e revisão JSON;
12. Configurações e backup.

## 5. Estados obrigatórios

Toda tela de dados deve prever:

- carregando;
- vazio;
- erro recuperável;
- sem resultado de busca;
- confirmação de exclusão;
- alterações não salvas;
- sucesso de operação.