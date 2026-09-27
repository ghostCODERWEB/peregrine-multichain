"""Original score and sound design for the film (see ../08-music-and-sound.md).

Everything is synthesised here with numpy: no samples, no third-party audio.
Writes audio/music.wav (music only), audio/sfx.wav (effects only) and
audio/mix.wav (the final stereo mix, 48 kHz, 24-bit), 60.0 s.

Cue times for effects come from cues.json (written by render.py from the
shot list) when present, else from the defaults below.
"""
import json, pathlib, wave
import numpy as np

SR = 48_000
DUR = 60.0
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
N = int(SR * DUR)
ROOT = pathlib.Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)

def t_of(n):
    return np.arange(n) / SR

def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

def env_adsr(n, a, d, s, r, sustain_level):
    e = np.ones(n) * sustain_level
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n); e[:A] = np.linspace(0, 1, A, endpoint=False)
    D = min(D, max(0, n - A)); e[A:A + D] = np.linspace(1, sustain_level, D, endpoint=False)
    if R and R < n: e[-R:] *= np.linspace(1, 0, R)
    return e

def onepole_lp(x, cutoff):
    """One-pole low-pass; cutoff may be an array (Hz)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y

def lp_fast(x, cutoff):
    """Static one-pole low-pass via scipy-free recursion in blocks (vectorised with lfilter-like trick)."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    # y[n] = (1-a) x[n] + a y[n-1]: solve with cumulative trick in chunks for speed
    y = np.empty_like(x); acc = 0.0
    step = 4096
    powers = a ** np.arange(1, step + 1)
    for s in range(0, len(x), step):
        seg = x[s:s + step] * (1 - a)
        k = len(seg)
        # convolution with a^m truncated to chunk, plus carry
        conv = np.convolve(seg, a ** np.arange(k))[:k]
        y[s:s + k] = conv + acc * powers[:k]
        acc = y[s + k - 1]
    return y

def hp_fast(x, cutoff):
    return x - lp_fast(x, cutoff)

def place(buf, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(sig))
    l = np.cos((pan + 1) * np.pi / 4) * gain
    r = np.sin((pan + 1) * np.pi / 4) * gain
    buf[i:j, 0] += sig[:j - i] * l
    buf[i:j, 1] += sig[:j - i] * r

# ---------------------------------------------------------------- arrangement
CHORDS = [  # one per bar: A minor 9, F major 7, C, G add6 (midi)
    [57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 60, 64, 67], [55, 59, 62, 64, 67],
]
CLIMAX_CHORDS = [[48, 55, 60, 64, 71], [53, 57, 60, 64, 69], [57, 60, 64, 67, 71], [55, 59, 62, 67, 74]]

def chord_at(bar, climax=False):
    c = (CLIMAX_CHORDS if climax else CHORDS)[bar % 4]
    return c

def section(t):
    if t < 2: return 'intro'
    if t < 10: return 'grooveA'
    if t < 24: return 'build'
    if t < 28: return 'breakdown'
    if t < 42: return 'grooveB'
    if t < 50: return 'mobile'
    if t < 58.5: return 'climax'
    return 'end'

music = np.zeros((N, 2))

# Pad: detuned saw-ish (additive) chords, slow attack, filtered brighter over time.
bars = int(np.ceil(DUR / BAR))
for b in range(bars):
    t0 = b * BAR
    if t0 >= 58.5: break
    climax = t0 >= 50
    n = int(SR * (BAR + 0.6))
    tt = t_of(n)
    sig = np.zeros(n)
    for m in chord_at(b, climax):
        f = note(m)
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            for h in range(1, 7):
                sig += np.sin(2 * np.pi * ff * h * tt + rng.uniform(0, 6.28)) / (h ** 1.35)
    sig /= 30
    level = {'intro': 0.9, 'grooveA': 0.55, 'build': 0.5, 'breakdown': 0.85, 'grooveB': 0.5, 'mobile': 0.45, 'climax': 0.55}[section(t0)]
    e = env_adsr(n, 0.9 if b == 0 else 0.25, 0.3, 0.85, 0.6, 1)
    cutoff = 900 + 2600 * min(1, t0 / 56)
    sig = lp_fast(sig * e, cutoff)
    place(music, sig, t0, level * 0.55, pan=-0.15)
    place(music, np.roll(sig, 480), t0, level * 0.55, pan=0.15)

# Sub bass: root of each chord on beats 1 and 3 with a short glide feel.
for b in range(bars):
    t0 = b * BAR
    if t0 < 2 or t0 >= 58.5: continue
    if 24 <= t0 < 28: continue
    root = chord_at(b, t0 >= 50)[0] - 12
    for beat in (0, 1.5, 2, 3.5):
        at = t0 + beat * BEAT
        n = int(SR * BEAT * (0.9 if beat in (0, 2) else 0.45))
        tt = t_of(n)
        f = note(root)
        sig = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt)
        sig *= env_adsr(n, 0.006, 0.08, 0.7, 0.05, 0.7)
        place(music, sig, at, 0.42 if beat in (0, 2) else 0.26)

# Drums.
def kick():
    n = int(SR * 0.32); tt = t_of(n)
    f = 45 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 9) + 0.25 * np.exp(-tt * 300) * rng.standard_normal(n) * 0.3

def hat(open_=False):
    n = int(SR * (0.16 if open_ else 0.045)); tt = t_of(n)
    return hp_fast(rng.standard_normal(n), 7000) * np.exp(-tt * (18 if open_ else 70))

def clap():
    n = int(SR * 0.18); tt = t_of(n)
    x = hp_fast(rng.standard_normal(n), 1200) * np.exp(-tt * 22)
    for d in (0.01, 0.02):
        k = int(d * SR); x[k:] += x[:-k] * 0.5
    return x * 0.6

K, H, HO, C = kick(), hat(), hat(True), clap()
t = 2.0
while t < 58.5:
    s = section(t)
    if s != 'breakdown':
        beat_i = int(round((t - 2.0) / BEAT))
        place(music, K, t, 0.62 if s in ('grooveA', 'build') else 0.7)
        if s in ('build', 'grooveB', 'mobile', 'climax') or t >= 6:
            place(music, H, t + BEAT / 2, 0.16, pan=0.25)
        if s in ('grooveB', 'mobile', 'climax') and beat_i % 2 == 1:
            place(music, C, t, 0.28, pan=-0.1)
        if s in ('mobile', 'climax'):
            place(music, H, t + BEAT / 4, 0.08, pan=-0.3); place(music, H, t + 3 * BEAT / 4, 0.08, pan=0.3)
        if s == 'climax' and beat_i % 4 == 3:
            place(music, HO, t + BEAT / 2, 0.1)
    t += BEAT

# Plucked arpeggio (16ths) from 12.5 s; an octave up for the phone section.
def pluck(f, dur=0.22):
    n = int(SR * dur); tt = t_of(n)
    x = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 2 * f * tt) + 0.15 * np.sin(2 * np.pi * 3 * f * tt))
    return x * np.exp(-tt * 16)

step = BEAT / 4
t = 12.5
i = 0
while t < 58.5:
    b = int(t // BAR)
    c = chord_at(b, t >= 50)
    pattern = [c[1], c[2], c[3], c[4], c[3], c[2], c[4], c[2]]
    m = pattern[i % len(pattern)] + (12 if t >= 42 else 0)
    vel = 0.12 + 0.05 * (i % 4 == 0)
    if 24 <= t < 28: vel *= 1.2
    place(music, pluck(note(m)), t, vel, pan=0.35 * np.sin(i * 0.7))
    t += step; i += 1

# Riser 56.5 -> 58.5 and the final resolve.
n = int(SR * 2.0); tt = t_of(n)
riser = rng.standard_normal(n)
riser = hp_fast(riser, 2000) * (tt / 2.0) ** 2.2 * 0.5
place(music, riser, 56.5, 0.35)

end_chord = [48, 55, 60, 64, 67, 72]
n = int(SR * 1.6); tt = t_of(n)
sig = np.zeros(n)
for m in end_chord:
    f = note(m)
    for h in (1, 2, 3):
        sig += np.sin(2 * np.pi * f * h * tt) / (h * 2)
sig *= np.exp(-tt * 1.6) * np.minimum(1, tt / 0.02)
place(music, sig / 6, 58.5, 0.9)

# Master fade-in / fade-out of the music bed.
fade = np.ones(N)
fi = int(0.05 * SR); fade[:fi] = np.linspace(0, 1, fi)
fo = int(0.35 * SR); fade[-fo:] = np.linspace(1, 0, fo)
music *= fade[:, None]

# ---------------------------------------------------------------- sound design
sfx = np.zeros((N, 2))

def s_tick():
    n = int(SR * 0.012); tt = t_of(n)
    return np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 600)

def s_click():
    n = int(SR * 0.06); tt = t_of(n)
    return (np.sin(2 * np.pi * 180 * tt) * np.exp(-tt * 60) + 0.4 * hp_fast(rng.standard_normal(n), 3000) * np.exp(-tt * 300))

def s_whoosh(d=0.4):
    n = int(SR * d); tt = t_of(n)
    x = rng.standard_normal(n)
    sweep = 400 + 5000 * (tt / d)
    x = lp_fast(x, 3500) - lp_fast(x, 300)
    return x * np.sin(np.pi * tt / d) ** 2 * 0.8

def s_glass():
    n = int(SR * 0.16); tt = t_of(n)
    x = np.sin(2 * np.pi * 3520 * tt) + 0.6 * np.sin(2 * np.pi * 5280 * tt)
    return x * np.exp(-tt * 30) * 0.5

def s_chime():
    n = int(SR * 0.7); tt = t_of(n)
    a = np.sin(2 * np.pi * note(76) * tt) * np.exp(-tt * 5)
    b = np.zeros(n); k = int(0.09 * SR)
    b[k:] = np.sin(2 * np.pi * note(83) * tt[:-k]) * np.exp(-tt[:-k] * 4)
    return (a + b) * np.minimum(1, tt / 0.01) * 0.5

def s_hit():
    n = int(SR * 0.5); tt = t_of(n)
    f = 40 + 60 * np.exp(-tt * 12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6)

def s_type():
    n = int(SR * 0.02); tt = t_of(n)
    return hp_fast(rng.standard_normal(n), 4000) * np.exp(-tt * 400) * 0.5

cues_file = ROOT / 'audio' / 'cues.json'
cues = json.loads(cues_file.read_text()) if cues_file.exists() else {}
defaults = {
    'glass': [0.2], 'whoosh': [1.4, 12.35, 41.7], 'tick': [6.5, 10.0, 19.5, 31.5, 34.0, 36.0, 38.0, 40.0, 50.0, 54.0],
    'click': [], 'chime': [23.2], 'hit': [20.0], 'type': [], 'phone_glass': [], 'bell': [58.55],
}
for k, v in defaults.items(): cues.setdefault(k, v)

for at in cues['tick']: place(sfx, s_tick(), at, 0.35)
for at in cues['whoosh']: place(sfx, s_whoosh(), at, 0.5)
for at in cues['glass'] + cues['phone_glass']: place(sfx, s_glass(), at, 0.35, pan=0.1)
for at in cues['click']: place(sfx, s_click(), at, 0.45)
for at in cues['chime']: place(sfx, s_chime(), at, 0.45)
for at in cues['hit']: place(sfx, s_hit(), at, 0.55)
for at in cues['type']: place(sfx, s_type(), at, 0.25, pan=rng.uniform(-0.2, 0.2))
for at in cues['bell']: place(sfx, s_chime() * 0.6, at, 0.5)

# ---------------------------------------------------------------- mix
def norm_peak(x, peak_db):
    p = np.max(np.abs(x)) or 1
    return x / p * 10 ** (peak_db / 20)

music = norm_peak(music, -3.0)
sfx = norm_peak(sfx, -9.0) if np.max(np.abs(sfx)) else sfx
mix = music * 0.9 + sfx * 0.55
# Soft limiter to -1 dBTP.
ceiling = 10 ** (-1 / 20)
mix = np.tanh(mix / ceiling * 1.1) * ceiling / np.tanh(1.1)

def write(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x * (2 ** 23 - 1)).astype('<i4')
    raw = np.zeros((len(pcm), 2, 3), dtype=np.uint8)
    b = pcm.view(np.uint8).reshape(len(pcm), 2, 4)
    raw[:, :, :] = b[:, :, :3]
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(raw.tobytes())

(ROOT / 'audio').mkdir(exist_ok=True)
write(ROOT / 'audio' / 'music.wav', music)
write(ROOT / 'audio' / 'sfx.wav', sfx)
write(ROOT / 'audio' / 'mix.wav', mix)
print('peak dBFS', round(20 * np.log10(np.max(np.abs(mix))), 2), 'rms dBFS', round(20 * np.log10(np.sqrt(np.mean(mix ** 2))), 2))
