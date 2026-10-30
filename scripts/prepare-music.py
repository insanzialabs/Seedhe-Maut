"""Prepare the supplied recordings for web delivery. Run locally, not on Vercel."""
from pathlib import Path
import json, subprocess
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
 'seedhe-maut-anthem': 'Seedhe Maut Anthem - Seedhe Maut (mp3cut.net).wav',
 'pankh': 'Seedhe Maut - Pankh feat. Bawari Basanti (Prod. by Sez On The Beat) - Seedhe Maut (mp3cut.net).wav',
 '101': 'Seedhe Maut - 101 - Seedhe Maut (mp3cut.net).mp3',
 'roshni': 'SickFlip & Ritviz - Roshni feat. Seedhe Maut (Official Music Video) - SickFlip (mp3cut.net).mp3',
 'nanchaku': 'Seedhe Maut - _Nanchaku_ ft MC STΔN  Azadi Records - Seedhe Maut (mp3cut.net).mp3',
 'nalla-freestyle': 'नalla Freestyle - Seedhe Maut (mp3cut.net).mp3',
 'khatta-flow': 'Khatta Flow - Seedhe Maut ft KRNA - Seedhe Maut (mp3cut.net).mp3',
 'raat-ki-rani': 'Seedhe Maut - Raat ki Rani  Shakti  dl91 - Seedhe Maut (mp3cut.net).mp3',
 'madira': 'Madira - Seedhe Maut (mp3cut.net).mp3',
 'buzz': 'SEEDHE MAUT x KRNA - BUZZ - Seedhe Maut (mp3cut.net).mp3',
}

def prepare(item):
 slug, filename = item
 source = ROOT / 'assets/music' / filename
 output = ROOT / 'public/music' / (slug + '.mp3')
 if not output.exists() or output.stat().st_mtime < source.stat().st_mtime:
  output.parent.mkdir(parents=True, exist_ok=True)
  temporary = output.with_suffix('.tmp.mp3')
  subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(source),
    '-vn','-af','loudnorm=I=-18:TP=-2:LRA=9','-codec:a','libmp3lame','-b:a','160k',
    '-ar','44100','-ac','2','-map_metadata','-1',str(temporary)],check=True)
  temporary.replace(output)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries',
   'format=duration','-of','default=noprint_wrappers=1:nokey=1',str(output)]))
 return slug, round(duration,3)

if __name__ == '__main__':
 with ThreadPoolExecutor(max_workers=2) as pool:
  durations=dict(pool.map(prepare,SOURCES.items()))
 path=ROOT/'src/tracks.json'
 tracks=json.loads(path.read_text())
 for track in tracks:
  track['audio']='/music/'+track['slug']+'.mp3'
  track['audioDuration']=durations[track['slug']]
 path.write_text(json.dumps(tracks,ensure_ascii=False,indent=2)+'\n')
 print('Prepared 10 loudness-matched 160 kbps MP3 recordings; original files untouched.')
