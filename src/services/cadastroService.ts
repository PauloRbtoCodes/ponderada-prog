import * as repo from '../repositories/cadastroRepository';
import * as notification from './notificationService';
import { isValidCpf } from '../helpers/cpfValidator';
import { ValidationError, ConflictError } from '../errors/AppError';
import type { Cadastro, CreateCadastroDto } from '../models/cadastro';

export async function criar(dto: CreateCadastroDto): Promise<Cadastro> {
  const cpf = dto.cpf.replace(/\D/g, '');

  // RN017 — validação matemática do CPF
  if (!isValidCpf(cpf)) {
    throw new ValidationError('CPF inválido: dígitos verificadores não conferem (RN017)');
  }

  // RN020 — data de nascimento não pode ser futura
  const nascimento = new Date(dto.data_nascimento);
  if (isNaN(nascimento.getTime()) || nascimento >= new Date()) {
    throw new ValidationError('Data de nascimento inválida ou futura (RN020)');
  }

  // RN001 — unicidade: CPF ativo não pode se repetir
  const existente = await repo.findByCpfAtivo(cpf);
  if (existente) {
    throw new ConflictError('CPF já cadastrado e ativo no sistema (RN001)');
  }

  // RN008 — nome em CAIXA ALTA sem acentuação
  const nome = dto.nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const cadastro = await repo.criar({ nome, cpf, data_nascimento: dto.data_nascimento });

  // Integração externa: notificação de novo cadastro (fire-and-forget)
  await notification.notificarNovoCadastro(cadastro.nome).catch(() => {});

  return cadastro;
}
