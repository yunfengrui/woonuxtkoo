import { defineEventHandler, readBody, getRequestHeaders } from 'h3';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const raw = (process.env.GQL_HOST || 'http://localhost:4000/graphql').trim();
  const url = raw.replace(/:+$/, '');
  const headers = getRequestHeaders(event);
  const authorization = headers.authorization || '';
  const result = await $fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body,
  });
  return result;
});
