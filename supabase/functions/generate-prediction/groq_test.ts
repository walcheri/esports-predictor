import { requestGroqCompletion } from './groq.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test('uses preferred Groq model when available', async () => {
  let calls = 0;
  const mock: typeof fetch = async (_url, init) => {
    calls++;
    assert(JSON.parse(String(init?.body)).model === 'llama-3.3-70b-versatile', 'preferred model changed');
    return Response.json({ choices: [{ message: { content: 'report' } }] });
  };
  const result = await requestGroqCompletion('test-key', { messages: [] }, mock);
  assert(result.ok && calls === 1, 'should not retry success');
});

Deno.test('recovers model_not_found using an active model from Groq catalog', async () => {
  const calls: string[] = [];
  const mock: typeof fetch = async (url, init) => {
    calls.push(String(url));
    if (calls.length === 1) return Response.json({ error: { code: 'model_not_found' } }, { status: 404 });
    if (String(url).endsWith('/models')) return Response.json({ data: [
      { id: 'openai/gpt-oss-120b', active: false },
      { id: 'llama-3.1-8b-instant', active: true },
    ] });
    assert(JSON.parse(String(init?.body)).model === 'llama-3.1-8b-instant', 'must use accessible active model');
    return Response.json({ choices: [{ message: { content: 'report' } }] });
  };
  const result = await requestGroqCompletion('test-key', { messages: [] }, mock);
  assert(result.ok && calls.length === 3, 'must discover and retry once');
});

Deno.test('does not retry auth, rate limits, or unrelated 404 errors', async () => {
  for (const status of [401, 429, 404]) {
    let calls = 0;
    const mock: typeof fetch = async () => {
      calls++;
      return Response.json({ error: { code: 'other_error' } }, { status });
    };
    const result = await requestGroqCompletion('test-key', {}, mock);
    assert(result.status === status && calls === 1, `unexpected retry for ${status}`);
  }
});

Deno.test('preserves failure when no supported model is accessible', async () => {
  let calls = 0;
  const mock: typeof fetch = async () => {
    calls++;
    return calls === 1
      ? Response.json({ error: { code: 'model_not_found' } }, { status: 404 })
      : Response.json({ data: [{ id: 'whisper-large-v3', active: true }] });
  };
  const result = await requestGroqCompletion('test-key', {}, mock);
  assert(result.status === 404 && calls === 2, 'must not invent model IDs or retry indefinitely');
});