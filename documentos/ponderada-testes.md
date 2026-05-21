# Ponderada — Suite de Testes de Integração (TDD)

## Fluxo escolhido: `POST /cadastros`

### Justificativa de escolha

O fluxo `POST /cadastros` representa o momento em que o agente de campo Josias termina uma vistoria e registra o responsável pela família no sistema. É o ponto de origem de toda a cadeia de operações do GeoRisco Santo André: sem o cadastro do chefe de família não existe núcleo familiar, não existe classificação de risco, não existe histórico de atendimento.

Esse endpoint foi escolhido porque concentra a maior variedade de regras de negócio implementadas no WAD: normalização de texto antes da persistência (RN008), limpeza de máscara de documento (RN009), unicidade de identificador ativo (RN001) e validação matemática do CPF pelo algoritmo da Receita Federal (RN017). Cada uma dessas regras gera um comportamento observável distinto no banco de dados, o que permite montar quatro casos de teste com assertivas concretas e sem sobreposição.

A integração externa presente no fluxo, o `notificationService` que dispara um webhook para o sistema da Prefeitura, é substituída por `jest.mock()`. Isso isola o teste do comportamento de rede e garante que uma falha de conectividade nunca cause falha de teste.

---

## Matriz RF → RN → Teste

| RF    | RN    | Tipo de caso              | Caso de teste                                                        |
|-------|-------|---------------------------|----------------------------------------------------------------------|
| RF001 | RN008 | Sucesso                   | Nome com acentos e capitalização mista normalizado para CAIXA ALTA   |
| RF001 | RN001 | Regra de negócio violada  | CPF já ativo no sistema retorna HTTP 409 Conflict                    |
| RF001 | RN017 | Payload inválido          | CPF com dígitos verificadores matematicamente incorretos retorna 400 |
| RF001 | RN009 | Persistência no banco     | CPF recebido com máscara gravado sem formatação no banco             |

---

## Descrição dos casos

### Caso 1 — Sucesso (RN008)

O agente de campo digita o nome como aparece no documento físico, com acentos e letras misturadas. A regra RN008 exige que o sistema normalize para CAIXA ALTA sem acentuação antes de persistir, porque buscas futuras precisam encontrar "Ângela da Silva" mesmo quando o operador digitar "angela da silva" na busca.

O teste envia `nome: 'ângela da Silva'` e verifica duas coisas: a resposta HTTP 201 deve trazer o nome já como `'ANGELA DA SILVA'`, e uma consulta direta ao banco pelo `id` retornado confirma que o valor armazenado também é o normalizado. Esse assert duplo é necessário porque o service poderia normalizar na resposta sem normalizar antes do INSERT, e só a leitura do banco revela essa inconsistência.

---

### Caso 2 — Regra de negócio violada (RN001)

RN001 proíbe dois registros com o mesmo CPF ativos simultaneamente. O que torna esse caso distinto de um erro de formato é que o payload enviado é perfeitamente válido: CPF correto, data de nascimento no passado, nome preenchido. O sistema entende o pedido, mas não consegue atendê-lo porque já existe um CPF ativo com esse número. Essa situação é um conflito de estado, não um problema com o dado em si, e por isso o código de resposta correto é 409 Conflict e não 400 Bad Request.

O teste insere diretamente no banco um registro com `status = 'ATIVO'` usando o mesmo CPF, depois tenta criar um novo cadastro com esse CPF pela API. Verifica que a resposta é 409 com mensagem referenciando o CPF, e confirma que o banco ainda tem exatamente um registro para aquele CPF com status ATIVO.

---

### Caso 3 — Payload inválido (RN017)

Esse caso testa o ramo matemático da validação de CPF. O número enviado tem exatamente 11 dígitos, então passa pelo filtro de comprimento sem problema. A rejeição acontece no passo seguinte, quando o algoritmo calcula os dígitos verificadores e percebe que os dois últimos não batem com o esperado. Testar esse ramo separadamente importa porque um CPF pode ter comprimento correto e ainda assim ser inválido, e esses são dois pontos de falha independentes no mesmo fluxo de validação.

O teste envia `cpf: '12345678900'`, que tem 11 dígitos mas verificadores incorretos, e espera HTTP 400 com mensagem referenciando o CPF. Consulta o banco ao final e confirma que nenhuma linha foi inserida.

---

### Caso 4 — Persistência no banco (RN009)

Os documentos físicos que Josias carrega em campo mostram o CPF formatado com pontos e traço. O formulário repassa esse valor diretamente para a API. RN009 exige que o sistema remova a máscara antes de persistir, armazenando apenas os 11 dígitos numéricos. Isso garante consistência nas buscas e evita duplicidade por variações de formatação.

O teste envia `cpf: '111.444.777-35'` e, após receber HTTP 201, consulta o banco diretamente pelo `id` retornado. O valor encontrado deve ser `'11144477735'`, sem pontos nem traço. A consulta ao banco é o que valida a persistência real e não apenas o que a API decidiu retornar no corpo da resposta.

---

## Estrutura dos arquivos

```
src/
├── models/
│   └── cadastro.ts                  ← tipos Cadastro e CreateCadastroDto
├── repositories/
│   └── cadastroRepository.ts        ← INSERT e SELECT na tabela chefe_da_familia
├── services/
│   ├── notificationService.ts       ← integração externa (mockada nos testes)
│   └── cadastroService.ts           ← regras RN001, RN008, RN009, RN017, RN020
├── controllers/
│   └── cadastroController.ts        ← handler HTTP
├── routes/
│   └── cadastroRoutes.ts            ← POST /cadastros
└── tests/
    └── cadastros.spec.ts            ← suite de integração (4 casos)
```

**Infraestrutura de teste:**

| Arquivo                  | Papel                                                                 |
|--------------------------|-----------------------------------------------------------------------|
| `jest.globalSetup.js`    | Sobe PostgreSQL 18.3 real via embedded-postgres em porta dinâmica    |
| `jest.globalTeardown.js` | Para o PostgreSQL ao final de toda a suite                           |
| `jest.setup.env.js`      | Injeta a variável DATABASE_URL nos workers do Jest                   |
| `.env.test`              | Aponta DATABASE_URL para o banco embedded                            |

O banco é real (PostgreSQL 18.3 via `embedded-postgres`), não um mock. A tabela `chefe_da_familia` é criada no `beforeAll` e truncada no `beforeEach`, garantindo que cada um dos quatro casos começa com banco limpo.

---

## Output de `npm test`

```
> georisco-santo-andre@1.0.0 test
> jest

 PASS  src/helpers/cpfValidator.spec.ts
 PASS  src/tests/cadastros.spec.ts
   POST /cadastros — Cadastro de Indivíduo (RF001)
     ✓ (sucesso) deve normalizar nome com acentos e capitalização mista para CAIXA ALTA no banco (RN008)
     ✓ (regra de negócio violada) deve retornar 409 quando o CPF já está ativo no sistema (RN001)
     ✓ (payload inválido) deve retornar 400 para CPF com dígitos verificadores matematicamente incorretos (RN017)
     ✓ (persistência no banco) deve gravar o CPF sem máscara quando recebido com formatação (RN009)

Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        18 s
```

---

## Decisões de arquitetura de teste

**Por que embedded-postgres em vez de mock do pool?**

A ponderada exige banco real. O embedded-postgres sobe um binário PostgreSQL 18.3 dentro do próprio processo Node.js, sem nenhuma instalação prévia no sistema operacional. A consequência prática é que constraints, tipos de coluna e defaults do banco (`DEFAULT NOW()`, `gen_random_uuid()`, `CHAR(11)`) se comportam exatamente como em produção. Se a normalização no Caso 1 não acontecer antes do INSERT, o banco recebe o valor errado e o teste falha. Com mock do pool isso seria invisível.

**Por que mockar apenas o notificationService?**

A regra é clara: banco real, integrações externas mockadas. O `notificationService` faz uma chamada HTTP a um endpoint da Prefeitura que não existe em ambiente de teste. Mocká-lo com `jest.mock()` remove essa dependência de rede sem sacrificar nada do fluxo interno. Controller, service, repository e banco continuam sendo executados de verdade.

**Por que TRUNCATE no beforeEach e não no afterEach?**

O `beforeEach` garante estado limpo independente do que aconteceu no caso anterior. Se um teste falhar no meio com uma exceção inesperada, o `afterEach` pode não rodar e o próximo caso começa com dados residuais. O `beforeEach` resolve isso porque executa antes de cada caso, não depois. O `beforeAll` cria a tabela uma única vez para toda a suite, e o `TRUNCATE` no `beforeEach` a limpa antes de cada um dos quatro casos.

**Por que o Caso 2 usa 409 e não 400?**

HTTP 400 Bad Request indica que o servidor não conseguiu entender a requisição por causa de sintaxe ou formato inválido. HTTP 409 Conflict indica que a requisição é válida, mas entra em conflito com o estado atual do recurso. No Caso 2 o payload é completamente válido. O problema é que o banco já tem aquele CPF ativo. O service lança `ConflictError` e o middleware mapeia para 409, que é semanticamente correto para essa situação.

**Por que o Caso 4 lê o banco em vez de confiar na resposta HTTP?**

A resposta HTTP mostra o que a aplicação decidiu retornar. A leitura direta ao banco mostra o que foi efetivamente gravado. No Caso 4 especificamente, o service poderia normalizar o CPF na resposta sem normalizar antes do INSERT. Ler o banco é a única forma de verificar que a persistência aconteceu da forma correta.
