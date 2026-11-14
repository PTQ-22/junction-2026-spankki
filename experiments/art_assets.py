"""Generate Taimi garden assets in style A (gouache) with Gemini image models.

uv run --env-file .env --with pillow python experiments/art_assets.py [names...] [--force]

- Backgrounds are produced by EDITING the approved style reference so the composition stays identical.
- Sprites are painted on flat magenta with the style reference attached, then chroma-keyed to RGBA.
- Existing outputs are skipped unless --force (each call costs money).
Raw images -> prototype/art/raw/, final PNGs -> app/assets/garden/.
"""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "prototype" / "art" / "style-A-gouache.png"
RAW = ROOT / "prototype" / "art" / "raw"
OUT = ROOT / "app" / "assets" / "garden"
BG_MODEL = os.environ.get("ART_BG_MODEL", "gemini-3-pro-image")
SPRITE_MODEL = os.environ.get("ART_SPRITE_MODEL", "gemini-3.1-flash-image")

STYLE = (
    "Match the reference image's style exactly: hand-painted gouache storybook illustration, matte, soft visible brush "
    "texture, muted Nordic palette (sage green, birch white, lake blue, warm wood), gentle light from the upper left, "
    "calm and grown-up. "
)
SPRITE = (
    "Paint ONE isolated object, centered, fully visible with generous margin, on a perfectly flat pure magenta "
    "background (#FF00FF) that fills the whole image. No ground, no grass, no cast shadow, no other objects, "
    "no text, no frame. The object itself must not contain any magenta or pink-purple tones. "
)

# --- backgrounds: edits of the reference --------------------------------------------------------------------------
BG_BASE = (
    "Edit this image. Keep the camera, composition, sky, spruce trees, lake, wooden fence, the LEFT birch tree and the "
    "grass exactly as they are. Remove completely and paint over with matching grass/fence: the five small flowers "
    "along the fence, the sprout and its soil mound in the centre, the pond on the lower left, the wooden sign on the "
    "fence, and the birch tree on the RIGHT side. The result is an empty garden ready for objects to be placed on it."
)
BACKGROUNDS = {
    "bg-sun": (REF, BG_BASE),
    "bg-cloud": ("bg-sun", "Edit this image. Keep everything identical but make it a soft overcast day: grey-blue "
                 "cloudy sky, no sun, slightly cooler and flatter light. Do not add or move any objects."),
    "bg-storm": ("bg-sun", "Edit this image. Keep everything identical but make it a stormy late evening: dark "
                 "slate-blue sky with heavy clouds, dim cool light, wet dark grass. No rain streaks, no lightning, "
                 "do not add or move any objects."),
}

# --- sprites --------------------------------------------------------------------------------------------------------
FLOWERS = {
    "restaurants": "a coral-red tulip",
    "entertainment": "a sunflower-like daisy with golden petals and a brown centre",
    "lifestyle": "a lilac bellflower with several small purple bells",
    "travel": "a blue cornflower",
    "taxi": "a cluster of small yellow buttercups",
}
FLOWER_STATE = {
    "blooming": "healthy and in full bloom, standing upright, fresh green leaves, vivid but still muted colours",
    "ok": "healthy, flowers just opening, upright, modest size",
    "wilting": "wilting: stem bent over, head drooping, a few petals curled and faded, leaves slightly yellowed - "
               "gentle, not dead",
}
SPRITES: dict[str, str] = {}
for key, desc in FLOWERS.items():
    for st, sdesc in FLOWER_STATE.items():
        SPRITES[f"flower-{key}-{st}"] = f"A single small garden plant: {desc}, {sdesc}. Tall narrow composition, stem base at the bottom centre."
SPRITES["flower-dormant"] = "A tiny green seedling with two small curled leaves just emerging, very small, stem base at the bottom centre."
TAIMI = {
    1: "a seed just cracking open with a tiny pale green shoot",
    2: "a young sprout with two fresh leaves on a slender stem",
    3: "a small sapling with a thin trunk and a few leafy branches",
    4: "a young tree with a slender tapering trunk and a soft rounded leafy crown",
}
for n, desc in TAIMI.items():
    SPRITES[f"taimi-{n}"] = (
        f"The garden's mascot plant: {desc}, growing from a small neat mound of dark soil. No face, no eyes. "
        "Soil mound at the bottom centre."
    )
SPRITES.update({
    "pond-full": "A small round garden pond seen from a slightly elevated front view, mossy stone rim, full of calm blue water with a soft highlight. Wide oval shape.",
    "pond-half": "The same small round garden pond with mossy stone rim, water only half full, visible damp inner bank. Wide oval shape.",
    "pond-empty": "The same small round garden pond with mossy stone rim, completely dry, cracked earth inside. Wide oval shape.",
    "birch-grown": "A young birch tree with white bark and black marks and a light green airy crown. Tall narrow composition, trunk base at the bottom centre.",
    "birch-sapling": "A very small birch sapling, thin white stem with a few light green leaves, held by a small wooden stake. Trunk base at the bottom centre.",
    "sign": "A small blank weathered wooden sign board on a short post, plain wood with no writing at all, front view.",
    "coin": "A single small golden coin seen slightly from the side, soft painted highlight, no symbols.",
})


def _image_part(img: Path | bytes) -> types.Part:
    data = img.read_bytes() if isinstance(img, Path) else img
    return types.Part.from_bytes(data=data, mime_type="image/png")


def _generate(client: genai.Client, model: str, parts: list, aspect: str) -> bytes:
    resp = client.models.generate_content(
        model=model,
        contents=parts,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio=aspect)
        ),
    )
    for p in resp.candidates[0].content.parts:
        if p.inline_data:
            return p.inline_data.data
    raise RuntimeError("no image returned")


def cutout(raw: bytes) -> Image.Image:
    """Chroma-key flat magenta to alpha, with soft edges and despill, then crop to content."""
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            key = min(r, b) - g  # magenta-ness
            if key > 90:
                px[x, y] = (0, 0, 0, 0)
            elif key > 25:
                a = int(255 * (90 - key) / 65)
                m = (r + b) // 2
                px[x, y] = (min(r, g + (r - m) // 2 + 20), g, min(b, g + (b - m) // 2 + 20), a)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def main(argv: list[str]) -> None:
    force = "--force" in argv
    names = [a for a in argv if not a.startswith("--")]
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    ref = _image_part(REF)

    for name, (src, prompt) in BACKGROUNDS.items():
        if names and name not in names:
            continue
        out = OUT / f"{name}.png"
        if out.exists() and not force:
            continue
        src_path = src if isinstance(src, Path) else OUT / f"{src}.png"
        data = _generate(client, BG_MODEL, [_image_part(src_path), prompt], "9:16")
        (RAW / f"{name}.png").write_bytes(data)
        out.write_bytes(data)
        print("bg", name)

    for name, desc in SPRITES.items():
        if names and name not in names:
            continue
        out = OUT / f"{name}.png"
        if out.exists() and not force:
            continue
        aspect = "4:3" if name.startswith(("pond", "coin", "sign")) else "3:4"
        data = _generate(client, SPRITE_MODEL, [ref, STYLE + SPRITE + desc], aspect)
        (RAW / f"{name}.png").write_bytes(data)
        cutout(data).save(out)
        print("sprite", name)


if __name__ == "__main__":
    main(sys.argv[1:])
