export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const token = (body?.token || '').toString();
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing token' });
  }
  const result: any = await verifyTurnstileToken(token);
  if (!result?.success) {
    throw createError({ statusCode: 400, statusMessage: 'Turnstile verification failed' });
  }
  const data = {
    name: body?.name || '',
    email: body?.email || '',
    country: body?.country || '',
    language: body?.language || '',
    message: body?.message || '',
    product_url: body?.product_url || '',
    product_name: body?.product_name || '',
    ip: { lon: 0, lat: 0 },
  };
  const res = await fetch('https://pocket.cheerivo.com/api/collections/messages/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw createError({ statusCode: 500, statusMessage: txt || 'PocketBase error' });
  }
  const json = await res.json();
  return json;
});
