# GestorPoke

Assistente local para organizar Pokémon, builds, equipes e estratégias de batalha no Pokémon Champions.

> Projeto não oficial, sem vínculo com Nintendo, Game Freak, The Pokémon Company ou seus parceiros. Pokémon e marcas relacionadas pertencem aos respectivos titulares.

## Objetivo

O GestorPoke será uma aplicação desktop em TypeScript com banco SQLite, voltada para:

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
4. **Toda importação passa por validação e revisão.** Dados extraídos por IA nunca são gravados sem conferência.
5. **A interface tem identidade própria.** A experiência pode lembrar menus de jogos de criaturas e batalhas, mas não deve copiar telas, marcas ou recursos oficiais.
6. **O sistema funciona localmente.** O SQLite é a fonte principal dos dados pessoais.

## Tecnologias propostas

- Electron
- React
- TypeScript
- Vite
- SQLite
- better-sqlite3
- Drizzle ORM
- Zod
- Zustand
- React Hook Form
- Vitest

A escolha final de bibliotecas deve ser registrada em uma decisão arquitetural antes da implementação.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Visão do produto](docs/01-visao-do-produto.md) | Objetivos, público, escopo e restrições |
| [Requisitos funcionais](docs/02-requisitos-funcionais.md) | Capacidades esperadas do sistema |
| [Telas e navegação](docs/03-telas-e-navegacao.md) | Inventário de telas, fluxos e rotas |
| [Design e experiência](docs/04-design-system.md) | Direção visual, componentes e navegação por controle |
| [Arquitetura](docs/05-arquitetura.md) | Camadas, módulos e comunicação Electron |
| [Modelo de dados](docs/06-modelo-de-dados.md) | Entidades, relacionamentos e regras SQLite |
| [Importação e exportação](docs/07-importacao-json.md) | Esquema JSON, validação e importação em lote |
| [Análises e simulações](docs/08-analises-e-simulacoes.md) | Motor de tipos, duplas e evolução do simulador |
| [Segurança e qualidade](docs/09-seguranca-e-qualidade.md) | Validações, testes, backups e privacidade |
| [Roadmap](docs/10-roadmap.md) | Fases, MVP e critérios de conclusão |
| [Padrões do projeto](docs/11-padroes-do-projeto.md) | Estrutura, nomenclatura e fluxo Git |
| [Glossário](docs/12-glossario.md) | Termos de domínio usados no projeto |

## Escopo inicial do MVP

O MVP deve entregar:

- catálogo local de espécies e referências essenciais;
- listagem e cadastro de Pokémon possuídos;
- editor de builds e quatro slots de movimentos;
- montagem de equipes de seis;
- suporte a formato individual e dupla;
- análise básica de tipos e cobertura;
- importação de JSON com múltiplos registros;
- exportação e backup do banco;
- interface responsiva para desktop, teclado e mouse.

Simulação completa por turnos, inteligência de recomendação e sincronização entre dispositivos ficam fora do primeiro MVP.

## Estado do projeto

Documentação inicial em elaboração. A implementação deve começar somente após a revisão do modelo de dados, do contrato JSON e das telas do MVP.