// The original motion runtime owns rendering, gesture physics, navigation and playback.
// This module adds only content-specific accessibility, recovery and external media links.
const galleries = new WeakSet();
const player = document.querySelector('[data-trailer-lightbox]');
const externalPlayerLink = player?.querySelector('[data-player-external]');
let lastPlayerTrigger = null;

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-trailer-src]');
  if (trigger && externalPlayerLink) {
    lastPlayerTrigger = trigger;
    externalPlayerLink.href = trigger.getAttribute('data-trailer-src');
  }
}, { capture: true });

function revealArchive(gallery) {
  if (!gallery.isConnected || gallery.getAttribute('data-disc-ready') === 'true') return;
  gallery.classList.add('gallery-has-fallback');
  gallery.removeAttribute('tabindex');
  gallery.querySelector('[data-gallery-fallback]')?.removeAttribute('hidden');
  document.documentElement.removeAttribute('data-preload');
  document.querySelector('[data-preloader]')?.remove();
  if (window.sitePreloader) window.sitePreloader.active = false;
  window.siteScrollLock?.unlock();
  window.siteState?.lenis?.start();
  document.querySelectorAll('.nav-bg, .nav-center__list > li').forEach(element => {
    element.style.visibility = 'visible';
  });
}

function enhancePage(container = document) {
  const archive = location.pathname.replace(/\/$/, '') === '/archive';
  document.querySelectorAll('.nav-center__list > li > a.nav-link').forEach(link => {
    const active = link.getAttribute('href') === (archive ? '/archive' : '/') &&
      !location.pathname.startsWith('/songs/');
    link.classList.toggle('w--current', active);
    active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
  });
  container.querySelectorAll('.testimonial__stars').forEach(element => element.setAttribute('aria-hidden', 'true'));
  container.querySelectorAll('[data-disc-gallery]').forEach(gallery => {
    if (galleries.has(gallery)) return;
    galleries.add(gallery);
    gallery.setAttribute('aria-label', 'Seedhe Maut song disc gallery');
    gallery.addEventListener('discgallerychange', () => {
      gallery.querySelectorAll('.testimonial__stars').forEach(element => element.setAttribute('aria-hidden', 'true'));
    });
    const timeout = setTimeout(() => revealArchive(gallery), 20000);
    const observer = new MutationObserver(() => {
      if (gallery.getAttribute('data-disc-ready') === 'true' || !gallery.isConnected) {
        clearTimeout(timeout); observer.disconnect();
      }
    });
    observer.observe(gallery, { attributes: true, attributeFilter: ['data-disc-ready'] });
  });
}

// Preserve a useful way to listen when a video is unavailable in the visitor's region.
if (player) {
  new MutationObserver(() => {
    if (player.getAttribute('data-trailer-status') === 'open' && lastPlayerTrigger) {
      player.setAttribute('aria-label', 'Seedhe Maut music player');
    }
  }).observe(player, { attributes: true, attributeFilter: ['data-trailer-status'] });
}

enhancePage();
try {
  await import('./vendor/bootstrap.dru0MhUJ.js');
  window.barba?.hooks.afterEnter(data => enhancePage(data.next.container));
  enhancePage();
} catch (error) {
  console.error('The interactive archive could not start.', error);
  document.querySelectorAll('[data-disc-gallery]').forEach(revealArchive);
  document.documentElement.removeAttribute('data-preload');
  // Detail pages remain readable and external listening links remain usable.
  document.querySelectorAll('[data-reveal]').forEach(element => {
    element.style.visibility = 'visible'; element.style.opacity = '1';
  });
}
