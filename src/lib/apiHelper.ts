export async function apiFetch(url: string, options?: RequestInit) {
  const resp = await fetch(url, options);
  const contentType = resp.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await resp.text().catch(() => '');
    if (text.includes('The page could not be found') || text.includes('404') || text.includes('<!DOCTYPE html>') || text.toLowerCase().includes('page c')) {
      throw new Error('A rota da API não foi encontrada ou o Vercel não está direcionando /api para o backend. Certifique-se de que o arquivo vercel.json está configurado corretamente no projeto.');
    }
    throw new Error(`Erro no servidor (${resp.status}): O servidor retornou HTML em vez de JSON.`);
  }

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || data.message || `Erro na requisição (${resp.status})`);
  }
  return data;
}
