import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as onBangumiRequest } from '../functions/bangumi.js';
import { onRequest as onProxyRequest } from '../functions/proxy.js';

function installCacheMock() {
  const writes = [];
  globalThis.caches = {
    default: {
      match: async () => null,
      put: async (key, response) => writes.push({ key, response }),
    },
  };
  return writes;
}

test('Bangumi proxy allows and slims subject character responses', async () => {
  const oldFetch = globalThis.fetch;
  installCacheMock();
  let upstreamUrl = '';
  globalThis.fetch = async url => {
    upstreamUrl = String(url);
    return Response.json([
      {
        id: 57305,
        name: '竈門炭治郎',
        relation: '主角',
        summary: 'large field that should be removed',
        actors: [{ id: 1, name: 'actor' }],
        images: {
          large: 'https://lain.bgm.tv/pic/crt/l/bd/1e/57305_crt_9ZG90.jpg?r=1',
          medium: 'https://lain.bgm.tv/r/400/pic/crt/l/bd/1e/57305_crt_9ZG90.jpg?r=1',
        },
      },
    ]);
  };

  try {
    const pending = [];
    const request = new Request('https://example.test/bangumi?path=%2Fv0%2Fsubjects%2F245665%2Fcharacters');
    const response = await onBangumiRequest({ request, waitUntil: promise => pending.push(promise) });
    assert.equal(response.status, 200);
    assert.equal(upstreamUrl, 'https://api.bgm.tv/v0/subjects/245665/characters');
    assert.equal(response.headers.get('X-Bangumi-Proxy-Transform'), 'slim-characters');
    assert.match(response.headers.get('Cache-Control'), /max-age=604800/);
    assert.deepEqual(await response.json(), [{
      id: 57305,
      name: '竈門炭治郎',
      relation: '主角',
      images: {
        large: 'https://lain.bgm.tv/pic/crt/l/bd/1e/57305_crt_9ZG90.jpg?r=1',
        medium: 'https://lain.bgm.tv/r/400/pic/crt/l/bd/1e/57305_crt_9ZG90.jpg?r=1',
      },
    }]);
    await Promise.all(pending);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Bangumi proxy rejects character paths with unexpected query parameters', async () => {
  installCacheMock();
  const request = new Request('https://example.test/bangumi?path=%2Fv0%2Fsubjects%2F245665%2Fcharacters%3Flimit%3D1');
  const response = await onBangumiRequest({ request, waitUntil() {} });
  assert.equal(response.status, 400);
});

test('Bangumi proxy exposes a slim Chinese character name from character details', async () => {
  const oldFetch = globalThis.fetch;
  installCacheMock();
  globalThis.fetch = async () => Response.json({
    id: 57305,
    name: '竈門炭治郎',
    summary: 'not exposed',
    infobox: [
      { key: '简体中文名', value: '灶门炭治郎' },
      { key: '别名', value: [{ k: '罗马字', v: 'Kamado Tanjirou' }] },
    ],
  });

  try {
    const pending = [];
    const request = new Request('https://example.test/bangumi?path=%2Fv0%2Fcharacters%2F57305');
    const response = await onBangumiRequest({ request, waitUntil: promise => pending.push(promise) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Bangumi-Proxy-Transform'), 'slim-character-detail');
    assert.deepEqual(await response.json(), {
      id: 57305,
      name: '竈門炭治郎',
      chineseName: '灶门炭治郎',
    });
    await Promise.all(pending);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Bangumi proxy rejects character detail query parameters', async () => {
  installCacheMock();
  const request = new Request('https://example.test/bangumi?path=%2Fv0%2Fcharacters%2F57305%3Ffoo%3Dbar');
  const response = await onBangumiRequest({ request, waitUntil() {} });
  assert.equal(response.status, 400);
});

test('image proxy allows Bangumi character images and rejects unrelated paths', async () => {
  const oldFetch = globalThis.fetch;
  installCacheMock();
  globalThis.fetch = async () => new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
    status: 200,
    headers: { 'Content-Type': 'image/jpeg' },
  });

  try {
    const target = encodeURIComponent('https://lain.bgm.tv/pic/crt/l/bd/1e/57305_crt_9ZG90.jpg?r=1');
    const pending = [];
    const response = await onProxyRequest({
      request: new Request(`https://example.test/proxy?url=${target}`),
      waitUntil: promise => pending.push(promise),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    await Promise.all(pending);

    const rejected = await onProxyRequest({
      request: new Request(`https://example.test/proxy?url=${encodeURIComponent('https://lain.bgm.tv/img/no_icon_subject.png')}`),
      waitUntil() {},
    });
    assert.equal(rejected.status, 400);

    const personImage = await onProxyRequest({
      request: new Request(`https://example.test/proxy?url=${encodeURIComponent('https://lain.bgm.tv/pic/crt/l/aa/bb/123_prsn_voice.jpg')}`),
      waitUntil() {},
    });
    assert.equal(personImage.status, 400);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
