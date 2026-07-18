# GestorPoke

Assistente desktop local para organizar Pokémon, builds, equipes e estratégias de batalha no Pokémon Champions.

> Projeto não oficial, sem vínculo com Nintendo, Game Freak, The Pokémon Company ou seus parceiros. Pokémon e marcas relacionadas pertencem aos respectivos titulares.

## Estado atual

A primeira versão funcional já possui:

- aplicação desktop com Electron, React e TypeScript;
- banco SQLite criado automaticamente na pasta de dados do usuário;
- IPC seguro entre interface e processo principal;
- dashboard;
- cadastro, listagem, pesquisa e exclusão de Pokémon;
- criação automática da primeira build;
- criação e listagem inicial de equipes individuais ou em dupla;
- consulta interna de builds para evolução do editor de equipes;
- importação em lote de JSON;
- validação Zod antes da gravação;
- transação SQLite para impedir importação parcial;
- interface própria inspirada em menus de jogos;
- testes iniciais do contrato JSON.

Ainda serão implementados no decorrer do MVP: editor completo de builds, seleção dos seis integrantes, Pokédex importada, analisador de tipos, histórico, backup e empacotamento validado em cada sistema operacional.

## Requisitos

- Node.js 22.12 ou superior;
- npm;
- Linux ou Windows para os primeiros pacotes desktop.

## Executar em desenvolvimento

```bash
npm install
npm run dev
```

## Verificações

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Gerar instalador

Linux:

```bash
npm run dist:linux
```

Windows:

```bash
npm run dist:win
```

## Estrutura

```text
src/
├── main/       # Electron, SQLite, migrations, repositórios e IPC
├── preload/    # ponte segura entre renderer e processo principal
├── renderer/   # interface React
└── shared/     # contratos TypeScript e schemas Zod
```

## Objetivo

O GestorPoke será voltado para:

- consultar um catálogo de espécies, formas, tipos, golpes e habilidades;
- cadastrar os Pokémon possuídos pelo usuário;
- manter várias builds para o mesmo Pokémon;
- editar Stat Alignment, habilidade, movimentos e treinamento;
- montar equipes de até seis integrantes;
- preparar seleções para batalhas individuais e em dupla;
- analisar cobertura, fraquezas, resistências e sinergias;
- importar um ou vários Pokémon por JSON produzido a partir de capturas de tela;
- registrar batalhas e usar os resultados para aprimorar equipes.

## Princípios

1. **Dados de referência e dados pessoais são separados.** Uma espécie da Pokédex não é o mesmo que um exemplar possuído.
2. **A equipe referencia builds.** Cada integrante usa uma configuração competitiva específica.
3. **As regras são versionadas.** Regulamentações, disponibilidade e limites não são codificados como constantes permanentes.
4. **Toda importação passa por validação e revisão.** Dados extraídos por IA nunca são considerados confiáveis sem validação.
5. **A interface tem identidade própria.** Ela pode lembrar menus de jogos, mas não copia telas, marcas ou recursos oficiais.
6. **O sistema funciona localmente.** O SQLite é a fonte principal dos dados pessoais.

## Tecnologias

- Electron
- React
- TypeScript
- electron-vite e Vite
- SQLite e better-sqlite3
- Zod
- Vitest

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Visão do produto](docs/01-visao-do-produto.md) | Objetivos, público, escopo e restrições |
| [Requisitos funcionais](docs/02-requisitos-funcionais.md) | Capacidades esperadas do sistema |
| [Telas e navegação](docs/03-telas-e-navegacao.md) | Inventário de telas, fluxos e rotas |
| [Design e experiência](docs/04-design-system.md) | Direção visual, componentes e navegação |
| [Arquitetura](docs/05-arquitetura.md) | Camadas, módulos e comunicação Electron |

## Modelo JSON mínimo

```json
{
  "schemaVersion": 1,
  "game": "pokemon-champions",
  "pokemon": [
    {
      "species": {
        "nationalDexNumber": 604,
        "name": "Eelektross",
        "form": "default",
        "types": ["electric"]
      },
      "ownedPokemon": {
        "ownershipStatus": "permanent",
        "acquisitionSource": "champions"
      },
      "build": {
        "name": "Build principal",
        "format": "both",
        "ability": "Levitate",
        "statAlignment": "Lonely",
        "moves": []
      }
    }
  ]
}
```

## Observação de validação

O código foi escrito no repositório, mas o ambiente desta sessão não conseguiu resolver o domínio do GitHub para clonar e executar `npm install`. Portanto, os comandos de instalação, typecheck e build ainda precisam ser executados localmente ou pelo CI antes de considerar o pacote validado.