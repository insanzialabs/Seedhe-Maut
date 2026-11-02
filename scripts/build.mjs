import { readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const output = path.join(root, 'dist');
export const siteOrigin = 'https://seedhe-maut.insanzialabs.com';
const read = name => readFile(path.join(root, name), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const route = track => `/songs/${track.slug}`;
const video = track => `https://www.youtube.com/watch?v=${track.videoId}`;

function render(template, values) {
  const result = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`Missing template value: ${name}`);
    return values[name];
  });
  if (/\{\{[^}]+\}\}/.test(result)) throw new Error('Unresolved template token');
  return result;
}

const field = (name, value, prefix = 'film') => `<p data-${prefix}-field="${name}" class="paragraph-xxs">${escape(value)}</p>`;
const paragraph = (value, className = 'paragraph-m') => `<p class="custom-element ${className}" data-reveal="text">${escape(value)}</p>`;

function songItem(track) {
  const review = (publication, testimonial) => `<div data-review-source-item>${field('review-publication', publication)}${field('review-testimonial', testimonial)}${field('review-stars', 5)}</div>`;
  return `<div data-film-item role="listitem" class="collection-item w-dyn-item">
    ${field('title', track.title)}${field('year', track.year)}
    ${track.artists.split(', ').map(artist => field('directors', artist)).join('')}
    ${field('starring', track.producer)}${field('type', 'Film')}
    ${field('disc-art-url', track.artwork)}${field('disc-art-alt', `${track.title} — official cover artwork`)}
    <a data-film-field="detail-url" href="${route(track)}"></a>
    ${review('SPOTIFY · OCT 28, 2026', track.streams)}${review(track.era, track.caption)}
  </div>`;
}

function nextItem(track) {
  const values = { title: track.title, type: 'Film', 'disc-art-url': track.artwork,
    slug: track.slug, year: track.year, genre: track.album, runtime: '' };
  return `<div class="w-dyn-item" data-scroll-next-item role="listitem">${Object.entries(values).map(([key, value]) => field(key, value, 'scroll-next')).join('')}<a data-scroll-next-field="detail-url" href="${route(track)}"></a></div>`;
}

const indexItems = tracks => tracks.map(track => `<div role="listitem" class="w-dyn-item"><a data-film-scroll="${escape(track.title)}" href="${route(track)}" class="nav-dropdown__link w-inline-block" data-barba-prevent><div class="nav-dropdown__link-inner"><h2 class="nav-dropdown__link-label">${escape(track.title)}</h2><span class="nav-dropdown__link-label">${track.year}</span></div></a></div>`).join('');
const fallbackItems = tracks => tracks.map(track => `<a href="${route(track)}"><img src="${track.artwork}" alt="" width="640" height="640" loading="lazy"><span>${escape(track.title)}</span><small>${track.year}</small></a>`).join('');

export async function build({ quiet = false } = {}) {
  const [shell, gallery, song, rawTracks] = await Promise.all([
    read('src/templates/shell.html'), read('src/templates/gallery.html'),
    read('src/templates/song.html'), read('src/tracks.json'),
  ]);
  const tracks = JSON.parse(rawTracks);
  if (tracks.length !== 10 || new Set(tracks.map(track => track.slug)).size !== 10) {
    throw new Error('The archive must contain ten uniquely routed chapters.');
  }
  for (const track of tracks) {
    if (!track.audio?.startsWith('/music/') || !(await stat(path.join(root, 'public', track.audio))).isFile()) {
      throw new Error(`Missing prepared recording for ${track.title}. Run scripts/prepare-music.py locally.`);
    }
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'public'), output, { recursive: true });
  const page = async (relative, main, meta, list = tracks) => {
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, render(shell, {
      MAIN: main, INDEX_ITEMS: indexItems(list),
      PAGE_TITLE: escape(meta.title), PAGE_DESCRIPTION: escape(meta.description),
      PAGE_IMAGE: escape(new URL(meta.image, siteOrigin).href),
      PAGE_URL: escape(new URL(relative === 'index.html' ? '/' : '/' + relative.replace(/\/index\.html$/, ''), siteOrigin).href),
      MUSIC_DATA: JSON.stringify(tracks.map(({ slug, title, audio }) => ({ slug, title, audio }))).replace(/</g, '\\u003c'),
    }));
  };
  const makeGallery = (list, namespace) => render(gallery, {
    NAMESPACE: namespace, SONG_ITEMS: list.map(songItem).join(''), FALLBACK_ITEMS: fallbackItems(list),
    TITLE: escape(list[0].title), ARTISTS: escape(list[0].artists), YEAR: list[0].year,
    PRODUCER: escape(list[0].producer), STREAMS: escape(list[0].streams),
    ERA: escape(list[0].era), CAPTION: escape(list[0].caption),
  });
  await page('index.html', makeGallery(tracks, 'films'), {
    title: 'Seedhe Maut — Ten Chapters',
    description: '2017—2026. Ten songs. Two voices. Explore the Seedhe Maut journey through an interactive disc archive.',
    image: tracks[0].artwork,
  });
  const reversed = tracks.toReversed();
  await page('archive/index.html', makeGallery(reversed, 'television'), {
    title: 'Seedhe Maut — Archive', description: 'The Seedhe Maut song archive, from BUZZ back to the beginning.',
    image: reversed[0].artwork,
  }, reversed);

  for (const [index, track] of tracks.entries()) {
    const next = tracks[(index + 1) % tracks.length];
    const credit = (label, values) => `${paragraph(label, 'subheading-xs')}<div class="w-dyn-list"><div class="credits-item__list w-dyn-items" role="list">${values.map(value => `<div class="w-dyn-item" role="listitem">${paragraph(value)}</div>`).join('')}</div></div>`;
    const notes = [
      ['CHAPTER', `${String(track.chapter).padStart(2, '0')} / 10`],
      ['ERA', track.era], ['PROJECT', track.album], ['PRODUCED BY', track.producer],
      ['SPOTIFY STREAMS', track.streams], ['SNAPSHOT', 'October 28, 2026 · supplied archive figures'],
    ];
    const main = render(song, {
      TITLE: escape(track.title), YEAR: track.year, ALBUM: escape(track.album),
      CHAPTER: String(track.chapter).padStart(2, '0'),
      CREDITS: credit('ARTISTS', track.artists.split(', ')) + credit('PRODUCED BY', [track.producer]),
      SPOTIFY: escape(track.spotify), YOUTUBE: escape(video(track)), STILL: track.still,
      CAPTION: escape(track.caption), DESCRIPTION: escape(track.desc),
      DETAIL_NOTES: notes.map(([label, value]) => `<div class="song-meta-group">${paragraph(label, 'subheading-xs')}${paragraph(value)}</div>`).join('') +
        (track.footnote ? paragraph(track.footnote, 'subheading-xs') : ''),
      NEXT_ITEMS: tracks.map(nextItem).join(''), NEXT_TITLE: escape(next.title), NEXT_URL: route(next),
    });
    await page(`songs/${track.slug}/index.html`, main.replace('<main ', `<main data-song-slug="${track.slug}" `), {
      title: `${track.title} — Seedhe Maut`, description: track.desc, image: track.artwork,
    });
  }
  // Plain links keep the whole catalog available with JavaScript disabled.
  const pages = ['index.html', 'archive/index.html', ...tracks.map(track => `songs/${track.slug}/index.html`)];
  for (const file of pages) {
    const track = tracks.find(item => file === `songs/${item.slug}/index.html`);
    const content = track
      ? `<h1>${escape(track.title)}</h1><p>${escape(track.desc)}</p><img src="${track.artwork}" alt="Official cover" width="320" height="320" style="max-width:320px"><p><a href="${video(track)}">Listen on YouTube</a> · <a href="${track.spotify}">Listen on Spotify</a></p><p><a href="/">All ten chapters</a></p>`
      : `<h1>Seedhe Maut — Ten Chapters</h1><p>Enable JavaScript for the interactive disc experience, or choose a song below.</p>${fallbackItems(tracks)}`;
    const noScript = `<noscript><style>main[data-barba="container"]{display:none!important}.nav,.disc-sound{display:none!important}</style><main class="no-script">${content}</main></noscript>`;
    const target = path.join(output, file);
    await writeFile(target, (await readFile(target, 'utf8')).replace('</body>', `${noScript}</body>`));
  }
  await writeFile(path.join(output, 'tracks.json'), JSON.stringify(tracks));
  const urls = ['/', '/archive', ...tracks.map(route)];
  await writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${siteOrigin}${url}</loc></url>`).join('')}</urlset>\n`);
  await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`);
  await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Song not found — Seedhe Maut</title><link rel="stylesheet" href="/adaptation.css"><body class="not-found"><main><p>404 / SEEDHE MAUT</p><h1>This track isn’t in the archive.</h1><a href="/">Back to the journey</a></main></body></html>');
  if (!quiet) console.log(`Built ${pages.length} pages and all local assets in dist/.`);
  return { tracks, pages };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
