/** Equal-power, interruptible mixing. Only selected recordings are streamed. */
export function powerLevel(from, to, progress) {
  const weight = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI / 2) ** 2;
  return Math.sqrt((1 - weight) * from * from + weight * to * to);
}

export class DiscSoundtrack {
  constructor({ audioFactory = () => new Audio(), contextFactory = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(), onChange = () => {}, settle = 110 } = {}) {
    Object.assign(this, { audioFactory, contextFactory, onChange, settle });
    this.voices = new Set();
    this.blockers = new Set();
    this.enabled = false;
    this.selected = null;
    this.current = null;
    this.pending = null;
    this.context = null;
    this.version = 0;
    this.state = 'ready';
    this.destroyed = false;
  }
  get suppressed() { return !this.enabled || this.blockers.size > 0; }
  emit(state = this.state) {
    this.state = state;
    this.onChange({ state, enabled: this.enabled, selected: this.selected, playing: this.current?.track.slug ?? null });
  }
  initialize() {
    if (this.context) return;
    this.context = this.contextFactory();
    this.master = this.context.createGain();
    this.master.gain.setValueAtTime(0, this.context.currentTime);
    this.master.connect(this.context.destination);
    this.masterEnvelope = { from: 0, to: 0, start: 0, duration: 0 };
    this.context.onstatechange = () => {
      if (this.destroyed) return;
      if (this.context.state === 'running' && !this.suppressed) this.start();
      else if (!this.suppressed) this.emit('blocked');
    };
  }
  level(envelope) {
    if (!envelope.duration) return envelope.to;
    return powerLevel(envelope.from, envelope.to, (this.context.currentTime - envelope.start) / envelope.duration);
  }
  ramp(owner, node, to, duration) {
    const now = this.context.currentTime;
    const from = this.level(owner.envelope ?? this.masterEnvelope);
    const envelope = { from, to, start: now, duration };
    if (owner === this) this.masterEnvelope = envelope;
    else owner.envelope = envelope;
    const parameter = node.gain;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(from, now);
    for (let step = 1; step <= 32; step++) {
      parameter.linearRampToValueAtTime(powerLevel(from, to, step / 32), now + duration * step / 32);
    }
  }
  cancelPending() {
    this.version++;
    if (this.pending) this.dispose(this.pending.voice);
    this.pending = null;
    clearTimeout(this.selectionTimer);
  }
  select(track) {
    if (!track?.audio || this.destroyed) return;
    if (track.slug === this.selected?.slug) return;
    this.cancelPending();
    this.selected = track;
    this.emit(this.suppressed ? (this.enabled ? 'paused' : this.state) : 'loading');
    if (!this.suppressed && this.context) this.selectionTimer = setTimeout(() => this.start(), this.settle);
  }
  enable() {
    if (this.destroyed) return;
    this.enabled = true;
    try {
      this.initialize();
      // Resume is invoked synchronously inside the input handler, before any awaits.
      this.context.resume().catch(() => this.emit('blocked'));
      return this.start();
    } catch {
      this.enabled = false;
      this.emit('unavailable');
    }
  }
  disable() {
    this.enabled = false;
    this.quiet();
    this.emit('off');
  }
  setBlocked(reason, blocked) {
    const previous = this.suppressed;
    blocked ? this.blockers.add(reason) : this.blockers.delete(reason);
    if (this.suppressed) {
      if (!previous) this.quiet(reason === 'hidden' || reason === 'page');
      if (this.enabled) this.emit('paused');
    } else if (previous && this.context) {
      this.context.resume().catch(() => this.emit('blocked'));
      this.start();
    }
  }
  quiet(immediate = false) {
    this.cancelPending();
    clearTimeout(this.pauseTimer);
    if (!this.context) return;
    this.ramp(this, this.master, 0, immediate ? .03 : .14);
    const pause = () => { if (this.suppressed) for (const voice of this.voices) voice.audio.pause(); };
    if (immediate) pause();
    else this.pauseTimer = setTimeout(pause, 160);
  }
  makeVoice(track) {
    // Two mixing voices plus one silent loading voice; never an accumulating playlist.
    if (this.voices.size >= 3) {
      const candidates = [...this.voices].filter(voice => voice !== this.current);
      candidates.sort((a, b) => this.level(a.envelope) - this.level(b.envelope));
      if (candidates[0]) this.dispose(candidates[0]);
    }
    const audio = this.audioFactory();
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.src = track.audio;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, this.context.currentTime);
    const source = this.context.createMediaElementSource(audio);
    source.connect(gain); gain.connect(this.master);
    const voice = { audio, gain, source, track, envelope: { from: 0, to: 0, start: 0, duration: 0 } };
    voice.repeat = () => {
      if (this.current !== voice || this.suppressed || this.pending || this.selected?.slug !== track.slug) return;
      if (audio.ended || Number.isFinite(audio.duration) && audio.duration - audio.currentTime < .75) this.start(true);
    };
    voice.fail = () => {
      if (this.pending?.voice === voice) return; // play() rejection owns loading errors.
      if (this.current === voice) {
        this.dispose(voice); this.current = null;
        if (!this.suppressed) this.emit('error');
      }
    };
    audio.addEventListener('timeupdate', voice.repeat);
    audio.addEventListener('ended', voice.repeat);
    audio.addEventListener('error', voice.fail);
    this.voices.add(voice);
    return voice;
  }
  async start(restart = false) {
    const track = this.selected;
    if (!track || !this.context || this.suppressed || this.destroyed) return;
    if (this.pending?.voice.track.slug === track.slug) return;
    clearTimeout(this.selectionTimer);
    clearTimeout(this.pauseTimer);
    if (!restart && this.current?.track.slug === track.slug && !this.current.audio.ended) {
      const voice = this.current;
      clearTimeout(voice.stopTimer);
      try {
        await voice.audio.play();
        if (this.destroyed || this.suppressed || this.current !== voice || this.selected?.slug !== track.slug) return;
        this.ramp(voice, voice.gain, 1, .35);
        this.ramp(this, this.master, .6, .18);
        this.emit(this.context.state === 'running' ? 'playing' : 'blocked');
      } catch { if (!this.suppressed) this.emit('blocked'); }
      return;
    }
    this.cancelPending();
    const version = this.version;
    const voice = this.makeVoice(track);
    this.pending = { voice, version };
    this.emit('loading');
    try {
      await Promise.race([
        voice.audio.play(),
        new Promise((_, reject) => {
          voice.loadTimer = setTimeout(() => reject(new Error('The recording took too long to load.')), 12000);
        }),
      ]);
      clearTimeout(voice.loadTimer);
      if (version !== this.version || this.suppressed || this.destroyed) { this.dispose(voice); return; }
      this.pending = null;
      this.current = voice;
      this.ramp(voice, voice.gain, 1, .65);
      for (const other of this.voices) if (other !== voice) {
        clearTimeout(other.stopTimer);
        this.ramp(other, other.gain, 0, .65);
        other.stopTimer = setTimeout(() => this.dispose(other), 700);
      }
      this.ramp(this, this.master, .6, .18);
      this.emit(this.context.state === 'running' ? 'playing' : 'blocked');
    } catch (error) {
      clearTimeout(voice.loadTimer);
      if (version !== this.version || this.destroyed) { this.dispose(voice); return; }
      this.pending = null;
      this.dispose(voice);
      for (const other of this.voices) {
        this.ramp(other, other.gain, 0, .2);
        other.stopTimer = setTimeout(() => this.dispose(other), 230);
      }
      this.current = null;
      if (!this.suppressed) this.emit(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
    }
  }
  dispose(voice) {
    if (!this.voices.has(voice)) return;
    clearTimeout(voice.stopTimer);
    clearTimeout(voice.loadTimer);
    voice.audio.removeEventListener('timeupdate', voice.repeat);
    voice.audio.removeEventListener('ended', voice.repeat);
    voice.audio.removeEventListener('error', voice.fail);
    voice.audio.pause();
    voice.audio.removeAttribute('src');
    voice.audio.load();
    voice.source.disconnect(); voice.gain.disconnect();
    this.voices.delete(voice);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelPending(); clearTimeout(this.pauseTimer);
    for (const voice of [...this.voices]) this.dispose(voice);
    if (this.context) { this.context.onstatechange = null; this.master.disconnect(); this.context.close(); }
  }
}

/** Bridges the existing renderer/Barba lifecycle without modifying the vendor runtime. */
export function installSoundtrack() {
  const catalog = JSON.parse(document.querySelector('#soundtrack-catalog')?.textContent || '[]');
  const tracks = new Map(catalog.map(track => [track.slug, track]));
  const button = document.querySelector('[data-sound-toggle]');
  const status = document.querySelector('[data-sound-status]');
  const control = document.querySelector('[data-disc-sound]');
  let autoStart = true;
  let navigating = false;
  let attemptedWheel = false;
  try { autoStart = sessionStorage.getItem('sm-sound') !== 'off'; } catch { /* storage is optional */ }
  const engine = new DiscSoundtrack({ onChange({ state, enabled, selected }) {
    if (!button) return;
    const labels = { ready: 'ENABLE SOUND', off: 'SOUND OFF', paused: 'SOUND PAUSED', loading: 'TUNING IN', playing: 'SOUND ON', blocked: 'ENABLE SOUND', error: 'RETRY SOUND', unavailable: 'SOUND UNAVAILABLE' };
    button.textContent = labels[state];
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', `${enabled && !['blocked', 'error'].includes(state) ? 'Mute' : 'Enable'} song playback${selected ? ` — ${selected.title}` : ''}`);
    button.disabled = state === 'unavailable';
    control?.setAttribute('data-sound-state', state);
    if (status) status.textContent = state === 'error' ? 'This recording could not load. Select retry to try again.' : state === 'blocked' ? 'Select Enable sound to start the music.' : '';
  } });
  const selectSlug = value => { const track = tracks.get(value); if (track) engine.select(track); };
  const slugFromUrl = value => { try { return new URL(value, location.href).pathname.split('/').filter(Boolean).pop(); } catch { return null; } };
  function sync(container = document) {
    const detail = container.matches?.('[data-song-slug]') ? container : container.querySelector('[data-song-slug]');
    if (detail) { selectSlug(detail.getAttribute('data-song-slug')); return; }
    const gallery = container.querySelector('[data-disc-gallery]');
    if (gallery) {
      const active = gallery.querySelector('[data-film-status="active"] [data-film-field="detail-url"]') || gallery.querySelector('[data-film-field="detail-url"]');
      selectSlug(slugFromUrl(active?.getAttribute('href')));
    }
  }
  const listeners = [];
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };
  on(button, 'click', () => {
    autoStart = false;
    if (engine.enabled && !['blocked', 'error'].includes(engine.state)) engine.disable();
    else engine.enable();
    try { sessionStorage.setItem('sm-sound', engine.enabled ? 'on' : 'off'); } catch { /* optional */ }
  });
  const gesture = event => {
    if (!autoStart || event.target.closest?.('[data-sound-toggle], [data-trailer-src]')) return;
    if (event.type === 'keydown' && !['ArrowRight', 'ArrowLeft', 'Enter', ' '].includes(event.key)) return;
    if (engine.context?.state === 'running' && engine.enabled) return;
    if (event.type === 'wheel' && attemptedWheel) return;
    if (event.type === 'wheel') attemptedWheel = true;
    engine.enable();
  };
  for (const type of ['pointerdown', 'keydown', 'wheel']) on(document, type, gesture, { capture: true, passive: true });
  on(document, 'discgallerychange', event => {
    if (!navigating) selectSlug(slugFromUrl(event.detail?.film?.detailUrl));
  });
  on(document, 'click', event => {
    if (event.target.closest?.('[data-trailer-src]')) engine.setBlocked('video', true);
  }, { capture: true });
  const video = document.querySelector('[data-trailer-lightbox]');
  const videoObserver = new MutationObserver(() => {
    const active = ['opening', 'open', 'closing'].includes(video?.getAttribute('data-trailer-status'));
    engine.setBlocked('video', active);
  });
  if (video) videoObserver.observe(video, { attributes: true, attributeFilter: ['data-trailer-status'] });
  let loaded = document.readyState === 'complete';
  let fontsReady = !document.fonts;
  let startupAttempted = false;
  function checkEntrance() {
    if (startupAttempted) return;
    const gallery = document.querySelector('main[data-barba="container"] [data-disc-gallery]');
    const galleryReady = !gallery || gallery.classList.contains('gallery-has-fallback') ||
      gallery.getAttribute('data-disc-ready') === 'true' && gallery.getAttribute('data-disc-flight') !== 'true';
    const ready = loaded && fontsReady && galleryReady && !document.documentElement.hasAttribute('data-preload');
    engine.setBlocked('entrance', !ready);
    if (!ready) return;
    startupAttempted = true;
    entranceObserver.disconnect();
    // Attempt playback on completed entrance, without requiring a click. Browser
    // autoplay policy can still reject it; the existing gesture/button path retries.
    if (autoStart && !engine.enabled) engine.enable();
  }
  const entranceObserver = new MutationObserver(checkEntrance);
  entranceObserver.observe(document.documentElement, {
    attributes: true, subtree: true,
    attributeFilter: ['data-preload', 'data-disc-ready', 'data-disc-flight', 'class'],
  });
  engine.setBlocked('entrance', true);
  on(window, 'load', () => { loaded = true; checkEntrance(); });
  Promise.resolve(document.fonts?.ready).then(() => { fontsReady = true; checkEntrance(); });
  on(document, 'visibilitychange', () => engine.setBlocked('hidden', document.hidden));
  engine.setBlocked('hidden', document.hidden);
  on(window, 'pagehide', () => engine.setBlocked('page', true));
  on(window, 'pageshow', () => engine.setBlocked('page', false));
  sync();
  engine.emit(autoStart ? 'ready' : 'off');
  checkEntrance();
  return {
    engine,
    connect(barba) {
      barba.hooks.before(() => { navigating = true; });
      barba.hooks.beforeEnter(data => {
        if (data.next.namespace === 'production') selectSlug(slugFromUrl(data.next.url.href));
      });
      barba.hooks.afterEnter(data => { navigating = false; sync(data.next.container); });
    },
    destroy() { listeners.forEach(remove => remove()); videoObserver.disconnect(); entranceObserver.disconnect(); engine.destroy(); },
  };
}
