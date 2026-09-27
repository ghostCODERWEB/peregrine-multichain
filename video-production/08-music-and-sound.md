# 08 · Music and sound

## Source and licence

Original music and effects synthesised in code for this film (`src/music.py`): additive and subtractive synthesis with numpy, no samples, no third-party audio. Royalty-free by construction; the repository owns it.

## Feel

Premium, modern, technological, intelligent, cinematic, fast, clean. No vocals, no corporate ukulele, no trailer braams, no big EDM drop. Think minimal electronic: warm pad, round sub bass, tight muted kick, crisp hats, a plucked arpeggio that carries the "intelligence".

## Tempo and key

120 BPM (beat 0.5 s, bar 2 s), A minor with a lift to C major at the climax. Chords: Am9 – Fmaj7 – C – G(add6), one chord per bar.

## Energy curve

| Time | Section | Content |
|---|---|---|
| 0:00–0:02 | Intro | Pad swell from silence, a single high shimmer on the logo |
| 0:02–0:10 | Groove A | Kick (four on the floor, soft), sub bass on roots, pad |
| 0:10–0:22 | Build | Hats (8ths), plucked arpeggio (16ths) enters at 0:12.5, filter slowly opens |
| 0:22–0:24 | Accent | Downbeat hit at 0:20.0 for "Rug risk: High" |
| 0:24–0:28 | Breakdown | Drums out, pad and arpeggio only, under the AI question |
| 0:28–0:42 | Groove B | Drums back as the answer streams, claps on 2 and 4 from 0:34 |
| 0:42–0:50 | Mobile | Full groove, brighter arpeggio an octave up |
| 0:50–0:58 | Climax | Everything plus a rising filter sweep and riser into 0:58.5 |
| 0:58.5–1:00 | Resolve | Drums stop; a C-major chord with a bell rings out and fades |

## Sound design (all subtle, −14 to −22 dB under music)

| Effect | Where | Character |
|---|---|---|
| Glass shimmer | Logo 0:00.2, phone tab taps | Short band-passed noise and a high sine pair, 80–150 ms |
| Tick | Most cuts | 3 ms click, very quiet |
| Whoosh | Into the overview, the whip into the token page, the desktop-to-phone handoff | Filtered noise sweep, 300–450 ms |
| Soft click | Real clicks on range and style pills | Short sine thump and noise transient |
| AI activation chime | Analyze opens (0:23.2), genie opens (~0:46.3) | Two-note rising sine, fifth apart, soft attack |
| Typing ticks | While the question is typed | Tiny randomised clicks |
| Low hit | "Rug risk: High" | Sub thump |
| Riser | 0:56.5–0:58.5 | Noise swell with rising filter |
| Bell | End card | Sine partials with long decay |

## Mix

Music peaks around −14 LUFS short-term, overall integrated ≈ −16 LUFS; effects never louder than the kick; a gentle limiter at −1 dBTP. Stereo: pad and arpeggio slightly wide, bass and kick centred.
