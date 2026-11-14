"""Generate style-direction reference scenes for the Taimi garden (Gemini image).

uv run --env-file .env python experiments/art_styles.py  -> prototype/art/style-*.png
"""

import os
import sys
from pathlib import Path

from google import genai
from google.genai import types

OUT = Path(__file__).resolve().parent.parent / "prototype" / "art"
MODEL = os.environ.get("ART_MODEL", "gemini-3-pro-image")

SCENE = (
    "Portrait mobile app background, 9:16. A calm Finnish garden scene seen from a slightly elevated front view. "
    "Top 35%: soft open sky, plenty of empty space for UI text. Behind: a row of spruce trees and a glimpse of a lake. "
    "Middle: a low wooden rail fence running across the full width; on the left a small blank wooden sign on the fence "
    "(no text on it). Five small flower plants along the fence: two on the left, three on the right, leaving the centre clear. "
    "Centre foreground: a single young plant sprout with two leaves growing from a small mound of soil (the app mascot, "
    "no face, no eyes). Lower left: a small round pond with a stone rim. Right side behind the fence: a young birch tree. "
    "Bottom 20%: plain soft grass, empty, for UI panels. No people, no animals, no text, no letters, no logos, no UI."
)

STYLES = {
    "A-gouache": "Style: hand-painted gouache storybook illustration, matte, visible soft brush texture, muted Nordic palette "
    "(sage green, birch white, lake blue, warm wood), gentle morning light, grown-up and calm, like a premium Finnish picture book.",
    "B-clay": "Style: soft 3D clay / matte plasticine render, rounded friendly shapes, subtle ambient occlusion, pastel but "
    "desaturated palette, studio soft light, minimal and premium, like a high-end wellbeing app illustration.",
    "C-papercut": "Style: Scandinavian layered paper-cut flat illustration, clean vector shapes with subtle paper grain and soft "
    "drop shadows between layers, restrained palette of deep green, sage, sand and off-white, modern and adult, banking-app quality.",
}


def main(names: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    for name in names or list(STYLES):
        resp = client.models.generate_content(
            model=MODEL,
            contents=f"{SCENE}\n\n{STYLES[name]}",
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="9:16"),
            ),
        )
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                path = OUT / f"style-{name}.png"
                path.write_bytes(part.inline_data.data)
                print("saved", path)
                break
        else:
            print("no image for", name, file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1:])
