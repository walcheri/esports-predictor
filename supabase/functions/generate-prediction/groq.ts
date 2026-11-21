const API_URL = 'https://api.groq.com/openai/v1';
const PREFERRED_MODEL = 'llama-3.3-70b-versatile';

/** Keep the preferred model; recover only when Groq explicitly rejects its availability. */
export async function requestGroqCompletion(
  apiKey: string,
  payload: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const complete = (model: string) => fetcher(`${API_URL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, model }),
    signal: AbortSignal.timeout(90_000),
  });

  const response = await complete(PREFERRED_MODEL);
  if (response.status !== 404 && response.status !== 400) return response;
  const error = await response.clone().json().catch(() => null);
  if (error?.error?.code !== 'model_not_found' && error?.error?.code !== 'model_decommissioned') {
    return response;
  }

  const modelsResponse = await fetcher(`${API_URL}/models`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!modelsResponse.ok) return modelsResponse;
  const models = await modelsResponse.json();
  const available = new Set<string>(
    Array.isArray(models.data)
      ? models.data.filter((model: { id?: string; active?: boolean }) =>
        typeof model.id === 'string' && model.active !== false).map((model: { id: string }) => model.id)
      : [],
  );
  // Only known text-chat models, and only those confirmed by this account's catalog.
  const replacement = ['openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b']
    .find((model) => available.has(model));
  if (!replacement) return response;
  console.log('Groq preferred model unavailable; retrying with:', replacement);
  return complete(replacement);
}