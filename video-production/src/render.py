"""Edits the film from the captures (see ../05-shot-list.md and ../07-editing-plan.md).

Frames are composed per output frame at 1920x1080, 60 fps, and piped to
ffmpeg (H.264 High, CRF 14) with the score from audio/mix.wav.

  python3 video-production/src/render.py            # full render
  python3 video-production/src/render.py --preview  # 960x540, 30 fps, fast

Each shot names a capture take, an in-point inside it (seconds from the
take's first frame), a camera (zoom and focus point, start to end) and an
optional caption. Captured frames are placed on their real timestamps and
held until the next repaint, so UI motion keeps its real timing.
"""
import bisect, json, math, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import imageio_ffmpeg

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = ROOT.parent
CAP = ROOT / 'captures'
PREVIEW = '--preview' in sys.argv
W, H = (960, 540) if PREVIEW else (1920, 1080)
FPS = 30 if PREVIEW else 60
DUR = 60.0
S = W / 1920  # layout scale

# ------------------------------------------------------------------ assets
FONT_DIRS = [REPO / 'node_modules', pathlib.Path('/usr/share/fonts')]
def find_font(names):
    for d in FONT_DIRS:
        for n in names:
            hits = list(d.rglob(n)) if d.exists() else []
            if hits: return str(hits[0])
    return None
# Manrope, the app's own UI face (instanced from the build's variable font into assets/fonts).
FONTS = ROOT / 'assets' / 'fonts'
FONT_SEMI = str(FONTS / 'Manrope-SemiBold.ttf')
FONT_REG = str(FONTS / 'Manrope-Regular.ttf')
FONT_BOLD = str(FONTS / 'Manrope-ExtraBold.ttf')
def font(path, size):
    return ImageFont.truetype(path, max(8, int(size * S))) if path else ImageFont.load_default()

MARK = Image.open(REPO / 'public/brand/peregrine-256.png').convert('RGBA')
NANSEN_LOGO = ROOT / 'assets' / 'nansen-logo.png'

# ------------------------------------------------------------------ takes
class Take:
    def __init__(self, name):
        files = sorted((CAP / name).glob('*.jpg'))
        if not files: raise SystemExit(f'missing capture: {name}')
        self.files = files
        self.ts = [int(f.stem.split('-')[1]) / 1000 for f in files]
        self.t0 = self.ts[0]
        self.cache = {}
        self.len = self.ts[-1] - self.t0

    def at(self, t):
        """Frame showing at t seconds after the take started."""
        i = max(0, bisect.bisect_right(self.ts, self.t0 + t) - 1)
        if i not in self.cache:
            if len(self.cache) > 40: self.cache.clear()
            self.cache[i] = Image.open(self.files[i]).convert('RGB')
        return self.cache[i]

TAKES = {}
def take(name):
    if name not in TAKES: TAKES[name] = Take(name)
    return TAKES[name]

# ------------------------------------------------------------------ easing and camera
def ease(x):
    x = min(1, max(0, x))
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2

def lerp(a, b, x):
    return a + (b - a) * x

def camera(img, zoom, fx, fy, out=(W, H)):
    """Crop a zoomed window centred near (fx, fy) (fractions), clamped inside the image."""
    iw, ih = img.size
    cw, ch = iw / zoom, ih / zoom
    cx = min(max(fx * iw, cw / 2), iw - cw / 2)
    cy = min(max(fy * ih, ch / 2), ih - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return img.resize(out, Image.LANCZOS if zoom > 1.02 else Image.BILINEAR, box=box)

# ------------------------------------------------------------------ shots (from 05-shot-list.md)
# (start, end, take, in_point, cam_start(zoom,fx,fy), cam_end, caption, kind)
SHOTS = [
    (1.5, 6.5, 'overview', 1.8, (1.00, .5, .5), (1.10, .62, .42), 'Where money is moving', 'desk'),
    (6.5, 10.0, 'alpha', 0.2, (1.08, .6, .55), (1.08, .42, .55), '150 tokens, by flow', 'desk'),
    (10.0, 12.5, 'flows', 0.2, (1.05, .45, .6), (1.15, .6, .6), None, 'desk'),
    (12.5, 19.5, 'token', [(0, 1.4), (2.4, 3.8), (3.9, 5.3), (5.2, 7.6), (6.2, 9.4), (7.0, 10.4)], (1.25, .83, .32), (1.05, .45, .45), 'Is it safe?', 'token'),
    (19.5, 22.5, 'rug', 0.95, (1.00, .45, .35), (1.15, .38, .28), None, 'desk'),
    (22.5, 31.5, 'analyze', [(0, 0.1), (2.2, 2.3), (3.6, 4.8), (4.6, 6.2), (5.3, 7.5), (6.1, 8.5), (9.0, 12.8)], (1.00, .5, .5), (1.28, .86, .5), 'Ask about anything on screen', 'analyze'),
    (31.5, 34.0, 'wallet', 2.4, (1.05, .35, .3), (1.18, .3, .28), 'Is this wallet any good?', 'desk'),
    (34.0, 36.0, 'checker', 0.2, (1.05, .5, .45), (1.1, .5, .52), '25 networks', 'desk'),
    (36.0, 38.0, 'market-predict', 0.3, (1.02, .5, .45), (1.1, .55, .45), 'Predictions', 'desk'),
    (38.0, 40.0, 'market-perps', 0.3, (1.02, .5, .45), (1.1, .55, .45), 'Perps', 'desk'),
    (40.0, 42.0, 'market-sectors', 0.3, (1.02, .5, .45), (1.1, .55, .45), 'Sectors', 'handoff'),
    (42.0, 50.0, 'phone', 0.3, None, None, None, 'phone'),
    (50.0, 54.0, 'proof', 0.5, (1.22, .28, .22), (1.08, .45, .45), 'Every number is Nansen data', 'desk'),
    (54.0, 58.5, 'overview-2', 3.0, (1.10, .62, .45), (1.35, .6, .42), None, 'climax'),
]
PHONE_CAPTIONS = [(42.5, 45.5, 'Liquid Glass'), (45.9, 49.6, 'Genie Ask')]

# Token shot: rings first, then reframe to the chart at 15.5 s (a 0.6 s move).
def token_cam(t):
    if t < 14.9: return lerp(1.25, 1.2, ease((t - 12.5) / 2.4)), .83, .33
    x = ease((t - 14.9) / 0.8)
    return lerp(1.2, 1.06, x), lerp(.83, .40, x), lerp(.33, .47, x)

# Analyze shot: wide while the question forms, then push to the panel for the answer.
def analyze_cam(t):
    if t < 28.4: return lerp(1.0, 1.04, ease((t - 22.5) / 5.9)), .6, .5
    x = ease((t - 28.4) / 0.9)
    return lerp(1.04, 1.32, x), lerp(.6, .88, x), .5

def take_time(inp, lt):
    """Shot-local time -> take time: a constant in-point, or piecewise-linear keyframes [(shot_t, take_t), ...]."""
    if not isinstance(inp, list): return inp + lt
    for (a0, b0), (a1, b1) in zip(inp, inp[1:]):
        if lt <= a1: return b0 + (b1 - b0) * (lt - a0) / (a1 - a0)
    a0, b0 = inp[-1]
    return b0 + (lt - a0)

# ------------------------------------------------------------------ compositing helpers
def caption(frame, text, t_in, t_out, t):
    if not text or t < t_in or t > t_out: return frame
    a = min(1, (t - t_in) / 0.3, (t_out - t) / 0.25)
    rise = (1 - ease(min(1, (t - t_in) / 0.3))) * 12 * S
    f = font(FONT_SEMI, 44)
    layer = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = int(96 * S), int(H - 96 * S - 44 * S + rise)
    # soft dark underlay for readability
    bb = d.textbbox((x, y), text, font=f)
    pad = int(26 * S)
    under = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    ImageDraw.Draw(under).rounded_rectangle((bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad), radius=int(22 * S), fill=(4, 8, 7, int(150 * a)))
    under = under.filter(ImageFilter.GaussianBlur(10 * S))
    d.text((x, y), text, font=f, fill=(255, 255, 255, int(235 * a)))
    base = frame.convert('RGBA')
    base.alpha_composite(under); base.alpha_composite(layer)
    return base.convert('RGB')

def fade(frame, amount):
    if amount <= 0: return frame
    return Image.blend(frame, Image.new('RGB', frame.size, (0, 0, 0)), min(1, amount))

def whip(frame, strength):
    if strength <= 0: return frame
    k = int(60 * S * strength)
    arr = np.asarray(frame).astype(np.float32)
    acc = np.zeros_like(arr)
    for i in range(-k, k + 1, max(1, k // 6)):
        acc += np.roll(arr, i, axis=1)
    acc /= len(range(-k, k + 1, max(1, k // 6)))
    return Image.fromarray(acc.clip(0, 255).astype(np.uint8))

STAGE = None
def stage():
    global STAGE
    if STAGE is None:
        y, x = np.mgrid[0:H, 0:W]
        r = np.sqrt(((x - W / 2) / (W * 0.55)) ** 2 + ((y - H * 0.55) / (H * 0.7)) ** 2)
        glow = np.clip(1 - r, 0, 1) ** 2
        base = np.zeros((H, W, 3), np.float32) + np.array([5, 8, 7], np.float32)
        base += glow[..., None] * np.array([10, 42, 32], np.float32)
        STAGE = Image.fromarray(base.clip(0, 255).astype(np.uint8))
    return STAGE

PHONE_H = int(990 * S)
def phone_frame(screen, scale=1.0, dy=0):
    """Phone screen with bezel and shadow, centred on the stage."""
    ph = int(PHONE_H * scale)
    pw = int(ph * screen.size[0] / screen.size[1])
    scr = screen.resize((pw, ph), Image.LANCZOS)
    bez = int(12 * S * scale); rad = int(56 * S * scale)
    body = Image.new('RGBA', (pw + 2 * bez, ph + 2 * bez), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, body.size[0] - 1, body.size[1] - 1), radius=rad + bez, fill=(18, 22, 21, 255), outline=(60, 70, 66, 255), width=max(1, int(2 * S)))
    mask = Image.new('L', (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=rad, fill=255)
    body.paste(scr, (bez, bez), mask)
    out = stage().copy().convert('RGBA')
    shadow = Image.new('RGBA', out.size, (0, 0, 0, 0))
    x = (W - body.size[0]) // 2; y = (H - body.size[1]) // 2 + int(dy)
    ImageDraw.Draw(shadow).rounded_rectangle((x + 10, y + 30, x + body.size[0] - 10, y + body.size[1] + 20), radius=rad, fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30 * S))
    out.alpha_composite(shadow)
    out.alpha_composite(body, (x, y))
    return out.convert('RGB')

def logo_card(t):
    """0-1.5 s: the Peregrine mark resolves out of black."""
    img = Image.new('RGB', (W, H), (0, 0, 0))
    x = ease(min(1, t / 0.9))
    size = int(lerp(200, 220, x) * S)
    mark = MARK.resize((size, size), Image.LANCZOS)
    a = min(1, t / 0.6) * (1 - max(0, (t - 1.25) / 0.25))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gr = int(lerp(60, 180, x) * S)
    ImageDraw.Draw(glow).ellipse((W / 2 - gr, H / 2 - gr, W / 2 + gr, H / 2 + gr), fill=(31, 224, 163, int(70 * a)))
    glow = glow.filter(ImageFilter.GaussianBlur(60 * S))
    base = img.convert('RGBA'); base.alpha_composite(glow)
    m = mark.copy(); m.putalpha(Image.eval(mark.getchannel('A'), lambda v: int(v * a)))
    base.alpha_composite(m, ((W - size) // 2, (H - size) // 2))
    return base.convert('RGB')

def end_card(t):
    """58.5-60 s: Nansen, Powered by Nansen."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    a = min(1, (t - 58.5) / 0.35)
    if NANSEN_LOGO.exists():
        lg = Image.open(NANSEN_LOGO).convert('RGBA')
        lh = int(120 * S); lw = int(lg.size[0] * lh / lg.size[1])
        lg = lg.resize((lw, lh), Image.LANCZOS)
        lg.putalpha(Image.eval(lg.getchannel('A'), lambda v: int(v * a)))
        img.alpha_composite(lg, ((W - lw) // 2, int(H / 2 - lh + 10 * S)))
    else:
        f = font(FONT_BOLD, 118)
        d = ImageDraw.Draw(img)
        word = 'Nansen'
        bb = d.textbbox((0, 0), word, font=f)
        d.text(((W - (bb[2] - bb[0])) / 2, H / 2 - (bb[3] - bb[1]) - 18 * S), word, font=f, fill=(255, 255, 255, int(255 * a)))
    f2 = font(FONT_REG, 32)
    d = ImageDraw.Draw(img)
    sub = 'Powered by Nansen'
    bb = d.textbbox((0, 0), sub, font=f2)
    d.text(((W - (bb[2] - bb[0])) / 2, H / 2 + 34 * S), sub, font=f2, fill=(31, 224, 163, int(215 * a)))
    return img.convert('RGB')

# ------------------------------------------------------------------ frame
def frame_at(t):
    if t < 1.5: return logo_card(t)
    if t >= 58.5: return end_card(t)
    for (a, b, name, inp, c0, c1, cap, kind) in SHOTS:
        if a <= t < b: break
    lt = t - a
    if kind == 'phone':
        tk = take(name)
        screen = tk.at(take_time(inp, lt))
        intro = ease(min(1, lt / 0.55))
        img = phone_frame(screen, lerp(0.9, 1.0, intro), lerp(24 * S, 0, intro))
        for (ca, cb, ctext) in PHONE_CAPTIONS: img = caption(img, ctext, ca, cb, t)
        return img
    tk = take(name)
    src = tk.at(take_time(inp, lt))
    if kind == 'token': z, fx, fy = token_cam(t)
    elif kind == 'analyze': z, fx, fy = analyze_cam(t)
    else:
        x = ease(lt / (b - a))
        z, fx, fy = lerp(c0[0], c1[0], x), lerp(c0[1], c1[1], x), lerp(c0[2], c1[2], x)
    img = camera(src, z, fx, fy)
    # transitions
    if a == 1.5: img = fade(img, 1 - min(1, lt / 0.4))
    if name == 'flows' and b - t < 0.2: img = whip(img, 1 - (b - t) / 0.2)
    if name == 'token' and lt < 0.2: img = whip(img, 1 - lt / 0.2)
    if kind == 'handoff' and b - t < 0.5:
        x = ease(1 - (b - t) / 0.5)
        small = img.resize((int(W * lerp(1, 0.62, x)), int(H * lerp(1, 0.62, x))), Image.BILINEAR)
        small = fade(small, 0.6 * x)
        base = stage().copy()
        base.paste(small, ((W - small.size[0]) // 2, (H - small.size[1]) // 2))
        img = base
    if kind == 'climax' and b - t < 0.4: img = fade(img, 1 - (b - t) / 0.4)
    if cap: img = caption(img, cap, a + 0.35, min(b - 0.2, a + 3.2), t)
    return img

# ------------------------------------------------------------------ cues for the score (real click times)
def write_cues():
    cues = {'click': [], 'type': [], 'phone_glass': []}
    # Token shot: clicks happen at fixed offsets in the capture script (see capture.ts): estimate from frames is overkill;
    # use the measured times recorded by capture.ts when present.
    meta = CAP / 'events.json'
    if meta.exists():
        ev = json.loads(meta.read_text())
        for (a, b, name, inp, *_rest) in SHOTS:
            if not (CAP / name).exists(): continue
            t0 = take(name).t0
            for e in ev.get(name, []):
                tt = e['abs'] - t0
                if isinstance(inp, list):
                    lt = None
                    for (a0, b0), (a1, b1) in zip(inp, inp[1:]):
                        if b0 <= tt <= b1: lt = a0 + (a1 - a0) * (tt - b0) / (b1 - b0); break
                    if lt is None: continue
                else: lt = tt - inp
                t = a + lt
                if e['kind'] == 'type':
                    typed = cues.setdefault('_n', 0); cues['_n'] = typed + 1
                    if typed % 3: continue
                if a <= t < b:
                    cues.setdefault(e['kind'], []).append(round(t, 3))
    cues.pop('_n', None)
    (ROOT / 'audio').mkdir(exist_ok=True)
    (ROOT / 'audio' / 'cues.json').write_text(json.dumps(cues))
    return cues

def main():
    if '--cues' in sys.argv:
        print(write_cues()); return
    out = ROOT / 'output' / ('preview.mp4' if PREVIEW else 'project-showcase-final.mp4')
    out.parent.mkdir(exist_ok=True)
    audio = ROOT / 'audio' / 'mix.wav'
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', str(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast' if PREVIEW else 'slow',
           '-crf', '22' if PREVIEW else '14', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
           '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', f'{DUR:.3f}', '-movflags', '+faststart', str(out)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for i in range(total):
        img = frame_at(i / FPS)
        if img.size != (W, H): img = img.resize((W, H))
        p.stdin.write(img.tobytes())
        if i % (FPS * 5) == 0: print(f'{i / FPS:5.1f}s', flush=True)
    p.stdin.close(); p.wait()
    print('wrote', out)

if __name__ == '__main__':
    main()
