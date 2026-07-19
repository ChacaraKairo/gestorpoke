# GestorPoke

Assistente desktop local para organizar Pokémon, builds, equipes e estratégias de batalha no Pokémon Champions.

> Projeto não oficial, sem vínculo com Nintendo, Game Freak, The Pokémon Company ou seus parceiros. Pokémon e marcas relacionadas pertencem aos respectivos titulares.

## Objetivo

O GestorPoke é um aplicativo Electron + React + TypeScript com SQLite local para:

- consultar espécies, formas, tipos, golpes, habilidades e itens;
- cadastrar Pokémon possuídos e suas fichas;
- manter múltiplas builds por exemplar e marcar uma build principal;
- montar equipes individuais ou em dupla;
- validar regras competitivas e regulamentação Pokémon Champions;
- analisar tipos, cobertura ofensiva e sinergias de duplas;
- importar/exportar dados em JSON com revisão de duplicidades;
- registrar histórico de batalhas e estatísticas;
- criar backup e restaurar o banco SQLite.

## Requisitos

- Node.js 22.12.0 ou superior;
- npm;
- Linux para AppImage local;
- Windows para geração/teste real do instalador NSIS;
- em Linux, ferramentas nativas como `python3`, `make`, `g++`, `libsqlite3-dev` e `libfuse2` quando for executar AppImage diretamente.

## Instalação

```bash
npm ci
```

O `postinstall` executa `electron-builder install-app-deps` para preparar módulos nativos usados pelo Electron. O script de testes reconstrói `better-sqlite3` para o Node antes do Vitest, porque os testes rodam fora do runtime Electron.

## Desenvolvimento

```bash
npm run dev
```

## Comandos

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run dist:linux
npm run dist:win
```

## Estrutura

```text
src/
├── main/       # Electron, SQLite, migrations, repositórios, serviços e IPC
├── preload/    # ponte segura contextBridge/ipcRenderer
├── renderer/   # interface React
└── shared/     # contratos, schemas Zod e regras puras testáveis

src/renderer/src/
├── app/
│   ├── pages/
│   ├── ui.tsx
│   └── modular-pages.css
├── AppV2.tsx
├── overlays/
└── assets/
```

`AppV2.tsx` concentra navegação, carregamento global e estado compartilhado. As páginas principais ficam em `src/renderer/src/app/pages`.

## Banco De Dados

Os dados pessoais ficam em SQLite no diretório de dados do aplicativo, dentro de `data/gestorpoke.sqlite`. O caminho é calculado via `app.getPath("userData")`, então o banco fica fora da pasta de instalação e tende a ser preservado em atualizações.

O processo principal habilita `PRAGMA foreign_keys = ON`, usa WAL e aplica migrations versionadas em `schema_migrations`. Testes de integração usam diretórios temporários e não devem acessar o banco real do usuário.

## Backup E Restauração

Backup usa a API `better-sqlite3#backup` e grava um arquivo `.sqlite` escolhido pelo usuário. A restauração valida o arquivo SQLite com `integrity_check`, verifica tabelas essenciais, cria backup automático do banco atual, fecha a conexão, substitui o banco, reabre e executa migrations.

## Importação JSON

A importação espera `schemaVersion: 1` e `game: "pokemon-champions"`. O fluxo disponível valida schema, mostra prévia de duplicidades e permite políticas por registro:

- `create`: cria novo exemplar;
- `ignore`: ignora o registro;
- `merge`: adiciona build ao Pokémon existente;
- `replace`: substitui o registro existente de forma controlada.

As gravações são transacionais para evitar banco parcialmente alterado.

## Cache De Imagens

O cache aceita apenas URLs HTTPS em hosts permitidos, usa hash estável da URL, valida tipo de conteúdo, limita tamanho e evita baixar novamente arquivos já armazenados. Hoje o renderer recebe Data URLs cacheadas; uma evolução possível é migrar para protocolo local autorizado se o uso de memória crescer.

## Empacotamento

Linux:

```bash
npm run dist:linux
```

Gera `dist/GestorPoke-0.1.0.AppImage`.

Windows:

```bash
npm run dist:win
```

Gera instalador NSIS em `dist/*.exe` quando executado em runner ou máquina Windows.

## CI

`.github/workflows/ci.yml` executa:

- `npm ci`;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`.

`.github/workflows/package.yml` possui jobs separados para Linux AppImage e Windows NSIS, com validação antes do empacotamento e upload de artefatos.

## Documentação Técnica

| Documento | Conteúdo |
| --- | --- |
| [Visão do produto](docs/01-visao-do-produto.md) | Objetivos, público, escopo e restrições |
| [Requisitos funcionais](docs/02-requisitos-funcionais.md) | Capacidades esperadas do sistema |
| [Telas e navegação](docs/03-telas-e-navegacao.md) | Inventário de telas, fluxos e rotas |
| [Design e experiência](docs/04-design-system.md) | Direção visual, componentes e navegação |
| [Arquitetura](docs/05-arquitetura.md) | Camadas, módulos e comunicação Electron |

## Modelo JSON Mínimo

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

## Limitações Conhecidas

- O teste local do AppImage pode exigir `libfuse.so.2`; sem FUSE, use `--appimage-extract` para validação básica.
- O resultado real do workflow Windows precisa ser confirmado no GitHub Actions ou em uma máquina Windows. O ambiente local desta sessão não possui `gh`.
- `npm audit` reporta uma vulnerabilidade alta nas dependências atuais; avaliar correção separadamente para evitar upgrade quebrando Electron/native modules.
