"""Turn the frame folders from `pnpm showcase` into README GIFs.

Usage: python3 scripts/make-gifs.py   (needs Pillow)
"""
import pathlib
from PIL import Image

FRAMES = pathlib.Path('docs/screenshots/.frames')
OUT = pathlib.Path('docs/screenshots')
# name: (output width, crop box as fractions or None)
SPEC = {
    'phone-genie-ask': (320, None),
    'phone-tabs': (320, (0, 0.6, 1, 1)),
    'phone-scroll': (320, None),
    'desktop-analyze': (900, (0.4, 0, 1, 1)),
}
FPS = 25  # frames are resampled to this rate from their capture timestamps

for name, (width, crop) in SPEC.items():
    files = sorted((FRAMES / name).glob('*.jpg'))
    if not files:
        print('skip', name); continue
    # Screencast frames arrive only when the page repaints: hold each until the next one's timestamp.
    stamps = [int(f.stem.split('-')[1]) for f in files]
    step = 1000 // FPS
    picks = []
    t, j = stamps[0], 0
    while t <= stamps[-1] + 400:
        while j + 1 < len(stamps) and stamps[j + 1] <= t:
            j += 1
        picks.append(files[j]); t += step
    cache = {}
    frames = []
    for f in picks:
        if f in cache:
            frames.append(cache[f]); continue
        im = Image.open(f).convert('RGB')
        if crop:
            w, h = im.size
            im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
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
    out[0].save(OUT / f'{name}.gif', save_all=True, append_images=out[1:], duration=durs, loop=0, optimize=True)
    print(name, len(out), 'frames', (OUT / f'{name}.gif').stat().st_size // 1024, 'KB')
