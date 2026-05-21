import { pool } from '../db/pool';
import type { Familia } from '../models/familia';

export async function criar(dto: {
  responsavel_nome: string;
  grau_risco: string;
  tem_gestante: boolean;
  periodo_gestante: string | null;
  tem_acamado: boolean;
  prioridade_evacuacao: number;
}): Promise<Familia> {
  const r = await pool.query<Familia>(
    `INSERT INTO familias
       (responsavel_nome, grau_risco, tem_gestante, periodo_gestante, tem_acamado, prioridade_evacuacao)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      dto.responsavel_nome,
      dto.grau_risco,
      dto.tem_gestante,
      dto.periodo_gestante,
      dto.tem_acamado,
      dto.prioridade_evacuacao,
    ]
  );
  return r.rows[0];
}

export async function findById(id: string): Promise<Familia | null> {
  const r = await pool.query<Familia>('SELECT * FROM familias WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}
