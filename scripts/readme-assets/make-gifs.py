"""Turn the frame folders from `scripts/readme-assets/capture.ts` into README GIFs.

Usage: python3 scripts/readme-assets/make-gifs.py [name ...]   (needs Pillow, numpy and ffmpeg:
FFMPEG=path, else `ffmpeg` on PATH, else the binary from `pip install imageio-ffmpeg`)

Frames are cropped to the recorded box (scaled by the frames' real resolution), resampled to a
steady frame rate from their capture timestamps, and trimmed of the blank frames a page shows
before it paints, so a GIF never opens on a black screen. ffmpeg encodes them with one shared
palette and only the changed rectangle per frame; a GIF over 15 MB is re-encoded narrower.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

FRAMES = pathlib.Path('.readme-frames')
OUT = pathlib.Path('docs/readme/gifs')
FPS = 15
LIMIT = 15 * 1024 * 1024


def ffmpeg() -> str:
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    if shutil.which('ffmpeg'):
        return 'ffmpeg'
    import imageio_ffmpeg  # type: ignore
    return imageio_ffmpeg.get_ffmpeg_exe()


def encode(frames: list, width: int, out: pathlib.Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        for i, im in enumerate(frames):
            im.resize((width, round(im.height * width / im.width)), Image.LANCZOS).save(f'{tmp}/{i:05d}.png')
        graph = 'split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle'
        subprocess.run([ffmpeg(), '-nostdin', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', f'{tmp}/%05d.png',
                        '-filter_complex', graph, '-loop', '0', str(out)], check=True)


OUT.mkdir(parents=True, exist_ok=True)
names = sys.argv[1:] or sorted(p.name for p in FRAMES.iterdir() if (p / 'meta.json').exists())
for name in names:
    meta = json.loads((FRAMES / name / 'meta.json').read_text())
    files = sorted((FRAMES / name).glob('*.jpg'))
    if not files:
        print('skip', name); continue
    c, width = meta['crop'], meta['width']
    scale = Image.open(files[0]).width / meta['viewport']['width']  # the frames' real resolution
    box = tuple(round(v * scale) for v in (c['x'], c['y'], c['x'] + c['width'], c['y'] + c['height']))
    # Screencast frames arrive only when the page repaints: hold each until the next one's timestamp.
    stamps = [int(f.stem.split('-')[1]) for f in files]
    step = 1000 / FPS
    picks, t, j = [], stamps[0], 0
    while t <= stamps[-1] + 600:
        while j + 1 < len(stamps) and stamps[j + 1] <= t:
            j += 1
        picks.append(files[j]); t += step
    cache = {f: Image.open(f).convert('RGB').crop(box) for f in dict.fromkeys(picks)}
    light = {f: float(np.asarray(im.resize((64, 64))).mean()) for f, im in cache.items()}
    # Skip the frames before the page has painted: they read far darker than the page itself.
    target = 0.85 * float(np.median([light[f] for f in picks]))
    start = next(i for i, f in enumerate(picks) if light[f] >= target)
    frames = [cache[f] for f in picks[start:]]
    frames += [frames[-1]] * round(1.5 * FPS)  # rest on the last frame before the loop restarts
    out = OUT / f'{name}.gif'
    w = width
    while True:
        encode(frames, w, out)
        if out.stat().st_size <= LIMIT or w < 480:
            break
        w = int(w * 0.85)
    print(f'{name}: {w}px wide, {len(frames)} frames at {FPS} fps, trimmed {start}, {out.stat().st_size // 1024} KB')
