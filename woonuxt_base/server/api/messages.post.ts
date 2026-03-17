export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const token = (body?.token || '').toString();
  const secret = process.env.TURNSTILE_SECRET_KEY || '';
  if (!token || !secret) {
    throw createError({ statusCode: 400, statusMessage: 'Missing token or secret' });
  }
  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }).toString(),
  });
  const verifyJson = await verifyRes.json();
  if (!verifyJson?.success) {
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
