export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(digits[i]) * (len + 1 - i);
    }
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };

  return (
    calcDigit(9) === parseInt(digits[9]) &&
    calcDigit(10) === parseInt(digits[10])
  );
}
