/**
 * Suite de Integração — Fluxo: Cadastro de Indivíduo (RF001)
 *
 * Fluxo escolhido: POST /cadastros
 * Justificativa: É o fluxo central do sistema. Toca todas as camadas
 * (controller → service → repository → banco real), exercita as regras
 * de negócio mais críticas (RN001 unicidade CPF, RN017 validação CPF,
 * RN020 data futura) e representa a entrada de dados do agente de campo
 * (Josias). O serviço de notificação é a única integração externa e é
 * mockado com jest.mock().
 *
 * Matriz RF → RN → Teste:
 * ┌────────┬───────┬──────────────────────────────────────────────────┐
 * │  RF    │  RN   │  Caso de teste                                   │
 * ├────────┼───────┼──────────────────────────────────────────────────┤
 * │ RF001  │ —     │ (sucesso) 201 + corpo correto                    │
 * │ RF001  │ RN001 │ (regra de negócio) 409 CPF duplicado ativo       │
 * │ RF001  │ RN017 │ (payload inválido) 400 CPF matematicamente errado│
 * │ RF001  │ —     │ (persistência) registro gravado no banco real    │
 * └────────┴───────┴──────────────────────────────────────────────────┘
 */

import request from 'supertest';
import { app } from '../app';
import { pool } from '../db/pool';
import { notificarNovoCadastro } from '../services/notificationService';

// ── Mock da integração externa ────────────────────────────────────────
// O webhook de notificação chama uma API da prefeitura em produção.
// Nos testes, substituímos por um mock para não depender de rede externa.
jest.mock('../services/notificationService');

// ── Fixtures ─────────────────────────────────────────────────────────
// CPF 111.444.777-35 — matematicamente válido (dígitos verificadores 3 e 5)
const CPF_VALIDO = '11144477735';

const PAYLOAD_VALIDO = {
  nome: 'Jose da Silva',
  cpf: CPF_VALIDO,
  data_nascimento: '1990-05-15',
};

// ── Setup e Teardown ──────────────────────────────────────────────────

beforeAll(async () => {
  // Cria a tabela no banco de testes se ainda não existir
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chefe_da_familia (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      nome          VARCHAR(255) NOT NULL,
      cpf           CHAR(11)    NOT NULL,
      data_nascimento DATE       NOT NULL,
      status        VARCHAR(10) NOT NULL DEFAULT 'ATIVO',
      data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
});

beforeEach(async () => {
  // Banco limpo antes de cada teste (sem dados residuais entre casos)
  await pool.query('TRUNCATE TABLE chefe_da_familia CASCADE');

  // Mock configurado para retornar Promise resolvida (simula chamada bem-sucedida)
  (notificarNovoCadastro as jest.Mock).mockResolvedValue(undefined);
});

afterAll(async () => {
  await pool.end();
});

// ── Suite ─────────────────────────────────────────────────────────────

describe('POST /cadastros — Cadastro de Indivíduo (RF001)', () => {

  /**
   * CASO 1 — Sucesso
   * Payload válido deve criar o registro e retornar HTTP 201.
   */
  it('(sucesso) deve retornar 201 e o cadastro criado quando todos os dados são válidos', async () => {
    // Arrange
    // PAYLOAD_VALIDO: CPF matematicamente correto, data passada, nome preenchido

    // Act
    const res = await request(app)
      .post('/cadastros')
      .send(PAYLOAD_VALIDO);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nome: 'JOSE DA SILVA',   // RN008: normalizado para CAIXA ALTA sem acento
      cpf: CPF_VALIDO,
      status: 'ATIVO',
    });
    expect(res.body.id).toBeDefined();
    expect(notificarNovoCadastro).toHaveBeenCalledWith('JOSE DA SILVA');
  });

  /**
   * CASO 2 — Regra de negócio violada (RN001)
   * Não é permitido cadastrar dois indivíduos com o mesmo CPF ativo.
   * Esperado: HTTP 409 Conflict.
   */
  it('(regra de negócio violada) deve retornar 409 quando CPF já está ativo no sistema (RN001)', async () => {
    // Arrange — pré-cadastrar um indivíduo com o mesmo CPF
    await request(app).post('/cadastros').send(PAYLOAD_VALIDO);

    // Act — tentar registrar outra pessoa com o mesmo CPF ativo
    const res = await request(app)
      .post('/cadastros')
      .send({ ...PAYLOAD_VALIDO, nome: 'Outra Pessoa' });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: expect.stringContaining('CPF'),
    });
  });

  /**
   * CASO 3 — Payload inválido (RN017)
   * CPF com dígitos verificadores matematicamente incorretos deve ser rejeitado
   * antes de qualquer acesso ao banco.
   * Esperado: HTTP 400 Bad Request.
   */
  it('(payload inválido) deve retornar 400 quando o CPF não passa na validação matemática (RN017)', async () => {
    // Arrange
    const payloadInvalido = {
      nome: 'Fulano de Tal',
      cpf: '12345678900', // segundo dígito verificador incorreto (esperado: 9, recebido: 0)
      data_nascimento: '1985-03-20',
    };

    // Act
    const res = await request(app)
      .post('/cadastros')
      .send(payloadInvalido);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: expect.stringContaining('CPF'),
    });
    // Nenhum dado deve ter sido gravado no banco
    const { rows } = await pool.query('SELECT * FROM chefe_da_familia');
    expect(rows).toHaveLength(0);
  });

  /**
   * CASO 4 — Verificação de persistência no banco real
   * Após criação bem-sucedida, os dados devem estar gravados corretamente
   * na tabela chefe_da_familia do banco PostgreSQL real (sem mock).
   */
  it('(persistência no banco) deve gravar o registro corretamente no PostgreSQL real', async () => {
    // Arrange + Act
    const criarRes = await request(app)
      .post('/cadastros')
      .send(PAYLOAD_VALIDO);

    expect(criarRes.status).toBe(201);
    const { id } = criarRes.body as { id: string };

    // Assert — consulta direta ao banco de dados (sem ORM, sem mock)
    const { rows } = await pool.query<{
      nome: string;
      cpf: string;
      status: string;
      data_nascimento: Date;
    }>(
      'SELECT nome, cpf, status, data_nascimento FROM chefe_da_familia WHERE id = $1',
      [id]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nome: 'JOSE DA SILVA',
      cpf: CPF_VALIDO,
      status: 'ATIVO',
    });
    // Data persistida corretamente (ignorando componente de hora)
    expect(new Date(rows[0].data_nascimento).getFullYear()).toBe(1990);
  });
});
