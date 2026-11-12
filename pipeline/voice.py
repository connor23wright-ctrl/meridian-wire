"""Step 3 fallback voice. Reads work/narration.txt aloud with the Kokoro voice
model, which runs on the build machine itself, so it does not depend on an
outside speech service. Writes work/voice.wav and caption timings in work/voice.srt.
Usage: python pipeline/voice.py <model.onnx> <voices.bin> [voice]"""
import re, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

model, voices = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else "am_michael"
text = open("work/narration.txt", encoding="utf-8").read().strip()
sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]

k = Kokoro(model, voices)
audio, cues, t, rate = [], [], 0.0, 24000
for s in sentences:
    samples, rate = k.create(s, voice=voice, speed=1.0, lang="en-us")
    d = len(samples) / rate
    cues.append((t, t + d, s))
    audio += [samples, np.zeros(int(rate * 0.22), dtype=samples.dtype)]
    t += d + 0.22

def stamp(x):
    h, m = int(x // 3600), int(x % 3600 // 60)
    return f"{h:02}:{m:02}:{x % 60:06.3f}".replace(".", ",")

sf.write("work/voice.wav", np.concatenate(audio), rate)
with open("work/voice.srt", "w", encoding="utf-8") as f:
    for i, (a, b, s) in enumerate(cues, 1):
        f.write(f"{i}\n{stamp(a)} --> {stamp(b)}\n{s}\n\n")
print(f"Narration recorded: {t:.1f}s, {len(cues)} sentences, voice {voice}")
