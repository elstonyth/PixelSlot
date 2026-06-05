# Animated rebrand: for each base with an animated -machine.avif, paste the rebranded banner
# (top BAND of the composed -machine.webp, static across frames) onto EVERY frame, preserving
# each frame's real duration, and re-encode as an animated avif {base}-anim.avif.
import sys
import pillow_avif  # noqa
import os
from PIL import Image

BAND = 0.27  # top fraction = static banner zone (claw motion starts below)
bases = sys.argv[1:]
for base in bases:
    srcp = f"public/images/claw/{base}-machine.avif"
    rebp = f"public/images/claw/{base}-machine.webp"
    if not os.path.exists(srcp):
        alt = f"public/images/claw/{base}-machine-src.webp"  # animated original backup (webp)
        if os.path.exists(alt):
            srcp = alt
        else:
            print(f"{base}: SKIP (no animated source)")
            continue
    src = Image.open(srcp)
    if getattr(src, "n_frames", 1) < 2:
        print(f"{base}: SKIP (source is static, {getattr(src,'n_frames',1)}f)")
        continue
    reb = Image.open(rebp).convert("RGB")
    W, H = src.size
    if reb.size != (W, H):
        reb = reb.resize((W, H))
    cut = int(BAND * H)
    banner = reb.crop((0, 0, W, cut))
    frames, durs = [], []
    for i in range(src.n_frames):
        src.seek(i)
        durs.append(src.info.get("duration", 40))
        fr = src.convert("RGB").copy()
        fr.paste(banner, (0, 0))
        frames.append(fr)
    out = f"public/images/claw/{base}-anim.avif"
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=92)
    print(f"{base}: {len(frames)}f {round(os.path.getsize(out)/1024)}KB durs={sorted(set(durs))}")
