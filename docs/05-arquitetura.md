# Arquitetura técnica

## 1. Visão geral

Aplicação desktop local, modular e offline-first:

```text
Renderer React
    ↓ contratos tipados
Preload seguro
    ↓ IPC validado
Electron Main
    ↓ serviços e repositórios
SQLite + arquivos locais
```

## 2. Responsabilidades

### Renderer

- interface;
- estado de navegação;
- formulários;
- pré-visualização de importação;
- apresentação das análises;
- nenhuma consulta direta ao SQLite.

### Preload

Expõe uma API mínima por `contextBridge`. Não deve oferecer acesso genérico ao sistema de arquivos, shell ou Node.js.

### Main

- inicialização do banco;
- migrations;
- repositórios;
- transações;
- importação e exportação;
- leitura e gravação de arquivos autorizados;
- backup;
- handlers IPC;
- logs locais.

### Shared

- tipos;
- schemas Zod;
- códigos de erro;
- DTOs;
- regras puras;
- normalização de nomes;
- contratos de IPC.

## 3. Estrutura proposta

```text
gestorpoke/
├── apps/
│   └── desktop/
│       ├── src/main/
│       ├── src/preload/
│       └── src/renderer/
├── packages/
│   ├── domain/
│   ├── database/
│   ├── shared/
│   └── ui/
├── scripts/
│   ├── import-catalog.ts
│   ├── validate-catalog.ts
│   └── verify-assets.ts
├── docs/
├── assets/
└── package.json
```

Um monorepo só deve ser adotado caso essa separação traga benefício real. Para o primeiro código, uma estrutura única também é aceitável.

## 4. Módulos de domínio

- catálogo;
- coleção;
- builds;
- equipes;
- regras e regulamentações;
- batalhas;
- análises;
- importação;
- exportação e backup;
- configurações.

Nenhum módulo deve depender da interface para executar suas regras.

## 5. Padrão de aplicação

Fluxo recomendado:

```text
UI → comando/consulta → serviço de aplicação → domínio → repositório
```

Exemplo:

```text
ImportReviewPage
→ validateImportCommand
→ ImportService
→ ReferenceResolver + DuplicateDetector
→ ImportRepository
```

## 6. Banco e ORM

- SQLite com `PRAGMA foreign_keys = ON`;
- modo WAL quando compatível;
- migrations versionadas;
- `better-sqlite3` para acesso síncrono no processo principal;
- Drizzle ORM para schema e consultas tipadas;
- transações para importação, atualização de catálogo e backup lógico.

## 7. IPC

Todo canal deve possuir:

- nome explícito;
- schema de entrada;
- schema de saída;
- código de erro conhecido;
- handler único.

Exemplo conceitual:

```ts
type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

Evitar canais genéricos como `executeSql`, `readAnyFile` ou `invokeMethod`.

## 8. Dados de catálogo

O catálogo deve ser importado por scripts e versionado separadamente dos dados pessoais. Atualizações devem usar `upsert` por identificador estável e nunca apagar builds pessoais por cascata.

## 9. Imagens

Guardar no banco apenas metadados e caminhos relativos. Categorias:

- assets distribuídos com a aplicação;
- cache de catálogo;
- imagens personalizadas do usuário.

A ausência de imagem deve usar placeholder e não impedir o cadastro.

## 10. Análises

O motor deve ser composto por funções puras:

- multiplicador de tipos;
- cobertura ofensiva;
- vulnerabilidade defensiva;
- validação de equipe;
- análise de pares;
- regras de alvo em dupla.

Isso facilita testes e futuras versões web/mobile.

## 11. Configuração

Preferências simples podem ficar em arquivo próprio. Dados relacionais e histórico ficam no SQLite. Segredos, caso existam no futuro, não devem ser versionados.

## 12. Decisões pendentes

Antes da implementação, registrar ADRs para:

1. monorepo ou aplicação única;
2. Drizzle versus SQL explícito;
3. distribuição de imagens;
4. biblioteca de navegação espacial por controle;
5. estratégia de atualização do catálogo;
6. empacotamento e auto-update.