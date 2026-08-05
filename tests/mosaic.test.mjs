import test from 'node:test';
import assert from 'node:assert/strict';

await import('../public/mosaic.js');
const composer = globalThis.MosaicComposer;

test('mosaic layout uses an exact 16:9 nine-column canvas', () => {
  assert.equal(composer.CANVAS_WIDTH, 1440);
  assert.equal(composer.CANVAS_HEIGHT, 810);
  assert.equal(composer.COLUMN_WIDTH, 160);
  assert.equal(composer.PANEL_PADDING, 16);
  assert.deepEqual([0, 1, 2, 3].map(index => composer.getPanelRect(index).x), [0, 320, 640, 1120]);
  assert.equal(composer.getPanelRect(3).width, 320);
});

test('global strength preserves strong, medium and weak ordering', () => {
  assert.deepEqual(composer.getBlockSizes(1), [37, 19, 9]);
  assert.deepEqual(composer.getBlockSizes(2), [44, 22, 11]);
  assert.deepEqual(composer.getBlockSizes(5), [77, 39, 19]);
  assert.deepEqual(composer.getBlockSizes(6), [95, 47, 24]);
  for (let strength = 1; strength <= 6; strength++) {
    const [strong, medium, weak] = composer.getBlockSizes(strength);
    assert.ok(strong > medium && medium > weak);
  }
});

test('custom block sizes accept ordered values and reject unsafe input', () => {
  assert.deepEqual(composer.resolveBlockSizes([80, 40, 20], 4), [80, 40, 20]);
  assert.deepEqual(composer.resolveBlockSizes(null, 4), [64, 32, 16]);
  assert.throws(() => composer.resolveBlockSizes([20, 40, 10], 4), /强 > 中 > 弱/);
  assert.throws(() => composer.resolveBlockSizes([200, 40, 10], 4), /3–160/);
});

test('contain positioning centers portrait and landscape images without overflow', () => {
  const panel = composer.getPanelRect(0);
  const portrait = composer.calculateContainRect(1200, 1800, panel);
  assert.equal(portrait.x, 16);
  assert.equal(portrait.width, 288);
  assert.ok(portrait.y > 0);
  assert.ok(portrait.y + portrait.height <= 810);

  const landscape = composer.calculateContainRect(1600, 900, panel);
  assert.equal(landscape.x, 16);
  assert.equal(landscape.width, 288);
  assert.ok(landscape.y >= 16);
  assert.ok(landscape.y > portrait.y);
  assert.ok(landscape.y + landscape.height <= 810);
});

test('composer paints white and draws three pixelated panels plus the original', async () => {
  const oldCreateImageBitmap = globalThis.createImageBitmap;
  const canvases = [];
  globalThis.createImageBitmap = async () => ({ width: 1200, height: 1800, close() {} });

  function canvasFactory(width, height) {
    const calls = [];
    const context = {
      calls,
      fillStyle: '',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low',
      fillRect(...args) { calls.push(['fillRect', ...args]); },
      drawImage(...args) { calls.push(['drawImage', ...args]); },
      save() { calls.push(['save']); },
      restore() { calls.push(['restore']); },
      beginPath() { calls.push(['beginPath']); },
      rect(...args) { calls.push(['rect', ...args]); },
      clip() { calls.push(['clip']); },
    };
    const canvas = {
      width,
      height,
      context,
      getContext() { return context; },
      toBlob(callback, type) { callback(new Blob(['jpeg'], { type })); },
    };
    canvases.push(canvas);
    return canvas;
  }

  try {
    const blob = await composer.composeFromBlob(new Blob(['source'], { type: 'image/jpeg' }), {
      strength: 4,
      blockSizes: [80, 40, 20],
      canvasFactory,
    });
    assert.equal(blob.type, 'image/jpeg');
    const output = canvases.find(canvas => canvas.width === 1440 && canvas.height === 810);
    assert.ok(output);
    assert.deepEqual(output.context.calls[0], ['fillRect', 0, 0, 1440, 810]);
    const panelRects = output.context.calls.filter(call => call[0] === 'rect');
    assert.deepEqual(panelRects.map(call => call[1]), [0, 320, 640, 1120]);
    assert.equal(output.context.calls.filter(call => call[0] === 'drawImage').length, 4);
    const sampleSizes = canvases
      .filter(canvas => canvas !== output)
      .map(canvas => [canvas.width, canvas.height]);
    assert.deepEqual(sampleSizes, [[4, 5], [7, 11], [14, 22]]);
  } finally {
    globalThis.createImageBitmap = oldCreateImageBitmap;
  }
});
