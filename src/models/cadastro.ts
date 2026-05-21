export interface Cadastro {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento: Date;
  status: 'ATIVO' | 'INATIVO';
  data_registro: Date;
}

export interface CreateCadastroDto {
  nome: string;
  cpf: string;
  data_nascimento: string;
}
