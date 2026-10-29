import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, output, build } from '../scripts/build.mjs';

const { tracks } = await build({ quiet: true });
const html = relative => readFile(path.join(output, relative), 'utf8');

test('the source manifest is preserved and the ten chronological chapters have unique routes and official media', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(tracks.length, manifest.length);
  assert.equal(new Set(tracks.map(track => track.slug)).size, 10);
  for (const [index, track] of tracks.entries()) {
    for (const [key, value] of Object.entries(manifest[index])) assert.deepEqual(track[key], value);
    assert.equal(Number(track.year), 2017 + index);
    assert.match(track.videoId, /^[\w-]{11}$/);
    assert.match(track.spotify, /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}$/);
  }
});

test('Journey and Archive expose opposite orders to the same disc renderer', async () => {
  for (const [file, list, namespace] of [
    ['index.html', tracks, 'films'], ['archive/index.html', tracks.toReversed(), 'television'],
  ]) {
    const source = await html(file);
    assert.match(source, new RegExp(`data-barba-namespace="${namespace}"`));
    const titles = [...source.matchAll(/data-film-field="title"[^>]*>([^<]+)/g)].map(match => match[1]);
    assert.deepEqual(titles, list.map(track => track.title.replace(/&/g, '&amp;')));
    assert.equal((source.match(/data-film-item/g) || []).length, 10);
    assert.match(source, /data-gallery-fallback/);
    assert.match(source, /<noscript>/);
  }
});

test('every song has a distinct detail page, native playback triggers and a wrapping next-song route', async () => {
  for (const [index, track] of tracks.entries()) {
    const source = await html(`songs/${track.slug}/index.html`);
    const next = tracks[(index + 1) % tracks.length];
    assert.match(source, /data-barba-namespace="production"/);
    assert.ok(source.includes(track.videoId));
    assert.ok(source.includes(track.spotify));
    assert.ok(source.includes(track.still));
    assert.match(source, /data-dissolve=""/);
    assert.match(source, /data-scroll-next-canvas=""/);
    assert.ok(source.includes(`href="/songs/${next.slug}"`));
    assert.equal((source.match(/data-scroll-next-item/g) || []).length, 10);
    assert.equal((source.match(/data-trailer-src/g) || []).length, 2);
    assert.doesNotMatch(source, /Marty Supreme|Timothée|Backrooms|The Playlist|The Daily Beast/);
  }
});

test('the motion adaptation preserves the physical geometry and exact motion settings', async () => {
  const runtime = await readFile(path.join(root, 'public/vendor/main.qdXy8l6N.js'), 'utf8');
  for (const setting of ['galleryRotX:-30', 'galleryRotY:-30', 'cameraDistance:4.4',
    'snapDuration:.46', 'snapFreq:9.5', 'snapDamping:12', 'minDuration:2.85',
    'inDuration:.7', 'outDuration:.4', 'backIridescence:1', 'scribbleFps:10']) {
    assert.ok(runtime.includes(setting), `Missing reference motion setting: ${setting}`);
  }
  assert.ok(runtime.includes('value:`S10`'));
  assert.ok(runtime.includes('e.startsWith(`S`)'));
  assert.ok(runtime.includes('e===`drum`?nt:`S`'));
  assert.doesNotMatch(runtime, /https:\/\/cloud\.umami/);
});
