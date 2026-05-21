import { pool } from '../db/pool';
import type { Cadastro } from '../models/cadastro';

export async function findByCpfAtivo(cpf: string): Promise<Cadastro | null> {
  const r = await pool.query<Cadastro>(
    "SELECT * FROM chefe_da_familia WHERE cpf = $1 AND status = 'ATIVO'",
    [cpf]
  );
  return r.rows[0] ?? null;
}

export async function criar(dto: {
  nome: string;
  cpf: string;
  data_nascimento: string;
}): Promise<Cadastro> {
  const r = await pool.query<Cadastro>(
    `INSERT INTO chefe_da_familia (nome, cpf, data_nascimento)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [dto.nome, dto.cpf, dto.data_nascimento]
  );
  return r.rows[0];
}

export async function findById(id: string): Promise<Cadastro | null> {
  const r = await pool.query<Cadastro>(
    'SELECT * FROM chefe_da_familia WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}
