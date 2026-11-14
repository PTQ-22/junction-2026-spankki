"""End-to-end 2-minute pitch video for Taimi.

The phone is driven only by deep links (`xcrun simctl openurl`) against the
standalone Release build, so every take is identical. Segment length is the
voice-over length, so picture and narration stay in sync.

  uv run --env-file .env python demo/demo.py vo        # TTS per segment -> demo/out/vo/*.wav, prints timing
  uv run --env-file .env python demo/demo.py rehearse  # run the timeline without recording (warms the chat cache)
  uv run --env-file .env python demo/demo.py record    # record the simulator -> demo/out/screen.mov
  uv run --env-file .env python demo/demo.py compose   # 1920x1080 pitch video -> demo/out/taimi-pitch.mp4
  uv run --env-file .env python demo/demo.py transcript

Prereqs: backend on :8000, Release app installed (cd app && npm run ios:release), simulator booted.
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
import wave
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
VO_DIR = OUT / "vo"
BUNDLE = "fi.junction.taimi"
FONT_DISPLAY = ROOT.parent / "app/node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf"
FONT_BODY = ROOT.parent / "app/node_modules/@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf"
TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-3.1-flash-tts-preview")
VOICE = os.environ.get("TTS_VOICE", "Sulafat")
PAD = 0.35  # silence after each segment
LEAD_IN = 0.8  # seconds of picture before the first word
MAX_TOTAL = 120.0

Q1 = "What kind of spender am I?"
Q2 = "How do I compare to people my age?"
Q3 = "How much will I spend on restaurants in October?"


def ask(q: str) -> str:
    return f"ask?q={quote(q)}"


# Tap markers as fractions of the phone screen (measured on the Release build, iPhone 18 Pro).
# The phone is driven by deep links, so these rings show the viewer what a user would tap.
TAP = {
    "bills": (0.157, 0.483),
    "pond": (0.23, 0.655),
    "flower": (0.47, 0.46),
    "whatif": (0.38, 0.79),
    "spending_tab": (0.375, 0.944),
    "ask_tab": (0.623, 0.942),
}
PHONE_H, PHONE_X, PHONE_Y = 1000, 1180, 40
PHONE_W = round(1206 * PHONE_H / 2622)


# (offset seconds within the segment, deep-link path) — offsets are clamped to the segment length.
SEGMENTS = [
    {
        "id": "hook",
        "title": "Taimi",
        "sub": "a money coach inside S-mobiili\nthat knows what it doesn't know",
        "vo": "This is S-mobiili — with Taimi inside. Taimi turns your own transactions into a garden. "
              "And it's a coach that knows what it doesn't know.",
        "actions": [],
    },
    {
        "id": "garden",
        "title": "Read the garden",
        "sub": "fence = bills, forecast within ~6%\npond = buffer for irregular costs",
        "vo": "The fence is your bills: rent and utilities, which we forecast within about six percent. "
              "The pond is your buffer for the irregular stuff, like the dentist or a broken laptop.",
        "actions": [(0.4, "?obj=bills", TAP["bills"]), (5.6, "?close=1"), (6.2, "?obj=savings", TAP["pond"]),
                    (99, "?close=1")],
    },
    {
        "id": "flower",
        "title": "Flowers = fun spending",
        "sub": "compared with your own usual\nin euros and in hours of work",
        "vo": "The flowers are the spending that escapes. Tap one: three hundred and nineteen euros on "
              "entertainment in thirty days, against your usual hundred and twenty. That's almost twenty "
              "hours of your work, with receipts for every number.",
        "actions": [(0.3, "?flower=Entertainment", TAP["flower"]), (99, "?close=1")],
    },
    {
        "id": "ask",
        "title": "Ask anything",
        "sub": "the AI never does the maths —\ndeterministic tools do, with receipts",
        "vo": "Or just ask. The AI never does the maths: it calls tools on your data, and any number "
              "that didn't come from a tool is rejected. Ask it to predict next month's spending on fun, "
              "and it says honestly: nobody can.",
        "actions": [(0.0, "ask?reset=1", TAP["ask_tab"]), (0.6, ask(Q1)), (6.0, ask(Q2)), (11.5, ask(Q3))],
    },
    {
        "id": "whatif",
        "title": "You decide",
        "sub": "−20% dining → +401 € in 6 months\na simulation, never a prediction",
        "vo": "So instead of guessing, you decide. Spend twenty percent less on restaurants, and watch "
              "six months play out in your garden: four hundred and one euros, about twenty-five hours "
              "of work.",
        "actions": [(0.2, "?sim=1&category=Restaurants&cut=0.2&autoplay=1", TAP["whatif"])],
    },
    {
        "id": "peers",
        "title": "You vs Finland",
        "sub": "restaurants: you 334 € · peers 144 €\nFinns 17–24 (Statistics Finland): 67 €",
        "vo": "The spending tab compares you with people your age, and with Statistics Finland's "
              "household budget survey.",
        "actions": [(0.0, "?sim=0"), (0.3, "spending", TAP["spending_tab"])],
    },
    {
        "id": "storm",
        "title": "Weather = safe to spend",
        "sub": "a calm warning before rent,\nnever a lecture",
        "vo": "And when money gets tight before rent, the weather turns. A calm warning, never a lecture.",
        "actions": [(0.0, "?persona=CUST00359&close=1")],
    },
    {
        "id": "close",
        "title": "Taimi",
        "sub": "talk to your money —\nright inside S-mobiili",
        "vo": "Taimi. Talk to your money, right inside S-mobiili.",
        "actions": [(0.0, "?persona=CUST04957&close=1")],
    },
]


def sh(*cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def openurl(path: str, n: int) -> None:
    sep = "&" if "?" in path else "?"
    url = f"taimi:///{path}{sep}n={n}"
    sh("xcrun", "simctl", "openurl", "booted", url, check=False)


def wav_len(p: Path) -> float:
    with wave.open(str(p)) as w:
        return w.getnframes() / w.getframerate()


def durations() -> list[float]:
    return [wav_len(VO_DIR / f"{i:02d}-{s['id']}.wav") + PAD for i, s in enumerate(SEGMENTS)]


def cmd_vo() -> None:
    from google import genai
    from google.genai import types

    VO_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"], http_options=types.HttpOptions(api_version="v1beta"))
    style = ("Read this as the voice-over of a short product pitch: warm, calm, confident, unhurried "
             "but brisk, like a Nordic design studio presenting. Finnish names keep their Finnish "
             "pronunciation: 'Taimi' is TIE-mee, 'S-mobiili' is ess-MO-bee-lee. Read only the text "
             "after the colon. Text: ")
    for i, s in enumerate(SEGMENTS):
        p = VO_DIR / f"{i:02d}-{s['id']}.wav"
        if p.exists() and "--force" not in sys.argv:
            continue
        r = client.models.generate_content(
            model=TTS_MODEL,
            contents=style + s["vo"],
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE))
                ),
            ),
        )
        pcm = r.candidates[0].content.parts[0].inline_data.data
        with wave.open(str(p), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(pcm)
        print("vo", p.name, f"{wav_len(p):.1f}s")
    d = durations()
    for s, x in zip(SEGMENTS, d):
        print(f"  {s['id']:<8} {x:5.1f}s")
    total = LEAD_IN + sum(d)
    print(f"total {total:.1f}s (limit {MAX_TOTAL:.0f}s)")
    if total > MAX_TOTAL:
        sys.exit("TOO LONG — shorten the VO")


def run_timeline() -> None:
    """Cold-start the app on Home and play every segment's actions on schedule."""
    sh("xcrun", "simctl", "terminate", "booted", BUNDLE, check=False)
    time.sleep(1.0)
    openurl("?intro=0&persona=CUST04957&close=1", 0)
    time.sleep(6.0)  # splash + first garden load, before recording starts
    n = 1
    yield_point = time.monotonic()
    for s, dur in zip(SEGMENTS, durations()):
        yield s, dur
        start = time.monotonic()
        for a in s["actions"]:
            off, path = min(a[0], dur - 0.4), a[1]
            wait = start + off - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            openurl(path, n)
            n += 1
        rest = start + dur - time.monotonic()
        if rest > 0:
            time.sleep(rest)
    _ = yield_point


def cmd_rehearse() -> None:
    for s, dur in run_timeline():
        print(f"{s['id']:<8} {dur:5.1f}s")


def cmd_record() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mov = OUT / "screen.mov"
    mov.unlink(missing_ok=True)
    timeline = run_timeline()
    first = next(timeline)  # app is warm on Home now
    rec = subprocess.Popen(
        ["xcrun", "simctl", "io", "booted", "recordVideo", "--codec=h264", "--force", str(mov)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    time.sleep(1.2)  # recorder warm-up; trimmed in compose
    t0 = time.monotonic()
    marks = {"record_lead": 1.2}
    time.sleep(LEAD_IN)
    marks[first[0]["id"]] = time.monotonic() - t0
    for s, _ in timeline:
        marks[s["id"]] = time.monotonic() - t0
    time.sleep(0.6)
    rec.send_signal(signal.SIGINT)
    rec.wait(timeout=30)
    (OUT / "marks.json").write_text(json.dumps(marks, indent=1))
    print("recorded", mov, marks)


def _ff_text(t: str) -> str:
    return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019").replace("%", "\\%")


def cmd_compose() -> None:
    d = durations()
    starts, t = [], LEAD_IN
    for x in d:
        starts.append(t)
        t += x
    total = t + 0.6
    # narration track: lead-in silence + segments at their start times
    inputs, filt, labels = [], [], []
    for i, s in enumerate(SEGMENTS):
        inputs += ["-i", str(VO_DIR / f"{i:02d}-{s['id']}.wav")]
        ms = int(starts[i] * 1000)
        filt.append(f"[{i + 1}:a]adelay={ms}|{ms},apad[a{i}]")
        labels.append(f"[a{i}]")
    filt.append("".join(labels) + f"amix=inputs={len(SEGMENTS)}:normalize=0,atrim=0:{total:.2f}[aud]")
    # picture: paper canvas, rounded phone with a soft shadow on the right, kinetic titles on the left
    from PIL import Image, ImageDraw, ImageFilter

    mask = Image.new("L", (PHONE_W, PHONE_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, PHONE_W - 1, PHONE_H - 1], radius=56, fill=255)
    mask.save(OUT / "mask.png")
    sh_img = Image.new("RGBA", (PHONE_W + 160, PHONE_H + 160), (0, 0, 0, 0))
    ImageDraw.Draw(sh_img).rounded_rectangle([80, 96, PHONE_W + 80, PHONE_H + 96], radius=60, fill=(60, 48, 30, 70))
    sh_img.filter(ImageFilter.GaussianBlur(28)).save(OUT / "shadow.png")
    ring = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([8, 8, 112, 112], fill=(255, 255, 255, 70), outline=(28, 58, 46, 220), width=6)
    ring.save(OUT / "tap.png")

    lead = json.loads((OUT / "marks.json").read_text())["record_lead"]
    ni = len(SEGMENTS) + 1
    inputs += ["-loop", "1", "-i", str(OUT / "mask.png"), "-loop", "1", "-i", str(OUT / "shadow.png"),
               "-loop", "1", "-i", str(OUT / "tap.png")]
    # simctl records variable frame rate (frames only on change); alphamerge pairs frames by index,
    # so resample both inputs to the same constant rate first or the phone plays fast.
    v = [f"[0:v]trim=start={lead:.2f},setpts=PTS-STARTPTS,fps=30,scale={PHONE_W}:{PHONE_H},format=rgba[phs]",
         f"[{ni}:v]fps=30,format=gray,scale={PHONE_W}:{PHONE_H}[msk]",
         "[phs][msk]alphamerge[ph]",
         f"color=c=0xF5F0E6:s=1920x1080:d={total:.2f}[bg]",
         f"[bg][{ni + 1}:v]overlay=x={PHONE_X - 80}:y={PHONE_Y - 80}:shortest=1[bgs]",
         f"[bgs][ph]overlay=x={PHONE_X}:y={PHONE_Y}:shortest=0[base0]"]
    cur = "base0"
    k = 0
    for i, s in enumerate(SEGMENTS):
        for a in s["actions"]:
            if len(a) < 3:
                continue
            at = starts[i] + min(a[0], d[i] - 0.4)
            fx, fy = a[2]
            x, y = PHONE_X + fx * PHONE_W - 60, PHONE_Y + fy * PHONE_H - 60
            v.append(f"[{ni + 2}:v]scale=120:120,format=rgba[ring{k}]")
            v.append(f"[{cur}][ring{k}]overlay=x={x:.0f}:y={y:.0f}:"
                     f"enable='between(t\\,{at - 0.25:.2f}\\,{at + 0.45:.2f})'[tp{k}]")
            cur = f"tp{k}"
            k += 1
    # titles are pre-rendered PNGs (this ffmpeg build has no drawtext/freetype)
    from PIL import ImageFont

    f_title = ImageFont.truetype(str(FONT_DISPLAY), 88)
    f_sub = ImageFont.truetype(str(FONT_BODY), 40)
    f_foot = ImageFont.truetype(str(FONT_BODY), 26)
    nxt_in = ni + 3
    for i, s in enumerate(SEGMENTS):
        card = Image.new("RGBA", (1000, 420), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        cd.text((0, 0), s["title"], font=f_title, fill=(28, 58, 46, 255))
        cd.rectangle([4, 128, 84, 134], fill=(0, 90, 60, 255))
        for j, line in enumerate(s["sub"].split("\n")):
            cd.text((4, 168 + j * 60), line, font=f_sub, fill=(94, 107, 96, 255))
        cp = OUT / f"card-{i:02d}.png"
        card.save(cp)
        inputs += ["-loop", "1", "-t", f"{total:.2f}", "-i", str(cp)]
        a, b = starts[i], starts[i] + d[i]
        v.append(f"[{nxt_in + i}:v]format=rgba,fade=t=in:st={a:.2f}:d=0.4:alpha=1,"
                 f"fade=t=out:st={b - 0.3:.2f}:d=0.3:alpha=1[c{i}]")
        v.append(f"[{cur}][c{i}]overlay=x=130:y=330:enable='between(t\\,{a:.2f}\\,{b:.2f})'[cc{i}]")
        cur = f"cc{i}"
    foot = Image.new("RGBA", (1000, 40), (0, 0, 0, 0))
    ImageDraw.Draw(foot).text((0, 0), "Junction 2026  ·  S-Pankki  ·  Personal Economic Trainer",
                              font=f_foot, fill=(140, 147, 135, 255))
    foot.save(OUT / "foot.png")
    inputs += ["-loop", "1", "-t", f"{total:.2f}", "-i", str(OUT / "foot.png")]
    v.append(f"[{cur}][{nxt_in + len(SEGMENTS)}:v]overlay=x=134:y=990[vid]")
    graph = ";".join(v + filt)
    out = OUT / "taimi-pitch.mp4"
    cmd = ["ffmpeg", "-y", "-i", str(OUT / "screen.mov"), *inputs, "-filter_complex", graph,
           "-map", "[vid]", "-map", "[aud]", "-t", f"{total:.2f}", "-r", "30",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", "-b:a", "160k", str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-3000:])
        sys.exit(1)
    print("wrote", out, f"{total:.1f}s")


def cmd_transcript() -> None:
    d = durations()
    t, lines = LEAD_IN, ["# Taimi — 2-minute pitch transcript", ""]
    for s, x in zip(SEGMENTS, d):
        lines.append(f"**{int(t // 60)}:{t % 60:04.1f} – {s['title']}**  ")
        lines.append(s["vo"])
        lines.append("")
        t += x
    lines.append(f"_Total: {t:.0f} s_")
    (ROOT / "TRANSCRIPT.md").write_text("\n".join(lines) + "\n")
    print("wrote", ROOT / "TRANSCRIPT.md")


if __name__ == "__main__":
    {"vo": cmd_vo, "rehearse": cmd_rehearse, "record": cmd_record, "compose": cmd_compose,
     "transcript": cmd_transcript}[sys.argv[1]]()
