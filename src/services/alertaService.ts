export async function notificarNovaFamilia(responsavel_nome: string): Promise<void> {
  const url = process.env.ALERTA_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento: 'NOVA_FAMILIA', responsavel_nome }),
  });
}
