# Ponderada — Suite de Testes de Integração (TDD)

## Fluxo escolhido: `POST /cadastros`

**Justificativa de escolha**

O fluxo `POST /cadastros` é o ponto de entrada central do sistema GeoRisco Santo André. Representa o trabalho do agente Josias em campo: após visitar uma família, ele coleta os dados do chefe de família, submete pelo formulário e o sistema valida, normaliza e persiste o registro. Esse endpoint percorre todas as camadas da aplicação (controller → service → repository → banco real), exercita as regras de negócio mais críticas do WAD (unicidade de CPF ativo, data de nascimento válida, formato do CPF) e envolve uma integração externa com o webhook de notificação da Prefeitura. Por concentrar a maior densidade de regras e camadas, é o fluxo mais representativo para validação via testes de integração.

A integração externa presente (`notificationService`) é substituída por mock com `jest.mock()`, garantindo que os testes não dependam de rede ou serviços de terceiros.

---

## Matriz RF → RN → Teste

| RF    | RN    | Tipo de caso          | Caso de teste                                                        |
|-------|-------|-----------------------|----------------------------------------------------------------------|
| RF001 | RN001 | Sucesso               | CPF com cadastro INATIVO pode ser re-registrado normalmente          |
| RF001 | RN020 | Regra de negócio      | Data de nascimento no próximo ano → HTTP 400                         |
| RF001 | RN017 | Payload inválido      | CPF com apenas 9 dígitos após remoção da máscara → HTTP 400          |
| RF001 | —     | Persistência no banco | `data_registro` gerada pelo `DEFAULT NOW()` verificada no banco      |

---

## Descrição dos casos

### Caso 1 — Sucesso (RN001 — lado positivo)

**Regra:** RN001 proíbe CPF ativo duplicado, mas permite re-cadastro quando o registro anterior está INATIVO (ex.: óbito, mudança de município). O sistema deve criar um novo registro ATIVO normalmente.

**Como testa:** Insere diretamente no banco um registro com o mesmo CPF e `status = 'INATIVO'`. Em seguida, envia `POST /cadastros` com o mesmo CPF. Espera HTTP 201 com `status: 'ATIVO'` no corpo. Depois confirma no banco que existem dois registros para o CPF: o antigo INATIVO e o novo ATIVO.

---

### Caso 2 — Regra de negócio violada (RN020)

**Regra:** A data de nascimento não pode ser futura. Nascimento com ano posterior ao atual é claramente inválido e deve ser rejeitado antes de qualquer consulta ao banco.

**Como testa:** Calcula `new Date().getFullYear() + 1` e envia como ano de nascimento. Espera HTTP 400 com mensagem de erro contendo a palavra `'nascimento'`. Após a chamada, confirma que nenhuma linha foi gravada na tabela `chefe_da_familia`.

---

### Caso 3 — Payload inválido (RN017)

**Regra:** O CPF deve ter exatamente 11 dígitos após remoção da máscara. CPF com apenas 9 dígitos (`"987.654.321"`) falha na verificação de comprimento antes mesmo de calcular os dígitos verificadores.

**Como testa:** Envia `cpf: '987.654.321'` (9 dígitos sem máscara). Espera HTTP 400 com mensagem contendo `'CPF'`.

---

### Caso 4 — Persistência no banco (DEFAULT NOW())

**Regra implícita:** O campo `data_registro` não é enviado pelo cliente — é gerado automaticamente pelo banco via cláusula `DEFAULT NOW()` no momento do INSERT.

**Como testa:** Registra o instante imediatamente antes e depois da chamada. Após receber HTTP 201, consulta diretamente a linha inserida no banco pelo `id` retornado e verifica que `data_registro` está dentro da janela `[antes, depois]`.

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
│   └── cadastroService.ts           ← regras RN001, RN017, RN020, RN008
├── controllers/
│   └── cadastroController.ts        ← handler HTTP
├── routes/
│   └── cadastroRoutes.ts            ← POST /cadastros
└── tests/
    └── cadastros.spec.ts            ← suite de integração (4 casos)
```

**Infraestrutura de teste:**

| Arquivo | Papel |
|---|---|
| `jest.globalSetup.js` | Sobe PostgreSQL real (embedded-postgres) na porta 54321 |
| `jest.globalTeardown.js` | Para o PostgreSQL ao final da suite |
| `jest.setup.env.js` | Define `NODE_ENV=test` nos workers |
| `.env.test` | `DATABASE_URL` apontando para o banco embedded |

O banco é **real** (PostgreSQL 18.3 via `embedded-postgres`), não um mock. A tabela `chefe_da_familia` é criada no `beforeAll` e truncada no `beforeEach`, garantindo isolamento entre casos.

---

## Output de `npm test`

```
> georisco-santo-andre@1.0.0 test
> jest

 PASS  src/helpers/cpfValidator.spec.ts
 PASS  src/tests/cadastros.spec.ts

Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        15.569 s
```

---

## Decisões de arquitetura de teste

**Por que `embedded-postgres` e não mock do pool?**
A ponderada exige banco real. `embedded-postgres` sobe um PostgreSQL 18.3 binário diretamente no processo Node.js, sem precisar de instalação prévia no sistema operacional. O diretório de dados fica em `/tmp/` (filesystem Linux) para suportar as permissões Unix exigidas pelo PostgreSQL.

**Por que `jest.mock('../services/notificationService')`?**
O `notificationService` faz uma requisição HTTP para o webhook da Prefeitura. Em ambiente de teste, essa URL não existe. O mock substitui a função por uma `jest.Mock` que resolve imediatamente, sem tocar a rede, e pode ser inspecionada para verificar se foi chamada corretamente.

**Por que `TRUNCATE TABLE chefe_da_familia CASCADE` no `beforeEach`?**
Garante que cada caso começa com banco vazio, eliminando dependência de ordem entre testes. O `beforeAll` apenas cria a tabela uma vez por suite.
