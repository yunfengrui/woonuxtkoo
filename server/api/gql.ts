import { defineEventHandler, readBody, getRequestHeaders, setCookie } from 'h3';
import { $fetch } from 'ofetch';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const raw = (process.env.GQL_HOST || 'http://localhost:4000/graphql').trim();
  const url = raw.replace(/:+$/, '');
  const headers = getRequestHeaders(event);
  const authorization = headers.authorization || '';
  const wcSession = headers['woocommerce-session'] || '';

  const outboundHeaders: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (authorization) outboundHeaders.authorization = authorization;
  if (wcSession) outboundHeaders['woocommerce-session'] = wcSession as string;
  if (headers['user-agent']) outboundHeaders['user-agent'] = headers['user-agent'] as string;
  if (headers['x-forwarded-for']) outboundHeaders['x-forwarded-for'] = headers['x-forwarded-for'] as string;

  const res = await $fetch.raw(url, {
    method: 'POST',
    headers: outboundHeaders,
    body,
  });
  const sessionHeader = res.headers.get('woocommerce-session');
  if (sessionHeader) {
    const token = sessionHeader.replace(/^Session\s+/i, '');
    // Set a front-domain cookie so client can resend it on next requests
    setCookie(event, 'woocommerce-session', token, {
      path: '/',
      sameSite: 'lax',
      secure: true,
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return res._data;
});
