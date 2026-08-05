import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index++) {
    if (html[index] === '{') depth++;
    if (html[index] === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const functionNames = [
  'createZipBlob',
  'createZipLocalHeader',
  'createZipCentralHeader',
  'createZipEndRecord',
  'getZipDateTime',
  'crc32',
  'getCrc32Table',
];
const context = vm.createContext({ Blob, TextEncoder, Uint8Array, Uint32Array, DataView, Date });
vm.runInContext(`${functionNames.map(extractFunction).join('\n')}\nthis.createZipBlob = createZipBlob;`, context);

test('ZIP writer preserves all ten UTF-8 named images', async () => {
  const files = Array.from({ length: 10 }, (_, index) => ({
    name: `人物题/${String(index + 1).padStart(3, '0')}-角色${index + 1}-mosaic.jpg`,
    data: new Uint8Array([index, index + 1, index + 2]),
  }));
  const bytes = new Uint8Array(await context.createZipBlob(files).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = bytes.length - 22;

  assert.equal(view.getUint32(endOffset, true), 0x06054b50);
  assert.equal(view.getUint16(endOffset + 8, true), 10);
  assert.equal(view.getUint16(endOffset + 10, true), 10);

  const centralOffset = view.getUint32(endOffset + 16, true);
  let offset = centralOffset;
  for (let index = 0; index < 10; index++) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    assert.equal(view.getUint16(offset + 8, true), 0x0800);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(offset, endOffset);
});
