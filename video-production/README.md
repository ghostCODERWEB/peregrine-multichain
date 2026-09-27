# Peregrine showcase film

A 60-second product film of the real application: recorded from the running app, edited in code, scored with original synthesised music.

**Output:** `output/project-showcase-final.mp4` (1920 × 1080, 60 fps, H.264 High, AAC 320 kbps stereo, 60.0 s).

## Source of truth

The strategy files decide every production choice, in order:

1. `01-product-analysis.md`: what the product is and what is strongest, from using it
2. `02-presentation-strategy.md`: how to present it
3. `03-feature-priority.md`: hero, supporting, glimpse, do-not-show
4. `04-video-story.md`: the narrative
5. `05-shot-list.md`: the 60-second timeline
6. `06-capture-plan.md`: how each take is recorded
7. `07-editing-plan.md`: the editing language
8. `08-music-and-sound.md`: score and sound design
9. `09-production-checklist.md`: final QA

## Rebuild

```bash
# 1. The app in demo mode (recorded Nansen data), production build
NEXT_DIST_DIR=.next-film pnpm next build
DEMO_MODE=1 NANSEN_API_KEY= TIDE_DB_PATH=/tmp/film.db NEXT_DIST_DIR=.next-film pnpm next start -p 3500

# 2. Record every take (Chrome screencast; add LIVE_URL=<instance with a key> to record the AI answers live)
BASE=http://localhost:3500 npx tsx video-production/src/capture.ts

# 3. Fonts: Manrope instanced from the build (assets/fonts is committed)
# 4. Score, then the edit (needs: pip install numpy pillow imageio-ffmpeg)
python3 video-production/src/render.py --cues
python3 video-production/src/music.py
python3 video-production/src/render.py            # or --preview for a fast 540p draft
```

Put Nansen's official logo at `assets/nansen-logo.png` to use it on the end card instead of the wordmark.

## Honesty note

Every frame is the real application on recorded Nansen data, except the text of the two AI answers: the capture sandbox has no Nansen key and cannot reach the live site, so those answers are replayed through the real panel and use only figures shown on the same screen. Recapture with `LIVE_URL` to record the agent itself.
