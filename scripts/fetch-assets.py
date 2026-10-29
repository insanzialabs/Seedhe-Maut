"""Download local assets for the reference adaptation. Not needed to run/build the app."""
import concurrent.futures
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://a24.raviklaassens.com'
FILES = {
    '/_astro/three.module.CFOTFKy5.js': 'vendor/three.module.CFOTFKy5.js',
    '/_astro/three.module.B1_OyRqk.js': 'vendor/three.module.B1_OyRqk.js',
    '/_astro/RectAreaLightUniformsLib.DJtkkHJU.js': 'vendor/RectAreaLightUniformsLib.DJtkkHJU.js',
    '/fonts/PPNeueMontreal-Medium.woff2': 'fonts/PPNeueMontreal-Medium.woff2',
    '/fonts/PPEiko-Regular.woff2': 'fonts/PPEiko-Regular.woff2',
    '/fonts/PPMuseum-Regular.woff2': 'fonts/PPMuseum-Regular.woff2',
    '/images/noise_1noise.avif': 'images/noise_1noise.avif',
    '/images/grid-tile.svg': 'images/grid-tile.svg',
}

def download(task):
    url, relative = task
    path = ROOT / 'public' / relative
    if path.exists() and path.stat().st_size:
        return f'cached {relative}'
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                    '--max-time', '40', '--retry', '2', url, '-o', str(path)], check=True)
    return f'{relative}: {path.stat().st_size:,} bytes'

if __name__ == '__main__':
    tasks = [(BASE + url, target) for url, target in FILES.items()]
    songs = json.loads((ROOT / 'manifest.json').read_text())
    tasks += [(song['cover'], f'artwork/{song["year"]}.jpg') for song in songs]
    tracks_path = ROOT / 'src/tracks.json'
    if tracks_path.exists():
        tracks = json.loads(tracks_path.read_text())
        tasks += [(f'https://i.ytimg.com/vi/{track["videoId"]}/maxresdefault.jpg',
                   f'images/{track["slug"]}.jpg') for track in tracks]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for result in pool.map(download, tasks):
            print(result)
