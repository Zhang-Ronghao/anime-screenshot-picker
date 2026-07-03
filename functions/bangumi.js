const BANGUMI_API = 'https://api.bgm.tv';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const currentUrl = new URL(request.url);
  const rawPath = currentUrl.searchParams.get('path') || '';
  const targetPath = normalizeBangumiPath(rawPath);

  if (!targetPath || !isAllowedBangumiPath(targetPath, request.method)) {
    return json({ error: 'Bangumi API path is not allowed' }, 400);
  }

  const targetUrl = new URL(targetPath, BANGUMI_API);
  const cache = caches.default;
  const cacheKey = new Request(targetUrl.toString(), { method: 'GET' });
  const canCache = request.method === 'GET' && isCacheableBangumiPath(targetUrl.pathname);

  if (canCache) {
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, { 'X-Bangumi-Proxy-Cache': 'HIT' });
  }

  const upstream = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: {
      'User-Agent': 'AnimeScreenshotPicker/1.0 (https://github.com/zrh/anime-screenshot-picker)',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: request.method === 'POST' ? await request.text() : undefined,
    cf: {
      cacheTtl: canCache ? 60 * 60 * 24 : 0,
      cacheEverything: false,
    },
  });

  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', canCache ? 'public, max-age=86400' : 'no-store');
  headers.set('X-Bangumi-Proxy-Cache', 'MISS');

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });

  if (canCache && upstream.ok) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

function normalizeBangumiPath(path) {
  const value = String(path || '').trim();
  if (!value.startsWith('/')) return '';

  try {
    const url = new URL(value, BANGUMI_API);
    if (url.origin !== BANGUMI_API) return '';
    return `${url.pathname}${url.search}`;
  } catch {
    return '';
  }
}

function isAllowedBangumiPath(path, method) {
  const url = new URL(path, BANGUMI_API);

  if (method === 'GET' && /^\/v0\/subjects\/\d+$/.test(url.pathname)) {
    return true;
  }

  if (method === 'GET' && /^\/v0\/users\/[^/]+\/collections$/.test(url.pathname)) {
    return (
      url.searchParams.get('subject_type') === '2' &&
      url.searchParams.get('type') === '2' &&
      isBoundedInteger(url.searchParams.get('limit'), 1, 50) &&
      isBoundedInteger(url.searchParams.get('offset'), 0, 5000)
    );
  }

  if (method === 'POST' && url.pathname === '/v0/search/subjects') {
    return (
      isBoundedInteger(url.searchParams.get('limit'), 1, 20) &&
      isBoundedInteger(url.searchParams.get('offset'), 0, 200)
    );
  }

  return false;
}

function isCacheableBangumiPath(pathname) {
  return /^\/v0\/subjects\/\d+$/.test(pathname);
}

function isBoundedInteger(value, min, max) {
  if (!/^\d+$/.test(String(value || ''))) return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function withCors(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
