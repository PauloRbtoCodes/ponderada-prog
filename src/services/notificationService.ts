/**
 * Integração externa: webhook de notificação.
 * Em produção, chama a API de SMS/push da Prefeitura.
 * Em testes, deve ser substituída por jest.mock().
 */
export async function notificarNovoCadastro(nome: string): Promise<void> {
  const url = process.env.NOTIFICATION_WEBHOOK_URL;
  if (!url) return;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento: 'NOVO_CADASTRO', nome }),
  });
}
