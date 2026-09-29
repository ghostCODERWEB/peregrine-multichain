"""Turn the frame folders from `scripts/readme-assets/capture.ts` into README GIFs.

Usage: python3 scripts/readme-assets/make-gifs.py [name ...]   (needs Pillow)
"""
import json
import pathlib
import sys
from PIL import Image

FRAMES = pathlib.Path('.readme-frames')
OUT = pathlib.Path('docs/readme/gifs')
FPS = 15  # frames are resampled to this rate from their capture timestamps

OUT.mkdir(parents=True, exist_ok=True)
names = sys.argv[1:] or sorted(p.name for p in FRAMES.iterdir() if (p / 'meta.json').exists())
for name in names:
    meta = json.loads((FRAMES / name / 'meta.json').read_text())
    files = sorted((FRAMES / name).glob('*.jpg'))
    if not files:
        print('skip', name); continue
    c, s, width = meta['crop'], meta['scale'], meta['width']
    box = tuple(round(v * s) for v in (c['x'], c['y'], c['x'] + c['width'], c['y'] + c['height']))
    # Screencast frames arrive only when the page repaints: hold each until the next one's timestamp.
    stamps = [int(f.stem.split('-')[1]) for f in files]
    step = 1000 // FPS
    picks, t, j = [], stamps[0], 0
    while t <= stamps[-1] + 600:
        while j + 1 < len(stamps) and stamps[j + 1] <= t:
            j += 1
        picks.append(files[j]); t += step
    cache, frames = {}, []
    for f in picks:
        if f not in cache:
            im = Image.open(f).convert('RGB').crop(box)
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            cache[f] = im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        frames.append(cache[f])
    # Merge runs of identical frames into one longer frame: smaller files, same timing.
    out, durs = [frames[0]], [step]
    for fr in frames[1:]:
        if fr is out[-1]:
            durs[-1] += step
        else:
            out.append(fr); durs.append(step)
    durs[-1] += 1200  # rest on the last frame before the loop restarts
    out[0].save(OUT / f'{name}.gif', save_all=True, append_images=out[1:], duration=durs, loop=0, optimize=True)
    print(name, len(out), 'frames', (OUT / f'{name}.gif').stat().st_size // 1024, 'KB')
