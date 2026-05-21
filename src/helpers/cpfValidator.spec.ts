import { isValidCpf } from './cpfValidator';

describe('isValidCpf — helper puro (RN017)', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('aceita CPF formatado com pontos e traço', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejeita CPF com dígitos verificadores incorretos', () => {
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
  });

  it('rejeita CPF com comprimento incorreto', () => {
    expect(isValidCpf('1234567')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});
