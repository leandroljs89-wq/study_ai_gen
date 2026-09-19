export async function apiFetch(url: string, options?: RequestInit) {
  const resp = await fetch(url, options);
  const contentType = resp.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await resp.text().catch(() => '');
    if (text.includes('The page could not be found') || resp.status === 404 || text.includes('PAGE_NOT_FOUND')) {
      throw new Error('A rota da API não foi encontrada. Verifique se o backend está ativo e o roteamento /api configurado no vercel.json.');
    }
    if (resp.status === 500) {
      throw new Error(`Erro interno do servidor (500). Verifique os logs de execução da função serverless.`);
    }
    throw new Error(`Erro na resposta da API (${resp.status}): O servidor não retornou JSON.`);
  }

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || data.message || `Erro na requisição (${resp.status})`);
  }
  return data;
}

