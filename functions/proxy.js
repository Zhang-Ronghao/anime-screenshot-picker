const FANCAPS_HOST = 'fancaps.net';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const currentUrl = new URL(request.url);
  const rawTarget = currentUrl.searchParams.get('url');

  if (!rawTarget) {
    return json({ error: 'Missing url parameter' }, 400);
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawTarget);
  } catch {
    return json({ error: 'Invalid url parameter' }, 400);
  }

  if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== FANCAPS_HOST) {
    return json({ error: 'Only https://fancaps.net URLs are allowed' }, 400);
  }

  if (!isAllowedFanCapsPath(targetUrl.pathname)) {
    return json({ error: 'This FanCaps path is not allowed' }, 400);
  }

  const cache = caches.default;
  const cacheKey = new Request(targetUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);

  if (cached) {
    return withCors(cached, { 'X-Proxy-Cache': 'HIT' });
  }

  const upstream = await fetch(targetUrl.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AnimeScreenshotPicker/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    },
    cf: {
      cacheTtl: getCacheTtl(targetUrl.pathname),
      cacheEverything: false,
    },
  });

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return json({ error: 'Upstream response is not HTML' }, 502);
  }

  const body = await upstream.text();
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', `public, max-age=${getCacheTtl(targetUrl.pathname)}`);
  headers.set('X-Proxy-Cache', 'MISS');

  const response = new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });

  if (upstream.ok) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

function isAllowedFanCapsPath(pathname) {
  return (
    pathname === '/search.php' ||
    pathname.includes('/anime/showimages.php') ||
    pathname.includes('/anime/episodeimages.php') ||
    pathname.includes('/anime/picture.php') ||
    pathname.includes('/movies/MovieImages.php') ||
    pathname.includes('/movies/picture.php')
  );
}

function getCacheTtl(pathname) {
  if (pathname === '/search.php') return 60 * 60 * 24; // 1 day
  if (pathname.includes('picture.php')) return 60 * 60 * 24 * 30; // 30 days
  if (pathname.includes('episodeimages.php')) return 60 * 60 * 24 * 7; // 7 days
  if (pathname.includes('showimages.php')) return 60 * 60 * 24 * 7; // 7 days
  if (pathname.includes('MovieImages.php')) return 60 * 60 * 24 * 7; // 7 days
  return 60 * 60;
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
