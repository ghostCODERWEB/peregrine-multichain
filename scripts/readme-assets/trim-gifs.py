"""Trim the fade-in from black at the start of the GIFs recorded on 27 September 2026.

Usage: python3 scripts/readme-assets/trim-gifs.py name ...   (needs Pillow, numpy and ffmpeg, as make-gifs.py)

Those recordings open on a few near-black frames; GitHub shows the first frame while a GIF loads,
so the README looked empty. The GIF is cut at the first frame at least 95% as bright as its median
frame and re-encoded with one shared palette; timing and content are otherwise untouched.
"""
import pathlib
import subprocess
import sys

import numpy as np
from PIL import Image, ImageSequence




def ffmpeg_bin() -> str:
    import os, shutil
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    if shutil.which('ffmpeg'):
        return 'ffmpeg'
    import imageio_ffmpeg  # type: ignore
    return imageio_ffmpeg.get_ffmpeg_exe()


for name in sys.argv[1:]:
    path = pathlib.Path('docs/readme/gifs') / f'{name}.gif'
    light = [float(np.asarray(f.convert('RGB').resize((64, 64))).mean()) for f in ImageSequence.Iterator(Image.open(path))]
    target = 0.95 * float(np.median(light))
    start = next(i for i, v in enumerate(light) if v >= target)
    if start == 0:
        print(name, 'already starts on a painted frame'); continue
    tmp = path.with_suffix('.tmp.gif')
    graph = f'trim=start_frame={start},setpts=PTS-STARTPTS,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle'
    subprocess.run([ffmpeg_bin(), '-nostdin', '-loglevel', 'error', '-y', '-i', str(path), '-filter_complex', graph, '-loop', '0', str(tmp)], check=True)
    tmp.replace(path)
    print(f'{name}: trimmed {start} of {len(light)} frames, {path.stat().st_size // 1024} KB')
