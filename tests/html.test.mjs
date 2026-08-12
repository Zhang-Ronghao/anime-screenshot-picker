import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const manualMosaicHtml = await readFile(new URL('../public/manual-mosaic.html', import.meta.url), 'utf8');
const manualMosaicComponent = await readFile(new URL('../public/manual-mosaic-workshop.js', import.meta.url), 'utf8');

test('manual mosaic workshop belongs to the character source manual mode', () => {
  assert.doesNotMatch(html, /manualMosaicSourceBtn|AUTO_SOURCE_MANUAL_MOSAIC|<iframe/);
  assert.match(html, /id="manualMosaicPanel"[^>]*aria-label="手动马赛克人物题"/);
  assert.match(html, /<manual-mosaic-workshop><\/manual-mosaic-workshop>/);
  assert.match(html, /source === AUTO_SOURCE_FANCAPS \|\| source === AUTO_SOURCE_CHARACTER_MOSAIC/);
  assert.match(html, /isManualMosaic = !isAuto && source === AUTO_SOURCE_CHARACTER_MOSAIC/);
  assert.match(html, /自动抽取主角，或上传本地人物图手动制作/);
});

test('local image workshop keeps the original manual controls', () => {
  for (const id of [
    'fileInput',
    'globalPresets',
    'applyGlobalCustom',
    'removeAllBackgroundsBtn',
    'restoreAllBackgroundsBtn',
    'downloadAllBtn',
    'galleryContent',
    'inspector',
  ]) {
    assert.equal((manualMosaicHtml.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length, 1, `${id} should occur once`);
  }
  assert.match(manualMosaicHtml, /window\.addEventListener\("paste"/);
  assert.match(manualMosaicHtml, /async function removeWhiteBackgrounds/);
  assert.match(manualMosaicHtml, /async function downloadAll/);
  assert.match(manualMosaicHtml, /function setItemScope/);
});

test('embedded workshop preserves theme tokens and readable strength layouts', () => {
  assert.match(manualMosaicComponent, /replace\(\/:root\/g, ":host"\)/);
  assert.match(manualMosaicComponent, /grid-template-columns: repeat\(6, minmax\(68px, 1fr\)\)/);
  assert.match(manualMosaicComponent, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(manualMosaicComponent, /white-space: nowrap/);
});

test('page contains one unique set of mosaic controls', () => {
  for (const id of ['autoSourceBangumiCharacterBtn', 'mosaicSettings', 'mosaicStrength', 'mosaicStrengthReadout']) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length, 1, `${id} should occur once`);
  }
  assert.match(html, /setAutoImageSource\('bangumi-character-mosaic'\)/);
  assert.match(html, /id="mosaicStrength" type="range" min="1" max="6"/);
  assert.match(html, /"最弱", "较弱", "稍弱", "标准", "较强", "最强"/);
  assert.match(html, /Array\.from\(\{ length: 6 \}/);
  assert.match(html, /mosaicCustomBlockSizes \? "自定义"/);
  assert.match(html, /--mosaic-thumb-size: 18px/);
  assert.match(html, /--mosaic-progress.*\(strength - 1\) \/ 5/);
  assert.match(html, /grid-template-columns: auto 64px auto/);
  assert.match(html, /\["Strong", "强", blockSizes\[0\]\]/);
  assert.match(html, /\["Medium", "中", blockSizes\[1\]\]/);
  assert.match(html, /\["Weak", "弱", blockSizes\[2\]\]/);
});

test('question source is selected before the supported question mode', () => {
  const sourcePanelIndex = html.indexOf('id="sourcePanel"');
  const modePanelIndex = html.indexOf('id="modePanel"');
  const autoPanelIndex = html.indexOf('id="autoPanel"');
  assert.ok(sourcePanelIndex > 0 && sourcePanelIndex < modePanelIndex && modePanelIndex < autoPanelIndex);
  assert.match(html, /function syncQuestionSourceFlow\(\)/);
  assert.match(html, /modePanelEl\.style\.display = supportsManual \? "" : "none"/);
  assert.match(html, /switchMode\("auto", \{ announce: false, scroll: false \}\)/);
});

test('source buttons use concise labels without secondary descriptions', () => {
  for (const label of ['FanCaps 截图', 'Bangumi 封面', '马赛克人物题']) {
    assert.match(html, new RegExp(`class="auto-source-option[^>]*>${label}</button>`));
  }
  assert.doesNotMatch(html, /从已匹配截图池随机抽画面/);
  assert.doesNotMatch(html, /调用条目 API 读取 large 原图封面/);
  assert.doesNotMatch(html, /抽取首位主角并生成四阶段提示图/);
});

test('mosaic strength control is rendered with the generated draft and reuses source blobs', () => {
  assert.match(html, /游戏中分阶段展示：强马赛克 → 中马赛克 → 弱马赛克 → 原图（答案）/);
  assert.match(html, /\.mosaic-display-order\s*\{[\s\S]*?color: var\(--text\)/);
  assert.match(html, /\$\{isMosaicSource\(\) \? renderMosaicStrengthSettings\(\) : ""\}/);
  const guidanceIndex = html.indexOf('部分非人设图的马赛克效果不佳，建议手动更换。');
  const settingsIndex = html.indexOf('<div id="mosaicSettings" class="mosaic-settings">');
  assert.ok(guidanceIndex > 0 && guidanceIndex < settingsIndex);
  assert.match(html, /existingOriginalBlob instanceof Blob/);
  assert.match(html, /item\.originalImageBlob/);
  assert.match(html, /blockSizes: getMosaicBlockSizes\(\)/);
  assert.match(html, /强 > 中 > 弱/);
});

test('mosaic cards separate the anime title and retain standard draft metadata', () => {
  assert.match(html, /class="draft-anime-title"/);
  const personTitleIndex = html.indexOf('<div class="draft-title">${idx + 1}. ${escapeHtml(item.title)}</div>');
  const animeTitleIndex = html.indexOf('${isMosaic ? `<div class="draft-anime-title">');
  const metadataIndex = html.indexOf('<div class="draft-meta">${escapeHtml(item.date');
  assert.ok(personTitleIndex > 0 && animeTitleIndex > personTitleIndex && metadataIndex > animeTitleIndex);
  assert.match(html, /isCover \? "Bangumi 封面" : isMosaic \? "马赛克人物题" : "FanCaps 截图"/);
  assert.doesNotMatch(html, /人物保持不变，松开滑块后重绘全部图片/);
});

test('mosaic filenames contain both anime and character names', () => {
  assert.match(html, /`\$\{padded\}-\$\{character\}-\$\{anime\}-mosaic\.\$\{ext\}`/);
});

test('mosaic ZIP export resolves missing Chinese character names on demand', () => {
  assert.match(html, /entries = await prepareMosaicExportEntries\(entries\)/);
  assert.match(html, /fetchBangumiApi\(`\/v0\/characters\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(html, /item\.exportCharacterName \|\| item\.characterName/);
  assert.match(html, /characterChineseNamePromiseCache\.delete\(id\)/);
});

test('ZIP export requires all mosaic files and marks UTF-8 names', () => {
  assert.match(html, /requireAll: source === AUTO_SOURCE_CHARACTER_MOSAIC/);
  assert.equal((html.match(/setUint16\((?:6|8), 0x0800, true\)/g) || []).length, 2);
});

test('mosaic module loads before the main inline application script', () => {
  const moduleIndex = html.indexOf('<script src="./mosaic.js"></script>');
  const mainScriptIndex = html.indexOf('<script>', moduleIndex);
  assert.ok(moduleIndex > 0);
  assert.ok(mainScriptIndex > moduleIndex);
});

test('main inline application script parses as JavaScript', () => {
  const scripts = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.ok(scripts.length > 0);
  assert.doesNotThrow(() => new vm.Script(scripts.at(-1), { filename: 'public/index.html:inline' }));
});
