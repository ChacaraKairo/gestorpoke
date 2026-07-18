# Visão do produto

## 1. Nome provisório

**GestorPoke**.

O nome poderá ser alterado antes de uma eventual publicação para reduzir riscos de confusão com marcas oficiais.

## 2. Problema

Jogadores de Pokémon Champions precisam organizar exemplares, configurações de atributos, habilidades, movimentos e equipes. A consulta manual em capturas de tela e anotações soltas dificulta comparar builds, preparar escolhas para batalhas individuais ou em dupla e aprender com partidas anteriores.

## 3. Proposta

Criar um assistente desktop, local e offline-first que concentre:

- catálogo de referência;
- coleção pessoal;
- builds competitivas;
- equipes e planos de seleção;
- análises de tipos e sinergias;
- importação estruturada por JSON;
- histórico de batalhas.

## 4. Público-alvo

Jogadores que:

- montam equipes no Pokémon Champions;
- testam diferentes configurações para um mesmo Pokémon;
- desejam preparar escolhas antes de batalhas;
- registram partidas para melhorar suas decisões;
- preferem uma ferramenta local e organizada.

## 5. Objetivos do produto

### 5.1 Objetivos principais

1. Reduzir o trabalho manual de cadastro.
2. Facilitar a manutenção de múltiplas builds.
3. Ajudar na composição de equipes individuais e duplas.
4. Identificar vulnerabilidades e lacunas de cobertura.
5. Registrar o histórico de decisões e resultados.

### 5.2 Objetivos secundários

- oferecer navegação por teclado e controle;
- funcionar sem conexão depois que o catálogo estiver disponível;
- permitir backup e restauração simples;
- preparar a arquitetura para novas regulamentações.

## 6. Fora do escopo inicial

- automação dentro do jogo;
- leitura da memória do jogo;
- alteração de saves;
- bot para jogar automaticamente;
- cópia exata da interface oficial;
- sincronização em nuvem no MVP;
- simulador integral antes das fórmulas e regras serem confirmadas.

## 7. Princípios de domínio

### 7.1 Espécie não é exemplar

`Eelektross` no catálogo é uma espécie. O Eelektross cadastrado pelo usuário é um exemplar e pode possuir várias builds.

### 7.2 Build não é equipe

Uma build define configuração competitiva. Uma equipe referencia uma build específica de cada integrante.

### 7.3 Regras não são permanentes

Disponibilidade de Pokémon, formas, golpes e mecânicas deve ser associada ao jogo e, quando necessário, à regulamentação.

### 7.4 Dados extraídos são sugestões

JSON gerado por IA a partir de imagem deve ser tratado como entrada não confiável até ser validado e revisado.

## 8. Indicadores de sucesso

O MVP será considerado útil quando o usuário conseguir:

- importar uma captura convertida em JSON;
- revisar e cadastrar o Pokémon corretamente;
- criar duas builds para o mesmo exemplar;
- montar uma equipe com seis builds;
- selecionar participantes para individual ou dupla;
- visualizar fraquezas, resistências e cobertura;
- exportar e restaurar os dados.

## 9. Restrições

- aplicação inicialmente desktop;
- TypeScript como linguagem principal;
- SQLite como banco local;
- imagens oficiais não devem ser redistribuídas sem avaliar licença e autorização;
- o projeto deve informar claramente que é não oficial.

## 10. Evolução desejada

Após o MVP:

1. registro de batalhas;
2. análise de pares em dupla;
3. comparação de builds;
4. estimativa de dano;
5. simulação de seleção;
6. recomendações baseadas no histórico;
7. sincronização opcional entre dispositivos.