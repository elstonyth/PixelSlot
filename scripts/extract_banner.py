# Extract frame-0 banner of the animated avif (upscaled) to inspect edge sharpness vs the
# crisp static webp (the avif is re-encoded at q80 — may have softened edges).
import sys
import pillow_avif  # noqa
from PIL import Image

for base in sys.argv[1:] or ["modern-grails-noafw0", "pro-soccer-pack"]:
    im = Image.open(f"public/images/claw/{base}-anim.avif")
    im.seek(0)
    fr = im.convert("RGB")
    W, H = fr.size
    crop = fr.crop((0, 0, W, int(0.27 * H)))
    crop = crop.resize((int(crop.width * 1.4), int(crop.height * 1.4)))
    crop.save(f"docs/research/packdetail/animbanner_{base}.png")
    print(f"{base}: banner crop saved ({W}x{H} source)")
