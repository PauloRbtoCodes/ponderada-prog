export interface Familia {
  id: string;
  responsavel_nome: string;
  grau_risco: 'R1' | 'R2' | 'R3' | 'R4';
  tem_gestante: boolean;
  periodo_gestante: string | null;
  tem_acamado: boolean;
  prioridade_evacuacao: number;
  status: 'ATIVA' | 'INATIVA';
  data_registro: Date;
}

export interface CreateFamiliaDto {
  responsavel_nome: string;
  grau_risco: string;
  tem_gestante?: boolean;
  periodo_gestante?: string;
  tem_acamado?: boolean;
}
