# Requisitos funcionais

## 1. Convenções

- `RF`: requisito funcional.
- `RNF`: requisito não funcional.
- Prioridades: `MVP`, `Pós-MVP`, `Futuro`.

## 2. Catálogo

### RF-CAT-001 — Consultar Pokédex

O sistema deve listar espécies com número nacional, nome, imagem, tipos, geração e formas.

**Prioridade:** MVP.

### RF-CAT-002 — Pesquisar e filtrar

Deve ser possível filtrar por nome, número, tipo, geração, forma e disponibilidade no Pokémon Champions.

**Prioridade:** MVP.

### RF-CAT-003 — Consultar detalhes

A espécie deve exibir atributos de referência, tipos, formas, habilidades e movimentos relacionados.

**Prioridade:** MVP.

### RF-CAT-004 — Manter aliases

O catálogo deve aceitar aliases localizados para espécies, golpes, habilidades, formas e Stat Alignments.

**Prioridade:** MVP.

### RF-CAT-005 — Versionar disponibilidade

Disponibilidade deve ser associada ao jogo e opcionalmente à regulamentação.

**Prioridade:** Pós-MVP.

## 3. Coleção pessoal

### RF-COL-001 — Cadastrar exemplar

O usuário deve cadastrar espécie, forma, apelido, sexo, origem, situação de recrutamento, favorito e notas.

**Prioridade:** MVP.

### RF-COL-002 — Editar e excluir

O usuário deve editar e excluir exemplares, com confirmação para operações destrutivas.

**Prioridade:** MVP.

### RF-COL-003 — Múltiplos exemplares

O sistema deve permitir vários exemplares da mesma espécie e forma.

**Prioridade:** MVP.

### RF-COL-004 — Status de posse

Estados iniciais: permanente, teste e visitante.

**Prioridade:** MVP.

## 4. Builds

### RF-BLD-001 — Criar build

Cada exemplar deve aceitar uma ou mais builds.

### RF-BLD-002 — Configurar build

Campos mínimos:

- nome;
- formato recomendado;
- Stat Alignment;
- habilidade;
- quatro movimentos;
- valores finais dos seis atributos;
- pontos de treinamento;
- modificador positivo, negativo ou neutro;
- função estratégica;
- observações.

### RF-BLD-003 — Validar movimentos

Não pode haver mais de quatro movimentos nem slots duplicados.

### RF-BLD-004 — Comparar builds

O usuário deve comparar duas builds do mesmo ou de diferentes exemplares.

**Prioridade:** Pós-MVP.

### RF-BLD-005 — Duplicar build

O usuário deve copiar uma build para realizar ajustes sem alterar a original.

**Prioridade:** MVP.

## 5. Equipes

### RF-TEAM-001 — Criar equipe

Uma equipe deve possuir nome, formato, regulamentação opcional, descrição e até seis integrantes.

### RF-TEAM-002 — Referenciar build

Cada integrante deve apontar para uma build específica.

### RF-TEAM-003 — Reordenar integrantes

A ordem deve ser alterável por arraste, teclado ou comandos equivalentes.

### RF-TEAM-004 — Validar equipe

O sistema deve apresentar erros e avisos relacionados a quantidade, repetição, disponibilidade e regulamentação.

### RF-TEAM-005 — Duplicar e exportar

Equipes devem poder ser duplicadas e exportadas.

## 6. Batalhas

### RF-BAT-001 — Formato individual

O sistema deve suportar equipe registrada, seleção de participantes, inicial e reservas.

### RF-BAT-002 — Formato dupla

O sistema deve suportar dupla inicial, reservas e interações entre parceiros.

### RF-BAT-003 — Regras configuráveis

Tamanho de equipe, quantidade selecionada e quantidade ativa devem vir de um conjunto de regras.

### RF-BAT-004 — Planos de batalha

O usuário deve salvar planos de seleção para cenários ou adversários.

**Prioridade:** Pós-MVP.

### RF-BAT-005 — Histórico

O usuário deve registrar resultado, seleção, formato, equipe, adversário e observações.

**Prioridade:** Pós-MVP.

## 7. Análises

### RF-ANL-001 — Efetividade defensiva

Calcular fraquezas, resistências e imunidades da equipe.

### RF-ANL-002 — Cobertura ofensiva

Calcular quais tipos são atingidos de forma super efetiva pelos movimentos disponíveis.

### RF-ANL-003 — Distribuição de funções

Exibir funções presentes e possíveis lacunas.

### RF-ANL-004 — Sinergia em dupla

Avaliar fraquezas compartilhadas, imunidades, movimentos que atingem parceiro, clima, terreno e suporte.

**Prioridade:** Pós-MVP.

### RF-ANL-005 — Recomendações explicáveis

Toda sugestão deve indicar os fatos que a originaram.

**Prioridade:** Futuro.

## 8. Importação e exportação

### RF-IMP-001 — Importar arquivo JSON

Aceitar um arquivo com um ou vários Pokémon.

### RF-IMP-002 — Colar JSON

Permitir validação de conteúdo colado diretamente na interface.

### RF-IMP-003 — Revisar antes de salvar

Mostrar resumo, erros, avisos, duplicidades e correspondências antes da gravação.

### RF-IMP-004 — Resolver nomes

Relacionar nomes recebidos a aliases do catálogo e permitir correção manual.

### RF-IMP-005 — Importação transacional

Nenhum lote pode deixar o banco parcialmente gravado em caso de falha.

### RF-IMP-006 — Exportar

Permitir exportação de exemplar, build, equipe ou backup completo.

### RF-IMP-007 — Histórico de lotes

Registrar arquivo, origem, resultado e registros afetados.

**Prioridade:** Pós-MVP.

## 9. Configurações e dados

### RF-CFG-001 — Tema e idioma

Disponibilizar preferências de aparência e idioma.

### RF-CFG-002 — Pasta de dados

Exibir o caminho do banco, imagens e backups.

### RF-CFG-003 — Backup e restauração

Criar, validar e restaurar backups.

### RF-CFG-004 — Atualização do catálogo

Importar novas versões do catálogo preservando dados pessoais.

## 10. Requisitos não funcionais

### RNF-001 — Operação local

O sistema deve funcionar offline após a carga do catálogo.

### RNF-002 — Integridade

SQLite deve usar chaves estrangeiras, migrations e transações.

### RNF-003 — Tipagem

Comunicação entre interface e processo principal deve usar contratos TypeScript e validação de runtime.

### RNF-004 — Segurança do Electron

`contextIsolation` deve estar ativo; a interface não acessará Node.js diretamente.

### RNF-005 — Desempenho

Listagens devem usar paginação ou virtualização quando necessário.

### RNF-006 — Acessibilidade

Todas as ações essenciais devem funcionar por teclado, com foco visível e contraste adequado.

### RNF-007 — Testabilidade

Regras de domínio devem ser independentes da interface e cobertas por testes automatizados.

### RNF-008 — Observabilidade local

Erros devem gerar logs sem registrar conteúdo sensível desnecessário.