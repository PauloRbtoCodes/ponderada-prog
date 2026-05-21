import * as repo from '../repositories/familiaRepository';
import * as alerta from './alertaService';
import { ValidationError } from '../errors/AppError';
import type { Familia, CreateFamiliaDto } from '../models/familia';

const GRAUS_VALIDOS = ['R1', 'R2', 'R3', 'R4'];

export async function criar(dto: CreateFamiliaDto): Promise<Familia> {
  // RN007 — grau de risco deve estar no domínio R1–R4
  if (!GRAUS_VALIDOS.includes(dto.grau_risco)) {
    throw new ValidationError(
      `grau_risco inválido: deve ser R1, R2, R3 ou R4 (recebido: "${dto.grau_risco}") (RN007)`
    );
  }

  // RN011 — gestante exige período gestacional informado
  const temGestante = dto.tem_gestante ?? false;
  if (temGestante && !dto.periodo_gestante?.trim()) {
    throw new ValidationError(
      'Família com gestante deve informar o período gestacional (RN011)'
    );
  }

  // RN006 — acamado ou mobilidade reduzida → prioridade máxima (1)
  const temAcamado = dto.tem_acamado ?? false;
  const prioridade = temAcamado ? 1 : 4;

  const familia = await repo.criar({
    responsavel_nome: dto.responsavel_nome.toUpperCase().trim(),
    grau_risco: dto.grau_risco,
    tem_gestante: temGestante,
    periodo_gestante: dto.periodo_gestante ?? null,
    tem_acamado: temAcamado,
    prioridade_evacuacao: prioridade,
  });

  // Integração externa: alerta à Defesa Civil (fire-and-forget)
  await alerta.notificarNovaFamilia(familia.responsavel_nome).catch(() => {});

  return familia;
}
