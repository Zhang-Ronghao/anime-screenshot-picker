const BANGUMI_API = 'https://api.bgm.tv';
const UPSTREAM_TIMEOUT_MS = 10000;
const SUBJECT_CACHE_TTL = 60 * 60 * 24 * 30;

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

  const upstream = await fetchBangumiWithRetry(targetUrl, {
    method: request.method,
    body: request.method === 'POST' ? await request.text() : undefined,
    canCache,
  });

  if (!upstream.response) {
    return json({
      error: 'Bangumi upstream request failed',
      detail: upstream.error || 'Unknown upstream error',
      attempts: upstream.attempts,
      path: targetUrl.pathname,
    }, 502, {
      'X-Bangumi-Upstream-Error': sanitizeHeader(upstream.error || 'Unknown upstream error'),
      'X-Bangumi-Upstream-Attempts': String(upstream.attempts),
    });
  }

  const contentType = upstream.response.headers.get('content-type') || 'application/json; charset=utf-8';
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', canCache ? `public, max-age=${SUBJECT_CACHE_TTL}` : 'no-store');
  headers.set('X-Bangumi-Proxy-Cache', 'MISS');
  headers.set('X-Bangumi-Upstream-Attempts', String(upstream.attempts));
  if (!upstream.response.ok) {
    headers.set('X-Bangumi-Upstream-Status', String(upstream.response.status));
  }

  const response = new Response(upstream.response.body, {
    status: upstream.response.status,
    statusText: upstream.response.statusText,
    headers,
  });

  if (canCache && upstream.response.ok) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

async function fetchBangumiWithRetry(targetUrl, options) {
  const attempts = options.method === 'GET' ? 3 : 2;
  let lastError = '';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: options.method,
        headers: {
          'User-Agent': 'AnimeScreenshotPicker/1.0 (Bangumi proxy; contact: deployed-site-owner)',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: options.body,
        signal: controller.signal,
        cf: {
          cacheTtl: options.canCache ? SUBJECT_CACHE_TTL : 0,
          cacheEverything: false,
        },
      });

      if (response.ok || !shouldRetryStatus(response.status) || attempt === attempts) {
        return { response, attempts: attempt };
      }

      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err?.name === 'AbortError'
        ? `Upstream timeout after ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)} seconds`
        : (err?.message || String(err));

      if (attempt === attempts) {
        return { response: null, attempts: attempt, error: lastError };
      }
    } finally {
      clearTimeout(timer);
    }

    await sleep(180 * attempt);
  }

  return { response: null, attempts, error: lastError || 'Unknown upstream error' };
}

function shouldRetryStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeHeader(value) {
  return String(value || '').replace(/[^\t\x20-\x7e]/g, ' ').slice(0, 180);
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

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
