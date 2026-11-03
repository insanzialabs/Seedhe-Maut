// Run once per document load, before the existing audio and motion runtime starts.
export async function playLogoIntro() {
  const root = document.documentElement;
  const intro = document.querySelector('.project-intro');
  const logo = intro?.querySelector('img');
  if (!intro || !logo || !root.hasAttribute('data-logo-intro')) {
    intro?.remove();
    return;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let skip;
  let deadline;
  const skipped = new Promise(resolve => { skip = resolve; });
  const onKey = event => { if (event.key === 'Escape') skip(); };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const animate = (element, frames, options) => {
    if (!element.animate) return pause(options.duration);
    return element.animate(frames, { fill: 'forwards', ...options }).finished.catch(() => {});
  };
  document.addEventListener('keydown', onKey);
  try {
    await Promise.race([
      (async () => {
        await Promise.race([logo.decode().catch(() => {}), pause(1200)]);
        if (!logo.naturalWidth) return;
        if (reduced) {
          await animate(logo, [{ opacity: 1 }], { duration: 0 });
          await pause(350);
        } else {
          await animate(logo, [
            { opacity: 0, transform: 'perspective(900px) rotateX(-14deg) rotateY(-38deg) rotateZ(-45deg) scale(.72)', filter: 'blur(6px)' },
            { opacity: 1, transform: 'perspective(900px) rotateX(12deg) rotateY(32deg) rotateZ(135deg) scale(1.03)', filter: 'blur(0px)', offset: .2 },
            { opacity: 1, transform: 'perspective(900px) rotateX(-10deg) rotateY(-24deg) rotateZ(450deg) scale(1)', filter: 'blur(0px)', offset: .55 },
            { opacity: 1, transform: 'perspective(900px) rotateX(4deg) rotateY(8deg) rotateZ(690deg) scale(1.02)', filter: 'blur(0px)', offset: .85 },
            { opacity: 1, transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) rotateZ(720deg) scale(1)', filter: 'blur(0px)' },
          ], { duration: 2600, easing: 'cubic-bezier(.2,.55,.3,1)' });
        }
        await animate(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 120 : 300, easing: 'ease-in-out' });
      })(),
      skipped,
      new Promise(resolve => { deadline = setTimeout(resolve, 5500); }),
    ]);
  } finally {
    clearTimeout(deadline);
    document.removeEventListener('keydown', onKey);
    intro.querySelectorAll('*').forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
    intro.remove();
    root.removeAttribute('data-logo-intro');
  }
}
