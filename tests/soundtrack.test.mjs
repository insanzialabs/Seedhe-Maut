import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscSoundtrack, powerLevel } from '../public/soundtrack.js';

class FakeAudio extends EventTarget {
  constructor(play) { super(); this.playBehavior = play; this.paused = true; this.currentTime = 0; this.duration = 60; this.ended = false; }
  play() { this.paused = false; return this.playBehavior?.(this) ?? Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() {}
}
const node = () => ({
  gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} },
  connect() {}, disconnect() {},
});
function harness(t, play) {
  const audios = [];
  const states = [];
  const context = { currentTime: 0, state: 'running', destination: {}, createGain: node,
    createMediaElementSource: node, resume: () => Promise.resolve(), close: () => Promise.resolve() };
  const engine = new DiscSoundtrack({ audioFactory: () => { const audio = new FakeAudio(play); audios.push(audio); return audio; },
    contextFactory: () => context, onChange: state => states.push(state) });
  t.after(() => engine.destroy());
  return { engine, context, audios, states };
}
const track = slug => ({ slug, title: slug, audio: `/music/${slug}.mp3` });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('crossfade holds constant power and starts interrupted ramps from the actual current level', async t => {
  const { engine, context } = harness(t);
  engine.select(track('a')); await engine.enable();
  const first = engine.current;
  context.currentTime = 1;
  engine.select(track('b')); await engine.start();
  const second = engine.current;
  context.currentTime += .325;
  assert.ok(Math.abs(engine.level(first.envelope) ** 2 + engine.level(second.envelope) ** 2 - 1) < 1e-10);
  const current = engine.level(second.envelope);
  engine.select(track('c')); await engine.start();
  assert.ok(Math.abs(second.envelope.from - current) < 1e-10);
  assert.ok(Number.isFinite(powerLevel(0, 1, .5)));
});

test('slow stale loads cannot override a newer selected disc', async t => {
  let release;
  const { engine } = harness(t, audio => audio.src === '/music/slow.mp3' ? new Promise(resolve => { release = resolve; }) : Promise.resolve());
  engine.select(track('a')); await engine.enable();
  engine.select(track('slow')); const stale = engine.start();
  const pendingAudio = engine.pending.voice.audio;
  engine.select(track('latest')); await engine.start();
  release(); await stale;
  assert.equal(engine.current.track.slug, 'latest');
  assert.equal(pendingAudio.paused, true);
  assert.equal(pendingAudio.src, '');
});

test('rapid navigation is bounded to three media voices and preserves same-song position', async t => {
  const { engine, context } = harness(t);
  engine.select(track('a')); await engine.enable();
  for (let i = 0; i < 20; i++) {
    context.currentTime += .05;
    engine.select(track(`song-${i}`)); await engine.start();
    assert.ok(engine.voices.size <= 3);
  }
  const current = engine.current;
  current.audio.currentTime = 27;
  engine.select(track('song-19')); await engine.start();
  assert.equal(engine.current, current);
  assert.equal(engine.current.audio.currentTime, 27);
});

test('muting survives selection changes; hidden-tab and video blockers compose independently', async t => {
  const { engine, audios } = harness(t);
  engine.select(track('a')); await engine.enable();
  engine.disable();
  const count = audios.length;
  engine.select(track('b'));
  assert.equal(audios.length, count);
  assert.equal(engine.enabled, false);
  await engine.enable();
  assert.equal(engine.current.track.slug, 'b');
  engine.setBlocked('hidden', true);
  assert.ok([...engine.voices].every(voice => voice.audio.paused));
  engine.setBlocked('video', true);
  engine.setBlocked('hidden', false);
  assert.equal(engine.suppressed, true);
  engine.setBlocked('video', false); await flush();
  assert.equal(engine.suppressed, false);
  assert.equal(engine.state, 'playing');
});

test('autoplay denial is recoverable and media failure never leaves the wrong song playing', async t => {
  let allowed = false;
  const { engine } = harness(t, audio => {
    if (!allowed) return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
    if (audio.src === '/music/missing.mp3') return Promise.reject(Object.assign(new Error('missing'), { name: 'NotSupportedError' }));
    return Promise.resolve();
  });
  engine.select(track('a')); await engine.enable();
  assert.equal(engine.state, 'blocked');
  allowed = true; await engine.enable();
  assert.equal(engine.state, 'playing');
  engine.select(track('missing')); await engine.start();
  assert.equal(engine.state, 'error');
  assert.equal(engine.current, null);
  assert.ok([...engine.voices].every(voice => voice.envelope.to === 0));
});

test('near-end looping crossfades into a new voice and teardown releases every source', async t => {
  const { engine, context, audios } = harness(t);
  engine.select(track('a')); await engine.enable();
  const previous = engine.current;
  context.currentTime = 5;
  previous.audio.currentTime = 59.5;
  previous.audio.dispatchEvent(new Event('timeupdate'));
  await flush();
  assert.notEqual(engine.current, previous);
  assert.equal(engine.current.track.slug, 'a');
  engine.destroy();
  assert.equal(engine.voices.size, 0);
  assert.ok(audios.every(audio => audio.paused && audio.src === ''));
});
