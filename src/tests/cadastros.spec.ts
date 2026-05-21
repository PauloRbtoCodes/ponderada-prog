/**
 * Suite de Integração — Fluxo: Cadastro de Indivíduo (RF001)
 *
 * Fluxo escolhido: POST /cadastros
 * Justificativa: É o fluxo central do sistema GeoRisco Santo André.
 * Representa a ação do agente Josias em campo: coleta dados de uma
 * família, submete via formulário e o sistema valida, normaliza e persiste.
 * Toca todas as camadas (controller → service → repository → banco real)
 * e exercita aspectos distintos de normalização (RN008, RN009), unicidade
 * (RN001) e validação matemática de documento (RN017).
 * O webhook de notificação é a única integração externa, mockada com jest.mock().
 *
 * Matriz RF → RN → Teste:
 * ┌────────┬───────┬────────────────────────────────────────────────────────────┐
 * │  RF    │  RN   │  Caso de teste                                             │
 * ├────────┼───────┼────────────────────────────────────────────────────────────┤
 * │ RF001  │ RN008 │ (sucesso) nome com acentos normalizado para CAIXA ALTA     │
 * │ RF001  │ RN001 │ (regra de negócio) CPF ativo duplicado retorna 409         │
 * │ RF001  │ RN017 │ (payload inválido) CPF com dígitos verificadores errados   │
 * │ RF001  │ RN009 │ (persistência) CPF com máscara gravado sem formatação      │
 * └────────┴───────┴────────────────────────────────────────────────────────────┘
 */

import request from 'supertest';
import { app } from '../app';
import { pool } from '../db/pool';
import { notificarNovoCadastro } from '../services/notificationService';

jest.mock('../services/notificationService');

// CPF '111.444.777-35' é matematicamente válido e usado como fixture de formatação
const CPF_COM_MASCARA    = '111.444.777-35';
const CPF_LIMPO          = '11144477735';
// CPF '529.982.247-25' é matematicamente válido e usado no caso de conflito
const CPF_CONFLITO       = '52998224725';
// CPF '123.456.789-00' tem 11 dígitos mas dígitos verificadores incorretos
const CPF_DV_INVALIDO    = '12345678900';

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chefe_da_familia (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      nome            VARCHAR(255) NOT NULL,
      cpf             CHAR(11)    NOT NULL,
      data_nascimento DATE        NOT NULL,
      status          VARCHAR(10) NOT NULL DEFAULT 'ATIVO',
      data_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE chefe_da_familia CASCADE');
  (notificarNovoCadastro as jest.Mock).mockResolvedValue(undefined);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /cadastros — Cadastro de Indivíduo (RF001)', () => {

  /**
   * CASO 1 — Sucesso (RN008)
   * O agente de campo digita o nome da forma que aparecer no documento,
   * com acentos e capitalização mista. RN008 exige que o sistema normalize
   * para CAIXA ALTA sem acentuação antes de persistir, garantindo que buscas
   * por "angela" encontrem "Ângela da Silva" sem ambiguidade.
   * O assert verifica tanto o corpo da resposta quanto o valor gravado no banco
   * para confirmar que a normalização ocorre antes do INSERT, não apenas na saída.
   */
  it('(sucesso) deve normalizar nome com acentos e capitalização mista para CAIXA ALTA no banco (RN008)', async () => {
    const res = await request(app)
      .post('/cadastros')
      .send({
        nome: 'ângela da Silva',
        cpf: CPF_CONFLITO,
        data_nascimento: '1990-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('ANGELA DA SILVA');

    const { rows } = await pool.query<{ nome: string }>(
      'SELECT nome FROM chefe_da_familia WHERE id = $1',
      [res.body.id]
    );
    expect(rows[0].nome).toBe('ANGELA DA SILVA');
  });

  /**
   * CASO 2 — Regra de negócio violada (RN001)
   * RN001 impede dois registros com o mesmo CPF ativos ao mesmo tempo.
   * A distinção semântica aqui é importante: o dado enviado é completamente
   * válido (CPF correto, data de nascimento no passado, nome preenchido),
   * mas o estado atual do banco já tem aquele CPF ativo. Por isso o código
   * de resposta correto é 409 Conflict, não 400 Bad Request — o sistema
   * entendeu o pedido, mas não pode atendê-lo por conflito de estado.
   * O teste confirma também que o banco permanece com apenas um registro.
   */
  it('(regra de negócio violada) deve retornar 409 quando o CPF já está ativo no sistema (RN001)', async () => {
    await pool.query(
      `INSERT INTO chefe_da_familia (nome, cpf, data_nascimento, status)
       VALUES ($1, $2, $3, 'ATIVO')`,
      ['TITULAR ORIGINAL', CPF_CONFLITO, '1980-01-01']
    );

    const res = await request(app)
      .post('/cadastros')
      .send({
        nome: 'Outro Titular',
        cpf: CPF_CONFLITO,
        data_nascimento: '1980-01-01',
      });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: expect.stringContaining('CPF') });

    const { rows } = await pool.query(
      'SELECT status FROM chefe_da_familia WHERE cpf = $1',
      [CPF_CONFLITO]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ATIVO');
  });

  /**
   * CASO 3 — Payload inválido (RN017)
   * Este caso testa o ramo matemático da validação de CPF: o número tem
   * exatamente 11 dígitos (comprimento correto), mas os dois últimos dígitos
   * verificadores não satisfazem o algoritmo da Receita Federal.
   * É um teste distinto do caso de comprimento insuficiente porque o dado
   * passa pelo filtro de tamanho e falha apenas no cálculo dos verificadores.
   * Nenhuma linha deve ser gravada no banco.
   */
  it('(payload inválido) deve retornar 400 para CPF com dígitos verificadores matematicamente incorretos (RN017)', async () => {
    const res = await request(app)
      .post('/cadastros')
      .send({
        nome: 'Fulano Teste',
        cpf: CPF_DV_INVALIDO,
        data_nascimento: '1985-06-10',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('CPF') });

    const { rows } = await pool.query('SELECT * FROM chefe_da_familia');
    expect(rows).toHaveLength(0);
  });

  /**
   * CASO 4 — Persistência no banco (RN009)
   * O formulário do agente de campo envia o CPF formatado (com pontos e traço)
   * porque é assim que aparece nos documentos físicos. RN009 exige que o sistema
   * remova a máscara antes de persistir, armazenando apenas os 11 dígitos.
   * A consulta direta ao banco confirma que o valor gravado é o limpo,
   * independente do que foi retornado no corpo da resposta HTTP.
   */
  it('(persistência no banco) deve gravar o CPF sem máscara quando recebido com formatação (RN009)', async () => {
    const res = await request(app)
      .post('/cadastros')
      .send({
        nome: 'Jose Carlos Oliveira',
        cpf: CPF_COM_MASCARA,
        data_nascimento: '1975-07-20',
      });

    expect(res.status).toBe(201);

    const { rows } = await pool.query<{ cpf: string }>(
      'SELECT cpf FROM chefe_da_familia WHERE id = $1',
      [res.body.id]
    );
    expect(rows[0].cpf).toBe(CPF_LIMPO);
  });
});

